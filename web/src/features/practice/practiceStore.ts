import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LESSONS, REQUIRED_LESSONS } from '@/core/practice/lessons';

interface PracticeState {
  /** Index into LESSONS, or LESSONS.length for free practice. */
  current: number;
  /** Lesson ids passed at least once. */
  completed: string[];
  /** Lesson ids skipped (and not passed since). */
  skipped: string[];
  goTo: (index: number) => void;
  complete: (id: string) => void;
  skip: (id: string) => void;
  restart: () => void;
}

export const usePractice = create<PracticeState>()(
  persist(
    (set) => ({
      current: 0,
      completed: [],
      skipped: [],
      goTo: (index) => set({ current: Math.max(0, Math.min(LESSONS.length, index)) }),
      complete: (id) =>
        set((s) => ({
          completed: s.completed.includes(id) ? s.completed : [...s.completed, id],
          skipped: s.skipped.filter((x) => x !== id),
        })),
      skip: (id) =>
        set((s) => ({
          skipped:
            s.completed.includes(id) || s.skipped.includes(id) ? s.skipped : [...s.skipped, id],
        })),
      restart: () => set({ current: 0 }),
    }),
    { name: 'gestur3d-practice', version: 1 },
  ),
);

/** Every required lesson passed. */
export function practiceDone(completed: readonly string[]): boolean {
  return REQUIRED_LESSONS.every((l) => completed.includes(l.id));
}
