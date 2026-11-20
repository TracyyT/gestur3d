/** Shown while a lazy route chunk loads. Deliberately quiet. */
export function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="grid min-h-dvh place-items-center bg-void">
      <span className="sr-only">Loading</span>
      <span
        aria-hidden
        className="size-6 animate-spin rounded-full border border-holo-cyan/20 border-t-holo-cyan"
      />
    </div>
  );
}
