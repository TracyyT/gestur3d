interface Sample {
  t: number;
  d: number | undefined;
}

/**
 * Rolling rate and duration meter over a fixed time window.
 * Used for detection FPS / latency now, and render FPS in the HUD.
 */
export class RateMeter {
  private readonly windowMs: number;
  private samples: Sample[] = [];

  constructor(windowMs = 1000) {
    this.windowMs = windowMs;
  }

  /** Record one event at `now` (ms), optionally with how long it took. */
  tick(now: number, durationMs?: number) {
    this.samples.push({ t: now, d: durationMs });
    this.trim(now);
  }

  private trim(now: number) {
    const cutoff = now - this.windowMs;
    let drop = 0;
    while (drop < this.samples.length && this.samples[drop]!.t < cutoff) drop++;
    if (drop) this.samples.splice(0, drop);
  }

  /** Events per second over the window. */
  rate(now: number): number {
    this.trim(now);
    if (this.samples.length < 2) return 0;
    const span = this.samples[this.samples.length - 1]!.t - this.samples[0]!.t;
    return span > 0 ? ((this.samples.length - 1) / span) * 1000 : 0;
  }

  /** Mean recorded duration over the window, ms. */
  meanDuration(): number {
    let sum = 0;
    let n = 0;
    for (const s of this.samples) {
      if (s.d !== undefined) {
        sum += s.d;
        n++;
      }
    }
    return n ? sum / n : 0;
  }

  reset() {
    this.samples = [];
  }
}
