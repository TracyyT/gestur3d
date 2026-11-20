/** Gestur3D mark: a hexagonal prism outline with a holographic gradient. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="g3d-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-holo-cyan)" />
          <stop offset="1" stopColor="var(--color-holo-violet)" />
        </linearGradient>
      </defs>
      <path
        d="M16 4l10.4 6v12L16 28 5.6 22V10z"
        fill="none"
        stroke="url(#g3d-logo)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 4v24M5.6 10l20.8 12M26.4 10L5.6 22"
        stroke="url(#g3d-logo)"
        strokeWidth="0.9"
        opacity="0.45"
      />
    </svg>
  );
}
