/**
 * One Euro filter (Casiez, Roussel & Vogel, CHI 2012): a low-pass filter whose
 * cutoff rises with speed. Slow movement gets heavy smoothing (no jitter);
 * fast movement gets light smoothing (little lag). Uses real timestamps, so it
 * handles uneven detection rates.
 */
export interface OneEuroParams {
  /** Cutoff (Hz) at zero speed. Lower = steadier when still. */
  minCutoff: number;
  /** How fast the cutoff rises with speed. Higher = less lag when moving. */
  beta: number;
  /** Cutoff (Hz) for the derivative estimate. */
  dCutoff: number;
}

const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuroFilter {
  params: OneEuroParams;
  private x: number | null = null;
  private dx = 0;
  private t: number | null = null;

  constructor(params: OneEuroParams) {
    this.params = params;
  }

  /** Filter `value` sampled at `tMs` (milliseconds). */
  filter(value: number, tMs: number): number {
    if (this.x === null || this.t === null) {
      this.x = value;
      this.t = tMs;
      this.dx = 0;
      return value;
    }
    const dt = (tMs - this.t) / 1000;
    if (dt <= 0) return this.x;
    this.t = tMs;
    const { minCutoff, beta, dCutoff } = this.params;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(dCutoff, dt) * (rawDx - this.dx);
    const cutoff = minCutoff + beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  /** Forget history; the next sample passes through unfiltered. */
  reset() {
    this.x = null;
    this.t = null;
    this.dx = 0;
  }
}

/** Independent One Euro filters per component (e.g. x and y). */
export class OneEuroVec {
  private readonly filters: OneEuroFilter[];

  constructor(dims: number, params: OneEuroParams) {
    this.filters = Array.from({ length: dims }, () => new OneEuroFilter({ ...params }));
  }

  filter(values: readonly number[], tMs: number): number[] {
    return values.map((v, i) => this.filters[i]!.filter(v, tMs));
  }

  setParams(params: OneEuroParams) {
    for (const f of this.filters) f.params = { ...params };
  }

  reset() {
    for (const f of this.filters) f.reset();
  }
}

/**
 * Map the 0..1 "Tracking smoothing" setting to filter parameters for
 * camera-normalized coordinates (0..1 across the frame, speeds of ~0–3 /s).
 * Initial values; tuned against recorded jitter and lag measurements.
 */
export function smoothingToParams(smoothing: number): OneEuroParams {
  const s = Math.min(1, Math.max(0, smoothing));
  const lerp = (a: number, b: number) => a + (b - a) * s;
  return { minCutoff: lerp(3.0, 0.4), beta: lerp(25, 4), dCutoff: 1.0 };
}
