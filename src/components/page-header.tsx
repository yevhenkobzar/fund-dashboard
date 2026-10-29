import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {kicker ? <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-brass">{kicker}</p> : null}
        <h1 className="mt-1 font-serif text-3xl tracking-tight md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Flash({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <p className={cn("mb-4 rounded-md border px-3 py-2 text-sm", error ? "border-danger/30 bg-[#f8ece8] text-danger" : "border-positive/30 bg-[#eef5f0] text-positive")}>
      {error || success}
    </p>
  );
}

export function ExampleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mb-6 rounded-md border border-[#e0c9a4] bg-[#f8f1e3] px-4 py-3 text-sm leading-6 text-[#6a4b24]">
      These figures are illustrative example data. Void the sample trades, or seed with SEED_EXAMPLE_DATA=false, before treating the book as the fund.
    </div>
  );
}

export function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-4 md:p-5", className)}>
      {title ? <h2 className="mb-3 font-serif text-xl">{title}</h2> : null}
      {children}
    </section>
  );
}
