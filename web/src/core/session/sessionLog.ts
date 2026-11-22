import type { Command, InputSource } from '@/core/interaction/commands';

/**
 * A record of what happened in a session, for Practice and Playground
 * metrics and the gesture-vs-mouse study. Only actions and timings: never
 * video, images or landmarks. Continuous manipulation (dozens of commands a
 * second) is merged into one event per drag.
 */

export const SESSION_LOG_VERSION = 1;

/** Time in ms since the log started. */
interface Base {
  t: number;
}

export type ManipulationOp = 'move' | 'rotate' | 'scale' | 'transform';

export type SessionEvent = Base &
  (
    | { type: 'command'; source: InputSource; action: string; target?: string; detail?: string }
    | {
        type: 'manipulate';
        source: InputSource;
        op: ManipulationOp;
        target: string;
        durationMs: number;
        steps: number;
      }
    | { type: 'undo'; source: InputSource }
    | { type: 'menuOpen'; by: string }
    | { type: 'menuClose'; action?: string; choice?: string }
    | { type: 'mark'; name: string; detail?: string }
  );

type Distribute<T> = T extends unknown ? Omit<T, 't'> : never;
export type SessionEventInput = Distribute<SessionEvent>;

const CONTINUOUS: Partial<Record<Command['type'], ManipulationOp>> = {
  setPosition: 'move',
  translate: 'move',
  rotate: 'rotate',
  scaleBy: 'scale',
  setTransform: 'transform',
};

export interface SessionLogOptions {
  now?: () => number;
  /** Oldest events are dropped beyond this. */
  limit?: number;
  /** A pause longer than this starts a new manipulation event. */
  mergeGapMs?: number;
}

export class SessionLog {
  private readonly now: () => number;
  private readonly limit: number;
  private readonly mergeGapMs: number;
  private start: number;
  private startedAt: string;
  private list: SessionEvent[] = [];
  /** The manipulation event still open for merging, and when it was last extended. */
  private open: { event: Extract<SessionEvent, { type: 'manipulate' }>; last: number } | null =
    null;

  constructor(options: SessionLogOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.limit = options.limit ?? 20_000;
    this.mergeGapMs = options.mergeGapMs ?? 400;
    this.start = this.now();
    this.startedAt = new Date().toISOString();
  }

  get events(): readonly SessionEvent[] {
    return this.list;
  }

  private t() {
    return Math.round(this.now() - this.start);
  }

  add(e: SessionEventInput) {
    this.open = null;
    this.push({ t: this.t(), ...e } as SessionEvent);
  }

  private push(e: SessionEvent) {
    this.list.push(e);
    if (this.list.length > this.limit) this.list.splice(0, this.list.length - this.limit);
  }

  /** Record a scene command that changed the scene. */
  command(cmd: Command, source: InputSource) {
    const op = CONTINUOUS[cmd.type];
    if (op && 'id' in cmd && typeof cmd.id === 'string') {
      const t = this.t();
      const o = this.open;
      if (
        o &&
        o.event.target === cmd.id &&
        o.event.source === source &&
        o.event.op === op &&
        t - o.last <= this.mergeGapMs
      ) {
        o.event.durationMs = t - o.event.t;
        o.event.steps++;
        o.last = t;
        return;
      }
      const event: Extract<SessionEvent, { type: 'manipulate' }> = {
        t,
        type: 'manipulate',
        source,
        op,
        target: cmd.id,
        durationMs: 0,
        steps: 1,
      };
      this.push(event);
      this.open = { event, last: t };
      return;
    }
    this.add({ type: 'command', source, action: cmd.type, ...describe(cmd) });
  }

  clear() {
    this.list = [];
    this.open = null;
    this.start = this.now();
    this.startedAt = new Date().toISOString();
  }

  toJSON() {
    return { version: SESSION_LOG_VERSION, startedAt: this.startedAt, events: this.list };
  }

  toCSV(): string {
    const head = ['t_ms', 'type', 'source', 'action', 'target', 'duration_ms', 'steps', 'detail'];
    const rows = this.list.map((e) => {
      const r: Record<string, string | number | undefined> = { t_ms: e.t, type: e.type };
      switch (e.type) {
        case 'command':
          Object.assign(r, {
            source: e.source,
            action: e.action,
            target: e.target,
            detail: e.detail,
          });
          break;
        case 'manipulate':
          Object.assign(r, {
            source: e.source,
            action: e.op,
            target: e.target,
            duration_ms: e.durationMs,
            steps: e.steps,
          });
          break;
        case 'undo':
          r.source = e.source;
          break;
        case 'menuOpen':
          r.source = e.by;
          break;
        case 'menuClose':
          Object.assign(r, { action: e.action, detail: e.choice });
          break;
        case 'mark':
          Object.assign(r, { action: e.name, detail: e.detail });
          break;
      }
      return head.map((h) => csvCell(r[h])).join(',');
    });
    return [head.join(','), ...rows].join('\n') + '\n';
  }
}

/** Target and a short detail for discrete commands. Never stroke points. */
function describe(cmd: Command): { target?: string; detail?: string } {
  switch (cmd.type) {
    case 'select':
      return cmd.id ? { target: cmd.id } : {};
    case 'remove':
      return { target: cmd.id };
    case 'setColor':
      return { target: cmd.id, detail: cmd.color ?? 'default' };
    case 'add':
      return { detail: cmd.kind };
    case 'addStroke':
      return { detail: `${cmd.points.length} points` };
    case 'restore':
      return { target: cmd.object.id };
    case 'restoreMany':
      return { detail: `${cmd.items.length} objects` };
    case 'cycleSelection':
      return { detail: cmd.direction === 1 ? 'next' : 'previous' };
    default:
      return {};
  }
}

function csvCell(v: string | number | undefined): string {
  if (v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
