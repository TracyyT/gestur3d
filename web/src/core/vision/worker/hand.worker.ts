/**
 * Hand detection off the main thread, as a module worker. The MediaPipe
 * runtime is loaded by loadVisionRuntime (see there for why). GPU inference
 * runs on an OffscreenCanvas.
 */
import { HandLandmarker } from '@mediapipe/tasks-vision';
import { loadVisionRuntime } from '../mediapipeRuntime';
import type { FromWorker, ToWorker } from './protocol';

interface WorkerScope {
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
  close(): void;
}
const scope = self as unknown as WorkerScope;

let landmarker: HandLandmarker | null = null;

async function init(baseUrl: string, numHands: number, preferGpu: boolean) {
  const runtime = await loadVisionRuntime(baseUrl);
  const create = (delegate: 'GPU' | 'CPU') => {
    runtime.arm();
    return HandLandmarker.createFromOptions(runtime.fileset, {
      baseOptions: { modelAssetPath: `${baseUrl}/hand_landmarker.task`, delegate },
      canvas: delegate === 'GPU' ? new OffscreenCanvas(1, 1) : undefined,
      runningMode: 'VIDEO',
      numHands,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
  };
  if (preferGpu) {
    try {
      landmarker = await create('GPU');
      return 'GPU' as const;
    } catch {
      // fall through to CPU
    }
  }
  landmarker = await create('CPU');
  return 'CPU' as const;
}

scope.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    init(msg.baseUrl, msg.numHands, msg.preferGpu)
      .then((delegate) => scope.postMessage({ type: 'ready', delegate }))
      .catch((err: unknown) =>
        scope.postMessage({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    return;
  }
  if (msg.type === 'close') {
    landmarker?.close();
    scope.close();
    return;
  }
  // frame
  const { bitmap, timestamp, captureTime } = msg;
  if (!landmarker) {
    bitmap.close();
    return;
  }
  const t0 = performance.now();
  const result = landmarker.detectForVideo(bitmap, timestamp);
  const detectionMs = performance.now() - t0;
  bitmap.close();

  const n = result.landmarks.length;
  const image = new Float32Array(n * 63);
  const world = new Float32Array(n * 63);
  for (let h = 0; h < n; h++) {
    result.landmarks[h]!.forEach((p, i) => image.set([p.x, p.y, p.z], h * 63 + i * 3));
    (result.worldLandmarks[h] ?? []).forEach((p, i) => world.set([p.x, p.y, p.z], h * 63 + i * 3));
  }
  scope.postMessage(
    {
      type: 'result',
      timestamp,
      captureTime,
      detectionMs,
      handedness: result.handedness.map((c) => ({
        label: c[0]?.categoryName ?? 'Right',
        score: c[0]?.score ?? 0,
      })),
      image,
      world,
    },
    [image.buffer, world.buffer],
  );
};
