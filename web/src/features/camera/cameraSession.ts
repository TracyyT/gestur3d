import { create } from 'zustand';
import {
  CameraError,
  listCameras,
  openCamera,
  stopStream,
  type CameraDevice,
} from '@/core/vision/camera';
import { useSettings } from '@/stores/settings';

export type CameraStatus = 'off' | 'starting' | 'on' | 'error';

interface CameraSessionState {
  status: CameraStatus;
  stream: MediaStream | null;
  deviceId: string | null;
  devices: CameraDevice[];
  error: CameraError | null;
  start: (deviceId?: string | null) => Promise<void>;
  switchDevice: (deviceId: string) => Promise<void>;
  stop: () => void;
  refreshDevices: () => Promise<void>;
}

/**
 * The one live camera stream for the app. Lives outside React so the setup
 * screen and the workspace share it without reopening the camera.
 * The stream is never recorded, stored or uploaded.
 */
export const useCameraSession = create<CameraSessionState>()((set, get) => ({
  status: 'off',
  stream: null,
  deviceId: null,
  devices: [],
  error: null,

  start: async (deviceId) => {
    const preferred = deviceId ?? useSettings.getState().preferredCameraId;
    stopStream(get().stream);
    set({ status: 'starting', error: null, stream: null });
    try {
      let stream: MediaStream;
      try {
        stream = await openCamera({ deviceId: preferred });
      } catch (err) {
        // A remembered camera may be gone (unplugged); retry with the default.
        if (preferred && err instanceof CameraError && err.kind === 'not-found') {
          stream = await openCamera();
        } else {
          throw err;
        }
      }
      const actualId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
      set({ status: 'on', stream, deviceId: actualId });
      if (actualId) useSettings.getState().set('preferredCameraId', actualId);
      // Labels only become available after permission is granted.
      await get().refreshDevices();
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof CameraError ? err : new CameraError('unknown', String(err)),
      });
    }
  },

  switchDevice: async (deviceId) => {
    if (deviceId === get().deviceId) return;
    await get().start(deviceId);
  },

  stop: () => {
    stopStream(get().stream);
    set({ status: 'off', stream: null, error: null });
  },

  refreshDevices: async () => {
    try {
      set({ devices: await listCameras() });
    } catch {
      set({ devices: [] });
    }
  },
}));
