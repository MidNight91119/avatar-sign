// Small inline icons used on the landing page. Decorative: always aria-hidden.

export const ArrowRight = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

export const ArrowUpRight = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17L17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

export const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const Play = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.5v15l12.5-7.5z" fill="#fff" />
  </svg>
);
