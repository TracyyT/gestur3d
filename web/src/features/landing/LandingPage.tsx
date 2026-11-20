import { motion } from 'motion/react';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { supportsWebGL2 } from '@/lib/webgl';
import { useSettings } from '@/stores/settings';
import { buttonClasses } from '@/ui';
import { HeroFallback } from './HeroFallback';
import { Logo } from '@/ui/Logo';

const HeroScene = lazy(() => import('./HeroScene'));

const REPO_URL = 'https://github.com/TracyyT/gestur3d';

type Status = 'Live' | 'In progress' | 'Planned';

const features: Array<{ title: string; body: string; status: Status }> = [
  {
    title: 'Two-hand tracking',
    body: 'Up to two hands and 21 landmarks each, tracked at camera rate and smoothed for steady, low-latency control.',
    status: 'Live',
  },
  {
    title: 'Gestures trained from scratch',
    body: 'Static and dynamic gesture classifiers trained on a purpose-built landmark dataset, then run in the browser with ONNX.',
    status: 'In progress',
  },
  {
    title: 'Private by design',
    body: 'Camera frames are processed on your device. Nothing is uploaded, and the camera switches off when you leave.',
    status: 'Live',
  },
];

const steps = [
  {
    n: '01',
    title: 'Allow the camera',
    body: 'You’ll see exactly what it’s used for before the browser asks.',
  },
  {
    n: '02',
    title: 'Calibrate',
    body: 'A quick check for distance, lighting and both hands in frame.',
  },
  {
    n: '03',
    title: 'Reach in',
    body: 'Pinch to grab, turn your wrist to rotate, spread two hands to scale.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.12 + i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function LandingPage() {
  const reducedMotion = useReducedMotion();
  const particleDensity = useSettings((s) => s.particleDensity);
  const [webgl] = useState(supportsWebGL2);

  return (
    <div className="relative">
      {/* ambient wash behind everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_50%_at_70%_40%,rgb(155_123_255/0.10),transparent_70%),radial-gradient(40%_40%_at_20%_80%,rgb(94_231_255/0.06),transparent_70%)]"
      />

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
          <Logo className="size-6" />
          Gestur3D
        </Link>
        <nav className="flex items-center gap-1 text-[13px]">
          <a href="#how" className={buttonClasses('ghost', 'sm')}>
            How it works
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses('ghost', 'sm')}
          >
            GitHub
          </a>
        </nav>
      </header>

      <section className="relative -mt-[76px] flex min-h-dvh items-center overflow-hidden">
        <div className="absolute inset-0">
          {webgl ? (
            <Suspense fallback={<HeroFallback />}>
              <HeroScene reducedMotion={reducedMotion} particleDensity={particleDensity} />
            </Suspense>
          ) : (
            <HeroFallback />
          )}
        </div>
        {/* keeps copy legible over the scene on small screens */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(5_6_10/0.85)_0%,rgb(5_6_10/0.4)_45%,transparent_70%)] max-md:bg-[linear-gradient(0deg,rgb(5_6_10/0.95)_25%,transparent_70%)]"
        />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-24 max-md:mt-auto max-md:pb-16 md:px-10">
          <div className="max-w-xl">
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={0}
              className="mb-5 inline-flex items-center gap-2 text-[12px] tracking-[0.2em] text-ink-3 uppercase"
            >
              <span className="h-px w-6 bg-holo-cyan/60" />
              Spatial interface · runs in your browser
            </motion.p>
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="text-[clamp(2.6rem,6vw,4.6rem)] leading-[1.02] font-semibold tracking-[-0.035em]"
            >
              Shape light
              <br />
              <span className="text-holo">with your hands.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={2}
              className="mt-6 max-w-md text-[16px] leading-relaxed text-ink-2"
            >
              Gestur3D turns your webcam into a spatial controller. Grab, rotate and scale
              holographic objects, draw in the air, and trigger effects. No headset, no install.
            </motion.p>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={3}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link to="/setup" className={buttonClasses('primary', 'lg')}>
                Launch Workspace
                <svg aria-hidden viewBox="0 0 16 16" className="size-4">
                  <path
                    d="M3 8h9m-4-4 4 4-4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              </Link>
              <Link to="/workspace" className={buttonClasses('ghost', 'lg')}>
                Try with mouse
              </Link>
            </motion.div>
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={4}
              className="mt-6 flex items-center gap-2 text-[12.5px] text-ink-3"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 text-holo-cyan/80">
                <rect
                  x="3.5"
                  y="7"
                  width="9"
                  height="6.5"
                  rx="1.5"
                  fill="none"
                  stroke="currentColor"
                />
                <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" />
              </svg>
              Video never leaves your device.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-8 md:px-10">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="glass rounded-(--radius-panel) p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-medium tracking-tight">{f.title}</h2>
                <span
                  className={
                    f.status === 'Live'
                      ? 'text-[11px] tracking-wide text-signal-good'
                      : 'text-[11px] tracking-wide text-ink-3'
                  }
                >
                  {f.status}
                </span>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="how"
        className="relative z-10 mx-auto max-w-7xl scroll-mt-10 px-6 py-24 md:px-10"
      >
        <p className="text-[12px] tracking-[0.2em] text-ink-3 uppercase">How it works</p>
        <ol className="mt-8 grid gap-10 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-line pt-6">
              <span className="font-mono text-[12px] text-holo-cyan">{s.n}</span>
              <h3 className="mt-3 text-[18px] font-medium tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-8 text-[12.5px] text-ink-3 md:px-10">
        <span>Gestur3D · hand tracking and gesture models run locally</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink-1">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
