import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { REQUIRED_TASKS, type TaskId } from '@/core/practice/tasks';

interface PracticeState {
  /** Tasks done at least once, in the order they were done. */
  done: TaskId[];
  complete: (ids: TaskId[]) => void;
  reset: () => void;
}

export const usePractice = create<PracticeState>()(
  persist(
    (set) => ({
      done: [],
      complete: (ids) =>
        set((s) => ({ done: [...s.done, ...ids.filter((id) => !s.done.includes(id))] })),
      reset: () => set({ done: [] }),
    }),
    { name: 'gestur3d-practice', version: 2, migrate: () => ({ done: [] }) },
  ),
);

/** Every required task done. */
export function practiceDone(done: readonly TaskId[]): boolean {
  return REQUIRED_TASKS.every((id) => done.includes(id));
}
