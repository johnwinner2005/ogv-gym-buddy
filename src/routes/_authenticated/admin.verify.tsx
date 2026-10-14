import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Search, X } from "lucide-react";
import { searchMembers, verifyMember, type VerifyResult } from "@/lib/api";
import { fmtDateTime, fmtLongDate, initials, relative } from "@/lib/format";
import { DECISION, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/verify")({
  head: () => ({ meta: [{ title: "Verify membership — OGV Gym staff" }] }),
  component: Verify,
});

type Match = Awaited<ReturnType<typeof searchMembers>>[number];
type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "matches"; items: Match[] }
  | { kind: "result"; data: VerifyResult }
  | { kind: "not_found"; q: string }
  | { kind: "error"; message: string; retry: () => void };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Verify() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  async function check(id: string) {
    setState({ kind: "loading" });
    try {
      const data = await verifyMember(id);
      if (data.status === "not_found") setState({ kind: "not_found", q: "scanned code" });
      else setState({ kind: "result", data });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message, retry: () => check(id) });
    }
  }

  async function search(term = q) {
    const t = term.trim();
    if (t.length < 2) return;
    setState({ kind: "loading" });
    try {
      const items = await searchMembers(t);
      if (items.length === 0) setState({ kind: "not_found", q: t });
      else if (items.length === 1 && items[0]) await check(items[0].id);
      else setState({ kind: "matches", items });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message, retry: () => search(t) });
    }
  }

  function onScan(text: string) {
    setScanning(false);
    const id = text.startsWith("OGV:") ? text.slice(4) : text;
    if (UUID.test(id)) check(id);
    else {
      setQ(text);
      search(text);
    }
  }

  function reset() {
    setQ("");
    setState({ kind: "idle" });
    inputRef.current?.focus();
  }

  return (
    <div className="mx-auto max-w-3xl animate-rise">
      <h1 className="text-2xl font-semibold sm:text-[28px]">Verify membership</h1>
      <p className="mt-1 text-sm text-muted-foreground">Search by member ID, name, email or phone — or scan the member's pass.</p>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="OGV-00124, name, email or phone"
            className="h-14 pl-11 pr-10 text-base"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Search member"
          />
          {q && (
            <button type="button" onClick={reset} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear">
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button type="submit" className="h-14 px-6" disabled={q.trim().length < 2 || state.kind === "loading"}>
          {state.kind === "loading" ? <Loader2 className="animate-spin" /> : "Check"}
        </Button>
        <Button type="button" variant="outline" className="h-14 w-14 p-0" onClick={() => setScanning(true)} aria-label="Scan QR code">
          <Camera className="size-5" />
        </Button>
      </form>

      {scanning && <Scanner onResult={onScan} onClose={() => setScanning(false)} />}

      <div className="mt-6">
        {state.kind === "idle" && (
          <div className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
            Results come from the live membership record. Never admit based on a screenshot.
          </div>
        )}
        {state.kind === "loading" && (
          <div className="flex items-center justify-center gap-2 rounded-xl border px-6 py-14 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking membership…
          </div>
        )}
        {state.kind === "matches" && (
          <div className="panel">
            <p className="border-b px-5 py-3 text-sm text-muted-foreground">{state.items.length} members match — choose one</p>
            <ul>
              {state.items.map((m) => (
                <li key={m.id}>
                  <button onClick={() => check(m.id)} className="flex w-full items-center gap-3 border-b px-5 py-3.5 text-left last:border-0 hover:bg-muted/60">
                    <Avatar name={m.full_name} url={m.photo_url} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{m.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{m.member_code}</span> · {m.email} · {m.phone}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {state.kind === "not_found" && <DecisionBanner decision="not_found" onReset={reset} />}
        {state.kind === "error" && (
          <DecisionBanner decision="error" onReset={reset} extra={<Button variant="outline" onClick={state.retry}>Retry</Button>} />
        )}
        {state.kind === "result" && <Result data={state.data} onReset={reset} />}
      </div>
    </div>
  );
}

function Avatar({ name, url, large }: { name: string; url?: string | null; large?: boolean }) {
  const size = large ? "size-20 text-xl" : "size-10 text-sm";
  return url ? (
    <img src={url} alt="" className={cn("rounded-full object-cover", size)} />
  ) : (
    <div className={cn("grid shrink-0 place-items-center rounded-full bg-secondary font-semibold", size)}>{initials(name)}</div>
  );
}

function DecisionBanner({
  decision,
  onReset,
  extra,
}: {
  decision: keyof typeof DECISION;
  onReset: () => void;
  extra?: React.ReactNode;
}) {
  const d = DECISION[decision];
  const Icon = d.icon;
  return (
    <div role="alert" aria-live="assertive" className={cn("rounded-xl px-6 py-7 animate-rise", d.surface)}>
      <div className="flex items-start gap-4">
        <Icon className="size-10 shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">{d.title}</p>
          <p className="mt-1.5 text-sm opacity-90">{d.detail}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {extra}
        <Button variant="outline" onClick={onReset} className="border-current/30 bg-transparent text-current hover:bg-background/15 hover:text-current">
          <RotateCcw /> Next member
        </Button>
      </div>
    </div>
  );
}

function Result({ data, onReset }: { data: VerifyResult; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <DecisionBanner decision={data.decision} onReset={onReset} />
      <div className="panel p-5">
        <div className="flex items-center gap-4">
          <Avatar name={data.full_name} url={data.photo_url} large />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold">{data.full_name}</p>
            <p className="font-mono text-sm text-muted-foreground">{data.member_code}</p>
          </div>
          <StatusBadge status={data.status} className="text-sm" />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Plan</dt>
            <dd className="mt-0.5 font-medium">{data.plan_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{data.status === "expired" ? "Expired on" : "Expires"}</dt>
            <dd className="mt-0.5 font-medium tabular">{data.expires_at ? fmtLongDate(data.expires_at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd className="mt-0.5 font-medium">{data.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Last checked</dt>
            <dd className="mt-0.5 font-medium">{data.last_verified ? relative(data.last_verified) : "First check"}</dd>
          </div>
        </dl>
        {(data.access_reason || data.pending_requests > 0) && (
          <div className="mt-4 space-y-2">
            {data.access_reason && (
              <p className="rounded-md bg-suspended-soft px-3 py-2 text-sm text-suspended">Reason: {data.access_reason}</p>
            )}
            {data.pending_requests > 0 && (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
                A renewal payment is awaiting verification. It does not grant entry until approved.
              </p>
            )}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <span>Checked {fmtDateTime(data.checked_at)} · recorded</span>
          <Link to="/admin/members/$id" params={{ id: data.member_id }} className="font-medium text-foreground underline underline-offset-4">
            Open profile
          </Link>
        </div>
      </div>
    </div>
  );
}

function Scanner({ onResult, onClose }: { onResult: (t: string) => void; onClose: () => void }) {
  const [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (stopped) return;
      const s = new Html5Qrcode("qr-reader");
      scanner = s;
      try {
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (text) => {
            if (stopped) return;
            stopped = true;
            s.stop().finally(() => onResult(text));
          },
          () => {},
        );
      } catch {
        setError("Camera unavailable. Allow camera access, or search by member ID instead.");
      }
    });
    return () => {
      stopped = true;
      scanner?.stop().catch(() => {});
    };
  }, [onResult]);
  return (
    <div className="panel mt-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Point the camera at the member's pass</p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div id="qr-reader" className="mx-auto max-w-sm overflow-hidden rounded-lg bg-muted" />
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
