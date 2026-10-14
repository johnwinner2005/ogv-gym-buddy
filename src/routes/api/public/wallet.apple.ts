import { createFileRoute } from "@tanstack/react-router";

const text = (msg: string, status: number) =>
  new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

// Serves a signed .pkpass. Access requires a 5-minute HMAC link issued to the signed-in member.
export const Route = createFileRoute("/api/public/wallet/apple")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { verifyDownload, buildPkpass, walletError } = await import("@/lib/wallet.server");
        const t = new URL(request.url).searchParams.get("t") ?? "";
        const credId = t.length < 300 ? await verifyDownload(t) : null;
        if (!credId) return text("This pass link has expired. Go back and tap Add to Apple Wallet again.", 403);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: c } = await supabaseAdmin
          .from("member_credentials")
          .select("id, token, status, member_id, profiles(member_code, full_name, created_at)")
          .eq("id", credId)
          .maybeSingle();
        const p = c?.profiles as { member_code: string; full_name: string; created_at: string } | null;
        if (!c || c.status !== "active" || !p) return text("This pass has been replaced. Open My Access Pass to get the current one.", 410);
        try {
          const file = buildPkpass({ credentialId: c.id, token: c.token, memberCode: p.member_code, fullName: p.full_name, memberSince: p.created_at });
          await supabaseAdmin.rpc("record_wallet_issue", { _credential: c.id, _provider: "apple", _ref: c.id });
          return new Response(file as BodyInit, {
            headers: {
              "content-type": "application/vnd.apple.pkpass",
              "content-disposition": `attachment; filename="ogv-gym-${p.member_code}.pkpass"`,
              "cache-control": "no-store",
            },
          });
        } catch (e) {
          return text(walletError(e, "Apple"), 503);
        }
      },
    },
  },
});
