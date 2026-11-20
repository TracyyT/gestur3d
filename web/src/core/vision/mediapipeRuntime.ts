/**
 * Loads MediaPipe's ES-module wasm runtime ourselves instead of letting
 * MediaPipe inject it.
 *
 * Why: MediaPipe loads its runtime with a <script> tag on the main thread
 * (needs the classic build) and with importScripts / import() in workers. The
 * module build can't run as a <script>, and in module workers import() only
 * executes once, so a second detector (e.g. CPU fallback after GPU fails) finds
 * no runtime. MediaPipe also clears `self.ModuleFactory` after each setup.
 *
 * Importing the module once and re-arming `ModuleFactory` before every
 * createFromOptions() works on both the main thread and in workers, and lets
 * the app ship a single runtime.
 */
type Factory = unknown;

/** Same shape as MediaPipe's (unexported) WasmFileset. */
export interface WasmFileset {
  wasmLoaderPath: string;
  wasmBinaryPath: string;
}

const cache = new Map<string, Promise<Factory>>();

export interface VisionRuntime {
  fileset: WasmFileset;
  /** Call immediately before each `*.createFromOptions(fileset, ...)`. */
  arm(): void;
}

export async function loadVisionRuntime(baseUrl: string): Promise<VisionRuntime> {
  const loaderUrl = `${baseUrl}/wasm/vision_wasm_module_internal.js`;
  if (!cache.has(loaderUrl)) {
    cache.set(
      loaderUrl,
      import(/* @vite-ignore */ loaderUrl).then((m: { default: Factory }) => m.default),
    );
  }
  const factory = await cache.get(loaderUrl)!;
  return {
    // An empty loader path tells MediaPipe the runtime is already present.
    fileset: {
      wasmLoaderPath: '',
      wasmBinaryPath: `${baseUrl}/wasm/vision_wasm_module_internal.wasm`,
    },
    arm() {
      (globalThis as { ModuleFactory?: Factory }).ModuleFactory = factory;
    },
  };
}
