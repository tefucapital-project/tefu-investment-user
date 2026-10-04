import { useRef, type ReactNode } from "react";
import { statusTone } from "../lib/labels";

export const inputClass =
  "w-full rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-canopy focus:ring-2 focus:ring-gold/40 disabled:bg-cream";

const buttonStyles = {
  primary: "bg-forest text-gold2 hover:bg-canopy",
  secondary: "border border-line bg-paper text-ink hover:bg-cream",
  ghost: "text-forest hover:bg-forest/5",
  danger: "bg-danger text-white hover:bg-danger/90",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  hint,
  error,
  autoComplete,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        className={inputClass}
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className="mt-1 block text-xs leading-5 text-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <select className={inputClass} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea className={inputClass} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function CheckField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 text-sm leading-6">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-forest"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

export function Banner({ tone = "warn", children }: { tone?: "warn" | "danger" | "ok" | "neutral"; children: ReactNode }) {
  const styles = {
    warn: "border-gold/40 bg-gold2/40 text-ink",
    danger: "border-danger/30 bg-danger/10 text-danger",
    ok: "border-ok/30 bg-ok/10 text-ok",
    neutral: "border-line bg-cream text-ink",
  };
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${styles[tone]}`}>{children}</div>;
}

export function Pill({ status, children }: { status: string; children?: ReactNode }) {
  const tone = statusTone(status);
  const styles = {
    ok: "bg-ok/10 text-ok",
    warn: "bg-gold/15 text-warn",
    danger: "bg-danger/10 text-danger",
    neutral: "bg-cream text-muted",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{children ?? status}</span>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4" role="dialog" aria-modal="true">
      <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-3xl bg-paper p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-serif text-2xl text-forest">{title}</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink">{children}</div>
      </div>
    </div>
  );
}

export function PageTitle({ eyebrow, title, lede, action }: { eyebrow?: string; title: string; lede?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">{eyebrow}</p> : null}
        <h1 className="mt-1 font-serif text-3xl text-forest md:text-4xl">{title}</h1>
        {lede ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-2xl text-forest">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-paper px-5 py-8 text-center">
      <p className="font-serif text-xl text-forest">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

export function OtpBoxes({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length: 6 }, (_, index) => value[index] ?? "");
  const write = (next: string) => onChange(next.replace(/\D/g, "").slice(0, 6));
  return (
    <div className="flex gap-2">
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          className="h-12 w-11 rounded-2xl border border-line bg-white text-center font-serif text-xl outline-none focus:border-canopy focus:ring-2 focus:ring-gold/40"
          value={char}
          aria-label={`Digit ${index + 1}`}
          onChange={(event) => {
            const digit = event.target.value.replace(/\D/g, "").slice(-1);
            const next = `${value.slice(0, index)}${digit}${value.slice(index + 1)}`.replace(/\D/g, "").slice(0, 6);
            write(next);
            if (digit && refs.current[index + 1]) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !chars[index] && refs.current[index - 1]) refs.current[index - 1]?.focus();
          }}
          onPaste={(event) => {
            event.preventDefault();
            write(event.clipboardData.getData("text"));
          }}
        />
      ))}
    </div>
  );
}

export function Mark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path fill="currentColor" d="M16 3.2 19.2 12.8 28.8 16 19.2 19.2 16 28.8 12.8 19.2 3.2 16 12.8 12.8Z" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${light ? "bg-gold2 text-forest" : "bg-forest text-gold2"}`}>
        <Mark />
      </span>
      <span>
        <span className={`block font-serif text-lg leading-none ${light ? "text-white" : "text-forest"}`}>Tefu</span>
        <span className={`block text-[10px] uppercase tracking-[0.22em] ${light ? "text-gold2" : "text-muted"}`}>Investment</span>
      </span>
    </span>
  );
}
