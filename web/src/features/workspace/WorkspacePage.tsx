import { ModeShell } from '@/features/modes/ModeShell';

/** Workspace mode: free building with shapes and drawings (model import comes in M8). */
export function WorkspacePage() {
  return (
    <ModeShell
      mode="workspace"
      sceneLabel="3D workspace. Press Tab to select objects, question mark for controls."
    />
  );
}
