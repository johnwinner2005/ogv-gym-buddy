import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appleConfigured,
  buildPkpass,
  googleConfigured,
  googleSaveUrl,
  signDownload,
  walletError,
  type PassData,
} from "./wallet.server";

type MyPass = { credential_id: string; token: string; member_code: string; full_name: string; member_since: string };

async function myPass(supabase: { rpc: (n: "get_my_pass") => PromiseLike<{ data: unknown; error: { message: string } | null }> }): Promise<PassData> {
  const { data, error } = await supabase.rpc("get_my_pass");
  if (error || !data) throw new Error("Couldn't load your pass");
  const p = data as MyPass;
  return { credentialId: p.credential_id, token: p.token, memberCode: p.member_code, fullName: p.full_name, memberSince: p.member_since };
}

export const getWalletConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ apple: appleConfigured(), google: googleConfigured() }));

export const issueApplePass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    try {
      const d = await myPass(context.supabase as never);
      buildPkpass(d); // validates certificates before handing out a link
      return { ok: true, url: `/api/public/wallet/apple?t=${encodeURIComponent(await signDownload(d.credentialId))}` };
    } catch (e) {
      return { ok: false, error: walletError(e, "Apple") };
    }
  });

export const issueGooglePass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    try {
      const d = await myPass(context.supabase as never);
      const { url, objectId } = await googleSaveUrl(d);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("record_wallet_issue", { _credential: d.credentialId, _provider: "google", _ref: objectId });
      return { ok: true, url };
    } catch (e) {
      return { ok: false, error: walletError(e, "Google") };
    }
  });
