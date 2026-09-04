import type { CSSProperties, ReactNode } from "react";

/**
 * Console design language, carried over from the demo repo's management view
 * so the two products read as one system.
 *
 * Rules the whole console obeys:
 *  • A closed type scale — 10 (eyebrow) / 11 (meta) / 12 (body) / 13 (block
 *    title) / 18 (page title), plus 16 and 24 for figures. Nothing else.
 *  • One level of card. Never a card inside a card.
 *  • Emerald carries state, not decoration. One primary action per group.
 *  • Rules separate real groups; boxes do not.
 *
 * These are server components: the admin console is read-mostly, and shipping
 * this as client JS would buy nothing.
 */

export const TYPE = {
  h1: "font-sans text-[18px] font-semibold tracking-[-0.015em] text-[var(--edl-text)]",
  h2: "font-sans text-[13px] font-semibold tracking-[-0.005em] text-[var(--edl-text)]",
  body: "font-sans text-[12px] leading-relaxed text-[var(--edl-text-soft)]",
  meta: "font-sans text-[11px] text-[var(--edl-muted)]",
  eyebrow:
    "font-sans text-[10px] font-medium uppercase tracking-[0.11em] text-[var(--edl-muted)]",
  num: "font-sans text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--edl-text)]",
  numSm:
    "font-sans text-[16px] font-semibold leading-none tabular-nums text-[var(--edl-text)]",
  code: "font-mono text-[11px] tabular-nums text-[var(--edl-text-soft)]",
} as const;

/** Four tones, no more. `fg` carries the meaning; the rest are rare fills. */
export type Tone = "neutral" | "positive" | "attention" | "critical";

export const TONE: Record<Tone, { fg: string; soft: string; line: string }> = {
  neutral: {
    fg: "var(--edl-muted)",
    soft: "var(--edl-soft)",
    line: "var(--edl-border)",
  },
  positive: {
    fg: "var(--edl-emerald)",
    soft: "var(--edl-emerald-10)",
    line: "var(--edl-emerald-30)",
  },
  attention: {
    fg: "var(--edl-gold)",
    soft: "var(--edl-gold-10)",
    line: "var(--edl-gold-40)",
  },
  critical: {
    fg: "var(--edl-danger)",
    soft: "var(--edl-danger-10)",
    line: "var(--edl-danger-30)",
  },
};

export function Page({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-col gap-4 ${className}`}>{children}</div>;
}

/** One title, one line of intent, then the action. Nothing above it. */
export function PageHeader({
  title,
  purpose,
  children,
}: {
  title: string;
  purpose: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className={TYPE.h1}>{title}</h1>
        <p className="mt-1 max-w-[62ch] font-sans text-[12px] leading-relaxed text-[var(--edl-muted)]">
          {purpose}
        </p>
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}

export function Card({
  children,
  className = "",
  style,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={`console-card ${className}`} style={style}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  hint,
  children,
  divided = true,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
  divided?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 ${
        divided ? "border-b border-[var(--edl-border)]" : ""
      }`}
    >
      <div className="min-w-0">
        <h2 className={TYPE.h2}>{title}</h2>
        {hint ? <p className={`mt-0.5 ${TYPE.meta}`}>{hint}</p> : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

/** A dot and a word. Never a coloured badge on every row. */
export function Status({
  tone,
  label,
  className = "",
}: {
  tone: Tone;
  label: string;
  className?: string;
}) {
  const color = TONE[tone].fg;
  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 font-sans text-[11px] font-medium ${className}`}
      style={{ color }}
    >
      <span
        className="h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Headline figure with its label. The only place 24px type appears. */
export function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <p className={TYPE.eyebrow}>{label}</p>
      <p
        className={`mt-2 ${TYPE.num}`}
        style={tone ? { color: TONE[tone].fg } : undefined}
      >
        {value}
      </p>
      {hint ? <p className={`mt-1.5 ${TYPE.meta}`}>{hint}</p> : null}
    </div>
  );
}

/**
 * Metric strip.
 *
 * Rules between cells rather than separate cards: these figures are one
 * reading of one system, not four unrelated facts.
 */
export function MetricRow({ children }: { children: ReactNode }) {
  return (
    <Card className="grid grid-cols-2 divide-x divide-y divide-[var(--edl-border)] sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
      {children}
    </Card>
  );
}

/** Label left, value right, one rule. The console's fact sheet row. */
export function SpecRow({
  label,
  value,
  hint,
  children,
  mono = false,
}: {
  label: string;
  value?: string;
  hint?: string;
  children?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--edl-border)] py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="font-sans text-[12px] text-[var(--edl-muted)]">{label}</p>
        {hint ? (
          <p className="mt-0.5 font-sans text-[11px] leading-snug text-[var(--edl-muted)]">
            {hint}
          </p>
        ) : null}
      </div>
      {children ?? (
        <p
          className={`shrink-0 ${
            mono
              ? "font-mono text-[11px] text-[var(--edl-text)]"
              : "font-sans text-[12px] font-medium text-[var(--edl-text)]"
          } tabular-nums`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

/** Thin gauge. One job: give a proportion at a glance. */
export function Meter({
  value,
  tone = "positive",
}: {
  value: number;
  tone?: Tone;
}) {
  return (
    <span className="block h-[3px] w-full overflow-hidden rounded-full bg-[var(--edl-border)]">
      <span
        className="block h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(2, value))}%`,
          background: TONE[tone].fg,
        }}
      />
    </span>
  );
}

/** Dense table shell. Sticky head so long fleets stay legible while scrolling. */
export function Table({
  head,
  children,
  empty,
}: {
  head: readonly string[];
  children: ReactNode;
  empty?: string;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);

  if (!hasRows && empty) {
    return (
      <p className="px-4 py-8 text-center font-sans text-[12px] text-[var(--edl-muted)]">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {head.map((label) => (
              <th
                key={label}
                scope="col"
                className={`sticky top-0 z-10 whitespace-nowrap border-b border-[var(--edl-border)] bg-[var(--edl-bg)] px-4 py-2.5 text-left ${TYPE.eyebrow}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-[var(--edl-border)] transition-colors last:border-0 hover:bg-[var(--edl-soft)]">
      {children}
    </tr>
  );
}

export function Cell({
  children,
  mono = false,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  mono?: boolean;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-2.5 ${
        mono
          ? "font-mono text-[11px] text-[var(--edl-text-soft)]"
          : "font-sans text-[12px] text-[var(--edl-text-soft)]"
      } ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * Empty state that says what to do, not just that there is nothing.
 *
 * A fresh install shows a lot of these, and "No data" would leave an operator
 * with no idea whether something is broken or simply not started.
 */
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <p className={TYPE.h2}>{title}</p>
      <p className="max-w-[46ch] font-sans text-[12px] leading-relaxed text-[var(--edl-muted)]">
        {detail}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
