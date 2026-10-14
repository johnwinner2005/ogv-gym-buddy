import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Expand, Loader2, MapPin, CalendarDays, RotateCcw, ShieldAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import logoSrc from "@/assets/ogv-logo.svg";
import { meQuery, myPassQuery, replacePass } from "@/lib/api";
import { getWalletConfig, issueApplePass, issueGooglePass } from "@/lib/wallet.functions";
import { errMessage, fmtDate, fmtLongDate } from "@/lib/format";
import { ErrorState } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/pass")({
  head: () => ({ meta: [{ title: "My access pass — OGV Gym" }] }),
  component: PassPage,
});

function PassPage() {
  const pass = useQuery(myPassQuery);
  const getCfg = useServerFn(getWalletConfig);
  const cfg = useQuery({ queryKey: ["wallet-config"], queryFn: () => getCfg(), staleTime: 300_000 });
  const [big, setBig] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "other");
  }, []);

  if (pass.isError) return <ErrorState error={pass.error} onRetry={() => pass.refetch()} />;
  if (!pass.data)
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[520px] rounded-2xl" />
      </div>
    );
  const p = pass.data;
  const has = (prov: "apple" | "google") => p.wallet.find((w) => w.provider === prov);

  return (
    <div className="mx-auto max-w-md animate-rise space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">My access pass</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your access pass stays in your Wallet. Gym entry is subject to your current membership
          status.
        </p>
      </div>

      {p.status !== "active" && (
        <div role="status" className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            {p.pending_requests > 0
              ? "Your payment is awaiting verification. This pass identifies you, but entry depends on an approved membership."
              : p.status === "suspended" || p.status === "cancelled"
                ? "Your membership isn't active, so this pass won't grant entry right now."
                : "You don't have an active membership. This pass identifies you, but won't grant entry until you "}
            {p.pending_requests === 0 && p.status !== "suspended" && p.status !== "cancelled" && (
              <Link to="/app/renew" className="font-medium underline underline-offset-4">
                {p.status === "none" ? "activate a plan" : "renew"}
              </Link>
            )}
            {p.pending_requests === 0 && p.status !== "suspended" && p.status !== "cancelled" && "."}
          </p>
        </div>
      )}

      {/* Pass preview */}
      <article
        aria-label="Membership pass"
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.17_0_0)] p-6 text-[oklch(0.98_0_0)] shadow-sm"
      >
        <img src={logoSrc} alt="" aria-hidden className="pointer-events-none absolute -right-16 top-24 w-72 opacity-[0.06]" />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="OGV Gym" className="h-10 w-auto" />
            <span className="font-display text-lg font-bold tracking-[0.25em]">OGV GYM</span>
          </div>
          <span className="border-b border-[#C69633] pb-1 text-[10px] font-medium tracking-[0.2em] text-white/70">
            MEMBERSHIP PASS
          </span>
        </div>
        <p className="mt-8 text-[10px] tracking-[0.2em] text-white/55">MEMBER NAME</p>
        <p className="mt-1 font-display text-2xl font-semibold">{p.full_name || "Member"}</p>
        <p className="mt-5 text-[10px] tracking-[0.2em] text-white/55">MEMBER ID</p>
        <p className="mt-1 font-mono text-xl font-semibold text-[#C69633]">{p.member_code}</p>
        <button
          onClick={() => setBig(true)}
          className="group relative mx-auto mt-6 block rounded-xl bg-white p-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C69633]"
          aria-label="Enlarge QR code for scanning"
        >
          <QRCodeSVG value={p.token} size={184} level="M" />
          <Expand className="absolute bottom-1.5 right-1.5 size-3.5 text-black/40" />
        </button>
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <CalendarDays className="size-4 text-[#C69633]" />
            <p className="mt-1.5 text-[10px] tracking-[0.2em] text-white/55">MEMBER SINCE</p>
            <p className="mt-0.5 font-medium">{fmtLongDate(p.member_since)}</p>
          </div>
          <div className="text-right">
            <MapPin className="ml-auto size-4 text-[#C69633]" />
            <p className="mt-1.5 text-[10px] tracking-[0.2em] text-white/55">LOCATION</p>
            <p className="mt-0.5 font-medium">OGV Gym</p>
          </div>
        </div>
      </article>

      <CopyId code={p.member_code} />

      {/* Wallet actions */}
      <section className="panel space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Wallet className="size-4" /> Save to your phone
        </h2>
        {cfg.isLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            <WalletButton
              provider="apple"
              ready={!!cfg.data?.apple}
              recommended={platform === "ios"}
              issued={has("apple")?.last_issued_at}
            />
            <WalletButton
              provider="google"
              ready={!!cfg.data?.google}
              recommended={platform === "android"}
              issued={has("google")?.last_issued_at}
            />
          </>
        )}
        <p className="text-xs text-muted-foreground">
          No Wallet? Open this page at reception and tap the QR code to enlarge it. Brightness up
          helps the scanner.
        </p>
      </section>

      <section className="panel p-5 text-sm">
        <h2 className="font-medium">Lost your phone?</h2>
        <p className="mt-1 text-muted-foreground">
          Replace your pass and the old QR code and Wallet passes stop working straight away. Pass
          issued {fmtDate(p.issued_at)}.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setReplacing(true)}>
          <RotateCcw /> Replace my pass
        </Button>
      </section>

      <Dialog open={big} onOpenChange={setBig}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Show this at reception</DialogTitle>
            <DialogDescription className="font-mono">{p.member_code}</DialogDescription>
          </DialogHeader>
          <div className="mx-auto rounded-xl bg-white p-5">
            <QRCodeSVG value={p.token} size={280} level="M" />
          </div>
        </DialogContent>
      </Dialog>
      <ReplaceDialog open={replacing} onClose={() => setReplacing(false)} />
    </div>
  );
}

