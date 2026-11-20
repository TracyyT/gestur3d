/** CSS-only stand-in for the 3D hero (no WebGL, or while the scene loads). */
export function HeroFallback() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 size-[min(70vw,560px)] -translate-x-1/2 -translate-y-1/2 md:left-[68%]">
        <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_50%_45%,rgb(155_123_255/0.35),transparent_60%)] blur-2xl" />
        <div className="absolute inset-[30%] rounded-full border border-holo-cyan/25 shadow-[inset_0_0_60px_rgb(94_231_255/0.15)]" />
        <div className="absolute inset-[8%] rotate-[18deg] scale-y-[0.32] rounded-full border border-holo-cyan/30" />
      </div>
    </div>
  );
}
