import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, Expand, Loader2, MapPin, CalendarDays, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import logoSrc from "@/assets/ogv-logo.svg";
import { meQuery, myPassQuery, replacePass } from "@/lib/api";
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
  const [big, setBig] = useState(false);
  const [replacing, setReplacing] = useState(false);

  if (pass.isError) return <ErrorState error={pass.error} onRetry={() => pass.refetch()} />;
  if (!pass.data)
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[520px] rounded-2xl" />
      </div>
    );
  const p = pass.data;

  return (
    <div className="mx-auto max-w-md animate-rise space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">My access pass</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your access pass stays on your phone. Gym entry is subject to your current membership
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

      <section className="panel space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Download className="size-4" /> Save to your phone
        </h2>
        <SaveImageButton p={p} />
        <QRCodeCanvas id="pass-qr-canvas" value={p.token} size={640} level="M" marginSize={0} className="hidden" />
        <p className="text-xs text-muted-foreground">
          Saves your pass as a picture to your photos. Show it at reception, or open this page and
          tap the QR code to enlarge it. Brightness up helps the scanner.
        </p>
      </section>

      <section className="panel p-5 text-sm">
        <h2 className="font-medium">Lost your phone?</h2>
        <p className="mt-1 text-muted-foreground">
          Replace your pass and the old QR code, including any saved pictures, stops working straight
          away. Pass issued {fmtDate(p.issued_at)}.
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

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

async function renderPassPng(p: { full_name: string | null; member_code: string; member_since: string }) {
  const W = 1080, H = 1720;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  const gold = "#C69633";
  x.fillStyle = "#1c1c1c";
  x.beginPath(); x.roundRect(0, 0, W, H, 64); x.fill();
  const logo = await loadImg(logoSrc);
  const lh = 120, lw = (logo.width / logo.height) * lh || lh;
  x.drawImage(logo, 80, 80, lw, lh);
  x.fillStyle = "#fafafa";
  x.font = "700 44px 'Bricolage Grotesque', sans-serif";
  x.fillText("O G V   G Y M", 100 + lw, 158);
  const label = (t: string, y: number, align: CanvasTextAlign = "left", px = 80) => {
    x.textAlign = align; x.fillStyle = "rgba(255,255,255,0.55)";
    x.font = "500 26px Geist, sans-serif"; x.fillText(t, px, y);
  };
  label("MEMBER NAME", 330);
  x.fillStyle = "#fafafa"; x.font = "600 64px 'Bricolage Grotesque', sans-serif";
  x.fillText(p.full_name || "Member", 80, 410);
  label("MEMBER ID", 490);
  x.fillStyle = gold; x.font = "600 56px 'Geist Mono', monospace";
  x.fillText(p.member_code, 80, 560);
  const qr = document.getElementById("pass-qr-canvas") as HTMLCanvasElement | null;
  if (!qr) throw new Error("QR not ready");
  const s = 640, qx = (W - s) / 2, qy = 640;
  x.fillStyle = "#ffffff";
  x.beginPath(); x.roundRect(qx - 40, qy - 40, s + 80, s + 80, 36); x.fill();
  x.imageSmoothingEnabled = false;
  x.drawImage(qr, qx, qy, s, s);
  label("MEMBER SINCE", 1480);
  x.fillStyle = "#fafafa"; x.font = "500 38px Geist, sans-serif"; x.textAlign = "left";
  x.fillText(fmtLongDate(p.member_since), 80, 1540);
  label("LOCATION", 1480, "right", W - 80);
  x.fillStyle = "#fafafa"; x.font = "500 38px Geist, sans-serif"; x.textAlign = "right";
  x.fillText("OGV Gym", W - 80, 1540);
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't create image"))), "image/png"));
}

function SaveImageButton({ p }: { p: { full_name: string | null; member_code: string; member_since: string } }) {
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const blob = await renderPassPng(p);
      const name = `OGV-pass-${p.member_code}.png`;
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "OGV Gym pass" });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("Pass image saved.");
    } catch (e) {
      toast.error("Couldn't save the image: " + errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      className="h-12 w-full bg-[oklch(0.17_0_0)] text-[oklch(0.98_0_0)] hover:bg-[oklch(0.25_0_0)]"
      disabled={busy}
      onClick={save}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {busy ? "Preparing image…" : "Save pass to my device"}
    </Button>
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
