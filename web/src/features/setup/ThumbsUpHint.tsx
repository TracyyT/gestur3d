import { THUMBS_UP_HOLD_MS } from './useThumbsUpHold';

function ThumbIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      <path
        d="M7 10.5V20H4.5A1.5 1.5 0 013 18.5v-6.5A1.5 1.5 0 014.5 10.5H7zm0 0l3.6-6.3a1.6 1.6 0 012.9 1.1L12.8 9h5.4a2 2 0 012 2.3l-1.1 6.8a2.2 2.2 0 01-2.2 1.9H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const seconds = (THUMBS_UP_HOLD_MS / 1000).toLocaleString();

/** Instruction + progress next to the Enter button. */
export function ThumbsUpHint({ progress }: { progress: number }) {
  const holding = progress > 0;
  return (
    <div className="rounded-xl border border-holo-cyan/20 bg-holo-cyan/[0.05] p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-holo-cyan/10 text-holo-cyan">
          <ThumbIcon className="size-4" />
        </span>
        <p className="text-[12.5px] leading-snug text-ink-2" aria-live="polite">
          {holding ? (
            <span className="text-ink-1">Keep holding…</span>
          ) : (
            <>
              <span className="text-ink-1">Hands full?</span> Hold a thumbs-up for {seconds} second
              {seconds === '1' ? '' : 's'} to enter.
            </>
          )}
        </p>
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-label="Thumbs-up hold"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="h-full rounded-full bg-holo-cyan shadow-[0_0_10px_var(--color-holo-cyan)]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Badge over the camera preview, where the user is looking while they pose. */
export function ThumbsUpPreviewBadge({ progress }: { progress: number }) {
  if (progress <= 0) return null;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div aria-hidden className="absolute bottom-4 left-1/2 -translate-x-1/2">
      <div className="glass flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5">
        <span className="relative grid size-9 place-items-center text-holo-cyan">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r={r}
              fill="none"
              stroke="rgb(255 255 255 / 0.1)"
              strokeWidth="2.5"
            />
            <circle
              cx="18"
              cy="18"
              r={r}
              fill="none"
              stroke="var(--color-holo-cyan)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - progress)}
            />
          </svg>
          <ThumbIcon className="size-4" />
        </span>
        <span className="text-[13px] text-ink-1">Entering workspace…</span>
      </div>
    </div>
  );
}
