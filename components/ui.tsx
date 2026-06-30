import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function buttonClasses(tone: "default" | "secondary" | "ghost" = "default") {
  return cx(
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
    tone === "default" && "bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]",
    tone === "secondary" &&
      "border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--text-main)] hover:border-[var(--line-strong)]",
    tone === "ghost" && "bg-transparent text-[var(--text-soft)] hover:text-[var(--text-main)]",
  );
}

export function Button({
  className,
  tone = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "secondary" | "ghost";
}) {
  return (
    <button
      className={cx(buttonClasses(tone), className)}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  tone = "default",
  className,
  children,
}: PropsWithChildren<{
  href: string;
  tone?: "default" | "secondary" | "ghost";
  className?: string;
}>) {
  return (
    <Link href={href} className={cx(buttonClasses(tone), className)}>
      {children}
    </Link>
  );
}

export function Panel({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cx(
        "rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="grid gap-2 text-sm text-[var(--text-soft)]">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {hint ? <span className="text-xs text-[var(--text-dim)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]"
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="min-h-[120px] w-full rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 text-sm leading-7 text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]"
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]"
      {...props}
    />
  );
}

export function Badge({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