function CopyId({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          toast.error("Couldn't copy — your member ID is " + code);
        }
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "Copied" : `Copy member ID ${code}`}
    </Button>
  );
}

function WalletButton({
  provider,
  ready,
  recommended,
  issued,
}: {
  provider: "apple" | "google";
  ready: boolean;
  recommended: boolean;
  issued?: string;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(provider === "apple" ? issueApplePass : issueGooglePass);
  const name = provider === "apple" ? "Apple Wallet" : "Google Wallet";
  const m = useMutation({
    mutationFn: () => fn(),
    onSuccess: (r) => {
      if (!r.ok) return;
      qc.invalidateQueries({ queryKey: ["my-pass"] });
      if (provider === "apple") window.location.href = r.url;
      else window.open(r.url, "_blank", "noopener");
    },
  });
  const err = m.data && !m.data.ok ? m.data.error : m.isError ? errMessage(m.error) : "";
  return (
    <div>
      <Button
        className="h-12 w-full justify-center bg-[oklch(0.17_0_0)] text-[oklch(0.98_0_0)] hover:bg-[oklch(0.25_0_0)]"
        disabled={!ready || m.isPending}
        onClick={() => m.mutate()}
        aria-describedby={`${provider}-note`}
      >
        {m.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
        {m.isPending ? "Preparing your pass…" : `Add to ${name}`}
        {recommended && ready && !m.isPending && (
          <span className="ml-1 rounded bg-white/15 px-1.5 text-[10px]">for this phone</span>
        )}
      </Button>
      <p id={`${provider}-note`} className="mt-1 text-xs text-muted-foreground" role={err ? "alert" : undefined}>
        {!ready
          ? `${name} isn't set up by the gym yet — use the QR code above for now.`
          : err
            ? <span className="text-danger">{err} <button className="underline" onClick={() => m.mutate()}>Retry</button></span>
            : m.data?.ok
              ? provider === "apple"
                ? "Pass created. If Wallet didn't open, tap the button again in Safari."
                : "Save link opened. Confirm in Google Wallet to finish."
              : issued
                ? `Pass issued ${fmtDate(issued)}. Tap again to re-add it on a new phone.`
                : provider === "apple"
                  ? "Works on iPhone with Safari."
                  : "Works on Android and in Chrome."}
      </p>
    </div>
  );
}

function ReplaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => replacePass(me!.user.id, reason),
    onSuccess: () => {
      toast.success("New pass ready. Add it to your Wallet again.");
      qc.invalidateQueries({ queryKey: ["my-pass"] });
      setReason("");
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace my pass?</DialogTitle>
          <DialogDescription>
            Your current QR code and any Wallet passes stop working immediately. Your member ID and
            membership stay the same.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Reason"
          placeholder="e.g. Lost my phone"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={reason.trim().length < 3 || m.isPending || !me} onClick={() => m.mutate()}>
            {m.isPending && <Loader2 className="animate-spin" />} Replace pass
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
