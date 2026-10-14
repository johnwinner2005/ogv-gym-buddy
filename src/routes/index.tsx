import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, QrCode, ReceiptText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/status";
import gym from "@/assets/gym-floor.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OGV Gym — Members" },
      { name: "description", content: "Check your OGV Gym membership, expiry date and renew online." },
      { property: "og:title", content: "OGV Gym — Members" },
      { property: "og:description", content: "Check your OGV Gym membership, expiry date and renew online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Join</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <section className="relative overflow-hidden rounded-xl ink-surface">
          <img src={gym} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <div className="relative grid gap-10 px-6 py-14 sm:px-12 sm:py-20 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="eyebrow text-ink-muted">OGV Gym · Members</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.05] sm:text-6xl">
                Your membership,
                <br />
                always up to date.
              </h1>
              <p className="mt-5 max-w-md text-ink-foreground/75">
                See your plan and expiry date, renew by uploading your transfer receipt, and show your pass at the
                front desk.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="ink">
                  <Link to="/register">
                    Create account <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-ink-border bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground">
                  <Link to="/auth">I already have an account</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, t: "Verified at the desk", d: "Staff check your live membership status — no paper cards." },
            { icon: ReceiptText, t: "Renew in minutes", d: "Pick a plan, pay by transfer, upload the receipt for review." },
            { icon: QrCode, t: "Your pass on your phone", d: "A personal QR code that staff scan at entry." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="panel p-5">
              <Icon className="size-5 text-brand" />
              <p className="mt-4 font-medium">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
