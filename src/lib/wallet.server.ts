/**
 * Server-only Apple Wallet (.pkpass) and Google Wallet issuance.
 * Secrets are read from process.env inside each call; nothing here ships to the browser.
 */
import forge from "node-forge";
import { zipSync, strToU8 } from "fflate";
import { PASS_IMAGES } from "./wallet-assets.server";

export const PUBLIC_SITE_URL = "https://ogv-gym-buddy.lovable.app";

export interface PassData {
  credentialId: string;
  token: string;
  memberCode: string;
  fullName: string;
  memberSince: string;
}

const env = (k: string) => process.env[k]?.trim() || "";

export function appleConfigured() {
  return ["APPLE_PASS_TYPE_ID", "APPLE_TEAM_ID", "APPLE_PASS_CERT_PEM", "APPLE_PASS_KEY_PEM", "APPLE_WWDR_CERT_PEM"].every(
    (k) => !!env(k),
  );
}
export function googleConfigured() {
  return !!env("GOOGLE_WALLET_ISSUER_ID") && !!env("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON");
}

const sinceLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

/* ---------- short-lived signed download links (Apple needs a plain GET) ---------- */
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(msg: string) {
  const secret = env("WALLET_LINK_SECRET");
  if (!secret) throw new Error("Wallet link secret missing");
  const key = await crypto.subtle.importKey("raw", strToU8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, strToU8(msg)));
}
export async function signDownload(credentialId: string, ttlSec = 300) {
  const body = `${credentialId}.${Math.floor(Date.now() / 1000) + ttlSec}`;
  return `${body}.${await hmac(body)}`;
}
export async function verifyDownload(t: string): Promise<string | null> {
  const parts = t.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts as [string, string, string];
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return null;
  const expected = await hmac(`${id}.${exp}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? id : null;
}

/* ---------- Apple Wallet ---------- */
const pem = (k: string) => env(k).replace(/\\n/g, "\n");

export function buildPkpass(d: PassData): Uint8Array {
  if (!appleConfigured()) throw new Error("APPLE_NOT_CONFIGURED");
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: env("APPLE_PASS_TYPE_ID"),
    teamIdentifier: env("APPLE_TEAM_ID"),
    serialNumber: d.credentialId,
    organizationName: "OGV Gym",
    description: "OGV Gym membership pass",
    logoText: "OGV GYM",
    foregroundColor: "rgb(255,255,255)",
    backgroundColor: "rgb(17,17,17)",
    labelColor: "rgb(198,150,51)",
    sharingProhibited: true,
    generic: {
      headerFields: [{ key: "kind", label: "MEMBERSHIP", value: "Pass" }],
      primaryFields: [{ key: "name", label: "MEMBER NAME", value: d.fullName || "Member" }],
      secondaryFields: [
        { key: "uid", label: "MEMBER ID", value: d.memberCode },
        { key: "since", label: "MEMBER SINCE", value: sinceLabel(d.memberSince) },
      ],
      auxiliaryFields: [{ key: "loc", label: "LOCATION", value: "OGV Gym" }],
      backFields: [
        { key: "about", label: "About this pass", value: "This pass identifies you at OGV Gym. Gym entry is subject to your current membership status, checked live at reception." },
        { key: "help", label: "Lost your phone?", value: "Replace your pass from My Access Pass in the member portal. The old pass stops working immediately." },
      ],
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: d.token, messageEncoding: "iso-8859-1", altText: d.memberCode }],
    barcode: { format: "PKBarcodeFormatQR", message: d.token, messageEncoding: "iso-8859-1", altText: d.memberCode },
  };

  const files: Record<string, Uint8Array> = { "pass.json": strToU8(JSON.stringify(pass)) };
  for (const [n, b64] of Object.entries(PASS_IMAGES)) files[n] = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const bin = (u: Uint8Array) => { let s = ""; for (const b of u) s += String.fromCharCode(b); return s; };
  const manifest: Record<string, string> = {};
  for (const [n, u] of Object.entries(files)) manifest[n] = forge.md.sha1.create().update(bin(u)).digest().toHex();
  const manifestStr = JSON.stringify(manifest);
  files["manifest.json"] = strToU8(manifestStr);

  const cert = forge.pki.certificateFromPem(pem("APPLE_PASS_CERT_PEM"));
  const wwdr = forge.pki.certificateFromPem(pem("APPLE_WWDR_CERT_PEM"));
  const pass_ = env("APPLE_PASS_KEY_PASSPHRASE");
  const key = pass_ ? forge.pki.decryptRsaPrivateKey(pem("APPLE_PASS_KEY_PEM"), pass_) : forge.pki.privateKeyFromPem(pem("APPLE_PASS_KEY_PEM"));
  if (!key) throw new Error("APPLE_KEY_INVALID");

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestStr, "utf8");
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256!,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType!, value: forge.pki.oids.data! },
      { type: forge.pki.oids.messageDigest! },
      { type: forge.pki.oids.signingTime!, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  files["signature"] = Uint8Array.from(der, (c) => c.charCodeAt(0));
  return zipSync(files, { level: 6 });
}

/* ---------- Google Wallet ---------- */
export async function googleSaveUrl(d: PassData): Promise<{ url: string; objectId: string }> {
  if (!googleConfigured()) throw new Error("GOOGLE_NOT_CONFIGURED");
  const issuer = env("GOOGLE_WALLET_ISSUER_ID");
  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(env("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON"));
  } catch {
    throw new Error("GOOGLE_SA_INVALID");
  }
  const classId = `${issuer}.ogv_membership`;
  const objectId = `${issuer}.m_${d.credentialId.replace(/-/g, "")}`;
  const lv = (value: string) => ({ defaultValue: { language: "en", value } });
  const claims = {
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [PUBLIC_SITE_URL],
    payload: {
      genericClasses: [{ id: classId }],
      genericObjects: [
        {
          id: objectId,
          classId,
          state: "ACTIVE",
          cardTitle: lv("OGV GYM"),
          subheader: lv("Member name"),
          header: lv(d.fullName || "Member"),
          hexBackgroundColor: "#111111",
          logo: { sourceUri: { uri: `${PUBLIC_SITE_URL}/wallet/google-logo.png` }, contentDescription: lv("OGV Gym logo") },
          barcode: { type: "QR_CODE", value: d.token, alternateText: d.memberCode },
          textModulesData: [
            { id: "uid", header: "Member ID", body: d.memberCode },
            { id: "since", header: "Member since", body: sinceLabel(d.memberSince) },
            { id: "note", header: "Entry", body: "Subject to your current membership status, checked live at reception." },
          ],
        },
      ],
    },
  };
  const enc = (o: unknown) => b64url(strToU8(JSON.stringify(o)));
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claims)}`;
  const der = Uint8Array.from(
    atob(sa.private_key.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, strToU8(unsigned));
  return { url: `https://pay.google.com/gp/v/save/${unsigned}.${b64url(sig)}`, objectId };
}

/** Maps internal failure codes to messages that never reveal secret material. */
export function walletError(e: unknown, provider: "Apple" | "Google"): string {
  const m = e instanceof Error ? e.message : "";
  if (m.endsWith("NOT_CONFIGURED")) return `${provider} Wallet isn't set up for this gym yet.`;
  console.error(`[wallet:${provider}]`, m);
  return `${provider} Wallet pass couldn't be created right now. Please try again later or show the QR code on this page.`;
}
