import { describe, expect, it } from 'vitest';
import { SessionLog } from './sessionLog';

function clock() {
  let t = 1000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('SessionLog', () => {
  it('records discrete commands with their source and time', () => {
    const c = clock();
    const log = new SessionLog({ now: c.now });
    c.advance(250);
    log.command({ type: 'add', kind: 'ring' }, 'gesture');
    c.advance(100);
    log.command({ type: 'select', id: 'obj-4' }, 'mouse');
    expect(log.events).toEqual([
      { t: 250, type: 'command', source: 'gesture', action: 'add', detail: 'ring' },
      { t: 350, type: 'command', source: 'mouse', action: 'select', target: 'obj-4' },
    ]);
  });

  it('merges a continuous drag into one event with its duration and steps', () => {
    const c = clock();
    const log = new SessionLog({ now: c.now });
    for (let i = 0; i < 30; i++) {
      log.command({ type: 'setPosition', id: 'obj-1', position: [i, 0, 0] }, 'gesture');
      c.advance(33);
    }
    expect(log.events).toEqual([
      {
        t: 0,
        type: 'manipulate',
        source: 'gesture',
        op: 'move',
        target: 'obj-1',
        durationMs: 957,
        steps: 30,
      },
    ]);
  });

  it('starts a new event after a pause, a different object, op or source', () => {
    const c = clock();
    const log = new SessionLog({ now: c.now, mergeGapMs: 400 });
    const move = (id = 'obj-1', src: 'gesture' | 'mouse' = 'gesture') =>
      log.command({ type: 'translate', id, delta: [0.1, 0, 0] }, src);
    move();
    c.advance(30);
    move();
    c.advance(500); // pause
    move();
    move('obj-2');
    move('obj-2', 'mouse');
    log.command({ type: 'scaleBy', id: 'obj-2', factor: 1.1 }, 'mouse');
    expect(
      log.events.map((e) =>
        e.type === 'manipulate' ? `${e.op}:${e.target}:${e.source}:${e.steps}` : e.type,
      ),
    ).toEqual([
      'move:obj-1:gesture:2',
      'move:obj-1:gesture:1',
      'move:obj-2:gesture:1',
      'move:obj-2:mouse:1',
      'scale:obj-2:mouse:1',
    ]);
  });

  it('a discrete event between drags ends the merge', () => {
    const c = clock();
    const log = new SessionLog({ now: c.now });
    log.command({ type: 'rotate', id: 'a', delta: [0, 0, 0.1] }, 'keyboard');
    log.add({ type: 'menuOpen', by: 'gesture' });
    log.command({ type: 'rotate', id: 'a', delta: [0, 0, 0.1] }, 'keyboard');
    expect(log.events.map((e) => e.type)).toEqual(['manipulate', 'menuOpen', 'manipulate']);
  });

  it('never stores stroke points, only their count', () => {
    const log = new SessionLog();
    log.command(
      {
        type: 'addStroke',
        points: [
          [0, 0, 0],
          [1, 1, 1],
          [2, 0, 0],
        ],
      },
      'gesture',
    );
    expect(log.events[0]).toMatchObject({ action: 'addStroke', detail: '3 points' });
    expect(JSON.stringify(log.toJSON())).not.toContain('[1,1,1]');
  });

  it('drops the oldest events beyond its limit', () => {
    const log = new SessionLog({ limit: 3 });
    for (let i = 0; i < 5; i++) log.add({ type: 'mark', name: `m${i}` });
    expect(log.events.map((e) => (e.type === 'mark' ? e.name : ''))).toEqual(['m2', 'm3', 'm4']);
  });

  it('exports versioned JSON and quoted CSV', () => {
    const c = clock();
    const log = new SessionLog({ now: c.now });
    log.add({ type: 'mark', name: 'lesson-start', detail: 'pinch, grab "and" move' });
    log.command({ type: 'scaleBy', id: 'obj-1', factor: 2 }, 'gesture');
    log.add({ type: 'menuClose', action: 'add', choice: 'ring' });
    const json = log.toJSON();
    expect(json.version).toBe(1);
    expect(json.events).toHaveLength(3);
    expect(log.toCSV()).toBe(
      [
        't_ms,type,source,action,target,duration_ms,steps,detail',
        '0,mark,,lesson-start,,,,"pinch, grab ""and"" move"',
        '0,manipulate,gesture,scale,obj-1,0,1,',
        '0,menuClose,,add,,,,ring',
        '',
      ].join('\n'),
    );
  });

  it('clear() empties the log and restarts its clock', () => {
    const c = clock();
    const log = new SessionLog({ now: c.now });
    c.advance(5000);
    log.add({ type: 'mark', name: 'x' });
    log.clear();
    c.advance(10);
    log.add({ type: 'mark', name: 'y' });
    expect(log.events).toEqual([{ t: 10, type: 'mark', name: 'y' }]);
  });
});
