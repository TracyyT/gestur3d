import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Mesh, type Group, type TubeGeometry } from 'three';
import { drawRuntime, useDraw } from '@/features/drawing/drawStore';
import { COLOR_STYLE } from './objects/kinds';
import { createStrokeMaterial, tubeThrough } from './objects/stroke';

/**
 * The glowing trail of strokes being drawn right now, one per hand. Rebuilt
 * only when a stroke gains a point; finished strokes become scene objects.
 */
export function LiveStrokes() {
  const color = useDraw((s) => s.color);
  const material = useMemo(() => createStrokeMaterial(COLOR_STYLE[color].color), [color]);
  const group = useRef<Group>(null);
  const seen = useRef(-1);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const g = group.current;
    if (!g || (drawRuntime.version === seen.current && g.userData.material === material)) return;
    seen.current = drawRuntime.version;
    g.userData.material = material;
    for (const child of [...g.children]) {
      (child as Mesh<TubeGeometry>).geometry.dispose();
      g.remove(child);
    }
    for (const points of drawRuntime.live.values()) {
      if (points.length < 2) continue;
      const mesh = new Mesh(tubeThrough(points), material);
      mesh.raycast = () => {};
      mesh.renderOrder = 10;
      g.add(mesh);
    }
  });

  useEffect(() => {
    const g = group.current;
    return () => {
      for (const child of [...(g?.children ?? [])]) (child as Mesh).geometry.dispose();
    };
  }, []);

  return <group ref={group} />;
}
