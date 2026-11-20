import { Link } from 'react-router';

export function LandingPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Gestur3D</h1>
        <p className="mt-3 text-slate-400">A holographic workspace you control with your hands.</p>
        <Link
          to="/setup"
          className="mt-8 inline-block rounded-full border border-cyan-300/40 px-6 py-3 text-cyan-100"
        >
          Launch Workspace
        </Link>
      </div>
    </main>
  );
}
