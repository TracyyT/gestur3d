import { Grid } from '@react-three/drei';
import { useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color } from 'three';
import { FLOOR_Y } from '@/scene/constants';
import { palette } from '@/ui/theme';

/** Sparse dust motes for depth. Deterministic so the room looks the same each visit. */
function useDust(count: number) {
  return useMemo(() => {
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * 16;
      pos[i * 3 + 1] = FLOOR_Y + rand() * 5;
      pos[i * 3 + 2] = (rand() - 0.5) * 12 - 2;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    return g;
  }, [count]);
}

/**
 * "Holographic lab": a dark room with a fading floor grid, a circular
 * projection pad under the objects, and faint dust. Unlit by design; the
 * holo materials carry their own light.
 */
export function HoloLab({ particleDensity }: { particleDensity: number }) {
  const dust = useDust(Math.round(80 + 320 * particleDensity));
  const padColor = useMemo(() => new Color(palette.cyan).multiplyScalar(0.9), []);

  return (
    <group>
      <color attach="background" args={[palette.void]} />
      <fog attach="fog" args={[palette.void, 9, 22]} />

      <Grid
        position={[0, FLOOR_Y, 0]}
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#141b29"
        sectionSize={2.5}
        sectionThickness={0.9}
        sectionColor="#1b4554"
        fadeDistance={18}
        fadeStrength={1.4}
        infiniteGrid
      />

      {/* projection pad */}
      <group position={[0, FLOOR_Y + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh raycast={() => null}>
          <ringGeometry args={[2.9, 2.912, 160]} />
          <meshBasicMaterial
            color={padColor}
            transparent
            opacity={0.35}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh raycast={() => null}>
          <ringGeometry args={[2.4, 2.404, 160]} />
          <meshBasicMaterial
            color={palette.violet}
            transparent
            opacity={0.25}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      <points geometry={dust} raycast={() => null}>
        <pointsMaterial
          size={0.018}
          color={palette.ink2}
          transparent
          opacity={0.35}
          sizeAttenuation
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}
