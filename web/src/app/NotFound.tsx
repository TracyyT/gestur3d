import { Link } from 'react-router';

export function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-8 text-center">
      <div>
        <p className="text-sm tracking-widest text-slate-400 uppercase">404</p>
        <h1 className="mt-2 text-2xl font-semibold">This space doesn’t exist yet</h1>
        <Link className="mt-6 inline-block text-cyan-300 underline-offset-4 hover:underline" to="/">
          Back to start
        </Link>
      </div>
    </main>
  );
}
