import type { ReactNode } from "react";

// Small shared pieces for the side panel. Icons are 20px, drawn with currentColor.

const svg = (children: ReactNode, filled = false) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
    fill={filled ? "currentColor" : "none"}
    stroke={filled ? "none" : "currentColor"}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const Icons = {
  hand: () =>
    svg(
      <>
        <rect x="6.5" y="4" width="2.4" height="9" rx="1.2" />
        <rect x="9.5" y="2.5" width="2.4" height="10.5" rx="1.2" />
        <rect x="12.5" y="3" width="2.4" height="10" rx="1.2" />
        <rect x="15.5" y="5" width="2.4" height="8.5" rx="1.2" />
        <path d="M6.5 11h11.4v3.5a6 6 0 0 1-6 6h-.3a5.6 5.6 0 0 1-4.6-2.4L4 14.6a1.4 1.4 0 0 1 2.1-1.8l.4.4z" />
      </>,
      true,
    ),
  sliders: () =>
    svg(
      <>
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="17" r="2" />
      </>,
    ),
  back: () => svg(<path d="M15 18l-6-6 6-6" />),
  chevron: () => svg(<path d="M9 6l6 6-6 6" />),
  play: () =>
    svg(
      <>
        <rect x="3" y="5" width="18" height="14" rx="4" />
        <path d="M10.5 9.5v5l4-2.5z" fill="currentColor" />
      </>,
    ),
  alert: () =>
    svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5h.01" />
      </>,
    ),
};

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Row({ label, hint, children }: { label: ReactNode; hint?: string; children?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <span className="row-label">{label}</span>
        {hint && <span className="row-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
