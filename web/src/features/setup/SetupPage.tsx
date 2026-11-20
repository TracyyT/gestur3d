import { Link } from 'react-router';

export function SetupPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Camera setup</h1>
        <p className="mt-3 text-slate-400">Coming in this milestone.</p>
        <Link to="/workspace" className="mt-6 inline-block text-cyan-300">
          Continue to workspace
        </Link>
      </div>
    </main>
  );
}
