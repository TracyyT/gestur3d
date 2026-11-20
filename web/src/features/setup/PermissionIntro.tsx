import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Button, GlassPanel, buttonClasses } from '@/ui';

const points = [
  {
    title: 'What it’s for',
    body: 'Finding your hands so you can grab, move and rotate objects. Nothing else.',
  },
  {
    title: 'Where it goes',
    body: 'Nowhere. Every frame is processed on this device and immediately discarded.',
  },
  {
    title: 'You’re in control',
    body: 'Turn the camera off at any time from the workspace. Leaving the app turns it off too.',
  },
];

export function PermissionIntro({ onEnable, busy }: { onEnable: () => void; busy: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-xl"
    >
      <GlassPanel className="p-8 md:p-10">
        <div className="mb-6 inline-grid size-11 place-items-center rounded-2xl border border-holo-cyan/30 bg-holo-cyan/10 text-holo-cyan">
          <svg aria-hidden viewBox="0 0 24 24" className="size-5">
            <rect
              x="3"
              y="6"
              width="13"
              height="12"
              rx="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M16 10.5l4.5-2.5v8L16 13.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
          Before we turn on your camera
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Gestur3D uses your webcam to see your hands. Here’s exactly what that means.
        </p>
        <ul className="mt-7 space-y-5">
          {points.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-holo-cyan" />
              <div>
                <p className="text-[14px] font-medium">{p.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={onEnable} disabled={busy}>
            {busy ? 'Waiting for permission…' : 'Turn on camera'}
          </Button>
          <Link to="/workspace" className={buttonClasses('ghost', 'lg')}>
            Continue with mouse only
          </Link>
        </div>
        <p className="mt-5 text-[12.5px] text-ink-3">
          Your browser will ask for permission next. No recording, no uploads.
        </p>
      </GlassPanel>
    </motion.div>
  );
}
