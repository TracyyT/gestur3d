import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { scriptedRecording } from '@/core/tracking/scripts';
import { HAND_BONES } from '@/core/vision/types';
import { GhostHand } from './GhostHand';

const rec = scriptedRecording(
  [
    { at: 0, cx: 0.5, cy: 0.5, pinch: 0 },
    { at: 300, cx: 0.5, cy: 0.5, pinch: 1 },
  ],
  { aspect: 16 / 9 },
);

describe('GhostHand', () => {
  it('draws a labelled skeleton: every bone and 5 fingertips', () => {
    render(<GhostHand recording={rec} label="Pinch" playing={false} />);
    const svg = screen.getByRole('img', { name: 'Pinch' });
    const hand = svg.querySelector('[data-hand="0"]')!;
    expect(hand.getAttribute('visibility')).toBe('visible');
    expect(hand.querySelectorAll('line')).toHaveLength(HAND_BONES.length);
    expect(hand.querySelectorAll('circle')).toHaveLength(5);
    // The second hand slot is hidden for a one-hand demo.
    expect(svg.querySelector('[data-hand="1"]')!.getAttribute('visibility')).toBe('hidden');
  });

  it('shows the end pose when not playing (pinched: thumb and index tips meet)', () => {
    render(<GhostHand recording={rec} label="Pinch" playing={false} />);
    const tips = [...screen.getByRole('img').querySelectorAll('[data-hand="0"] circle')];
    const [thumb, index] = tips.map((c) => [
      Number(c.getAttribute('cx')),
      Number(c.getAttribute('cy')),
    ]);
    const open = render(
      <GhostHand recording={{ ...rec, frames: [rec.frames[0]!] }} label="Open" playing={false} />,
    );
    const openTips = [
      ...open.getByRole('img', { name: 'Open' }).querySelectorAll('[data-hand="0"] circle'),
    ].map((c) => [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]);
    const gap = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
    expect(gap(thumb!, index!)).toBeLessThan(gap(openTips[0]!, openTips[1]!));
  });

  it('animates by moving its elements, without re-rendering', async () => {
    const moving = scriptedRecording(
      [
        { at: 0, cx: 0.3, cy: 0.5, pinch: 0 },
        { at: 2000, cx: 0.7, cy: 0.5, pinch: 0 },
      ],
      { aspect: 16 / 9 },
    );
    render(<GhostHand recording={moving} label="Move" playing />);
    const wrist = () =>
      screen.getByRole('img', { name: 'Move' }).querySelector('line')!.getAttribute('x1');
    const before = wrist();
    await new Promise((r) => setTimeout(r, 300));
    expect(wrist()).not.toBe(before);
  });

  it('renders nothing for an empty recording', () => {
    const { container } = render(
      <GhostHand recording={{ ...rec, frames: [] }} label="None" playing={false} />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });
});
