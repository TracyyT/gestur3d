/** Camera access helpers. Framework-free; the React layer wraps these. */

export type CameraErrorKind =
  'denied' | 'not-found' | 'in-use' | 'insecure' | 'unsupported' | 'unknown';

export class CameraError extends Error {
  readonly kind: CameraErrorKind;
  constructor(kind: CameraErrorKind, message: string) {
    super(message);
    this.name = 'CameraError';
    this.kind = kind;
  }
}

/** Map a getUserMedia failure to a user-facing category. */
export function classifyCameraError(err: unknown): CameraError {
  if (err instanceof CameraError) return err;
  const name = (err as { name?: string } | null)?.name ?? '';
  const message = (err as { message?: string } | null)?.message ?? String(err);
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new CameraError('denied', message);
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return new CameraError('not-found', message);
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new CameraError('in-use', message);
    default:
      return new CameraError('unknown', message);
  }
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

/** Video inputs. Labels are empty until permission has been granted once. */
export async function listCameras(): Promise<CameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

export interface OpenCameraOptions {
  deviceId?: string | null;
  width?: number;
  height?: number;
  frameRate?: number;
}

/**
 * Open a camera stream. 1280×720 @ 30 fps is the default: enough detail for
 * landmarks at arm's length without wasting decode time.
 */
export async function openCamera({
  deviceId,
  width = 1280,
  height = 720,
  frameRate = 30,
}: OpenCameraOptions = {}): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new CameraError('insecure', 'Camera access needs HTTPS or localhost.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', 'This browser does not support camera access.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: frameRate, max: 60 },
        facingMode: deviceId ? undefined : 'user',
      },
    });
  } catch (err) {
    throw classifyCameraError(err);
  }
}

/** Stop every track so the camera indicator light turns off. */
export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}
