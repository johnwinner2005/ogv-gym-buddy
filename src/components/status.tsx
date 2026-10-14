import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Clock,
  HelpCircle,
  MessageCircleQuestion,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TimerOff,
  UserX,
  WifiOff,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Decision } from "@/lib/api";

type Tone = "success" | "danger" | "warning" | "suspended" | "neutral" | "info";

const toneClass: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  warning: "bg-warning-soft text-warning-foreground border-warning/25",
  suspended: "bg-suspended-soft text-suspended border-suspended/25",
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info-soft text-info border-info/20",
};

export const STATUS: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  active: { label: "Active", tone: "success", icon: CircleCheck },
  expired: { label: "Expired", tone: "danger", icon: TimerOff },
  suspended: { label: "Suspended", tone: "suspended", icon: Ban },
  cancelled: { label: "Cancelled", tone: "neutral", icon: CircleSlash },
  none: { label: "Not activated", tone: "neutral", icon: CircleDashed },
  scheduled: { label: "Starts later", tone: "info", icon: Clock },
  pending: { label: "Pending review", tone: "warning", icon: Clock },
  clarification: { label: "Needs info", tone: "info", icon: MessageCircleQuestion },
  approved: { label: "Approved", tone: "success", icon: CircleCheck },
  rejected: { label: "Rejected", tone: "danger", icon: XCircle },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as Tone, icon: HelpCircle };
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[s.tone],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {s.label}
    </span>
  );
}

export const DECISION: Record<
  Decision | "error",
  { title: string; detail: string; icon: LucideIcon; surface: string; allowed: boolean }
> = {
  granted: {
    title: "Access granted",
    detail: "Membership is active. The member can enter.",
    icon: ShieldCheck,
    surface: "bg-success text-primary-foreground",
    allowed: true,
  },
  expired: {
    title: "Membership expired",
    detail: "Entry is denied. Direct the member to renew from their dashboard or at the desk.",
    icon: ShieldX,
    surface: "bg-danger text-primary-foreground",
    allowed: false,
  },
  suspended: {
    title: "Access suspended",
    detail: "An administrator has suspended this membership. Entry is denied.",
    icon: ShieldAlert,
    surface: "bg-suspended text-primary-foreground stripes-suspended",
    allowed: false,
  },
  cancelled: {
    title: "Membership cancelled",
    detail: "This membership was cancelled. Entry is denied.",
    icon: CircleSlash,
    surface: "bg-suspended text-primary-foreground",
    allowed: false,
  },
  no_membership: {
    title: "No active membership",
    detail: "This account has never been activated. Entry is denied until a plan is activated.",
    icon: CircleDashed,
    surface: "bg-primary text-primary-foreground",
    allowed: false,
  },
  not_found: {
    title: "Member not found",
    detail: "No member matches this search. Check the spelling or ask for their member ID.",
    icon: UserX,
    surface: "bg-muted text-foreground border border-border",
    allowed: false,
  },
  error: {
    title: "Unable to verify",
    detail: "The membership could not be checked. Do not admit on this result. Retry, or check the connection.",
    icon: WifiOff,
    surface: "bg-warning-soft text-warning-foreground border border-warning/40",
    allowed: false,
  },
};

export function EmptyState({
  icon: Icon = CircleDashed,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <WifiOff className="mb-2 size-5 text-danger" aria-hidden />
      <p className="text-sm font-medium">Couldn't load this</p>
      <p className="mt-1 text-sm text-muted-foreground">{(error as Error)?.message ?? "Unknown error"}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 text-sm font-medium underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "danger" | "warning" | "success";
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        {tone && (
          <span
            className={cn(
              "size-1.5 rounded-full",
              tone === "danger" && "bg-danger",
              tone === "warning" && "bg-warning",
              tone === "success" && "bg-success",
            )}
          />
        )}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular">{value}</p>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "grid size-8 place-items-center rounded-md font-display text-[13px] font-bold",
          inverted ? "bg-ink-foreground text-ink" : "bg-primary text-primary-foreground",
        )}
      >
        OGV
      </div>
      <div className="leading-none">
        <div className="font-display text-[15px] font-semibold">OGV Gym</div>
        <div className={cn("mt-0.5 text-[10px] tracking-[0.18em] uppercase", inverted ? "text-ink-muted" : "text-muted-foreground")}>
          Membership
        </div>
      </div>
    </div>
  );
}
