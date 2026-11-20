import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  IcosahedronGeometry,
  type Group,
  type Mesh,
  type Points,
  type ShaderMaterial,
} from 'three';
import { createHoloMaterial } from '@/scene/materials/holoMaterial';
import { palette } from '@/ui/theme';

interface Props {
  /** 0..1 multiplier on the particle halo. */
  particleDensity: number;
  animate: boolean;
}

const HALO_MAX = 1400;

/** Seeded PRNG so the halo looks the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createHaloGeometry(count: number) {
  const rand = mulberry32(7);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const cyan = new Color(palette.cyan);
  const violet = new Color(palette.violet);
  const c = new Color();
  for (let i = 0; i < count; i++) {
    // Points on a thick shell, flattened into a loose disc.
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const r = 2.0 + Math.pow(rand(), 2) * 1.8;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = r * s * Math.cos(phi);
    positions[i * 3 + 1] = r * u * 0.45;
    positions[i * 3 + 2] = r * s * Math.sin(phi);
    c.copy(cyan)
      .lerp(violet, rand())
      .multiplyScalar(0.35 + rand() * 0.75);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

/**
 * Landing hero: a holographic icosahedron shell with a small glowing core,
 * a tilted orbit ring and a particle halo. Leans toward the pointer.
 */
export function HoloSculpture({ particleDensity, animate }: Props) {
  const root = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const shell = useRef<Mesh>(null);
  const halo = useRef<Points>(null);

  const resources = useMemo(
    () => ({
      shellMaterial: createHoloMaterial({ opacity: 0.55, fresnelPower: 2.8, scanDensity: 2.4 }),
      edges: new EdgesGeometry(new IcosahedronGeometry(1.42, 1)),
      halo: createHaloGeometry(HALO_MAX),
      coreColor: new Color(palette.violet).multiplyScalar(1.6),
      ringColor: new Color(palette.cyan).multiplyScalar(1.3),
    }),
    [],
  );

  useEffect(() => {
    const visible = Math.round(HALO_MAX * Math.min(1, Math.max(0.05, particleDensity)));
    halo.current?.geometry.setDrawRange(0, visible);
  }, [particleDensity]);

  useEffect(
    () => () => {
      resources.shellMaterial.dispose();
      resources.edges.dispose();
      resources.halo.dispose();
    },
    [resources],
  );

  useFrame((state, delta) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;
    const material = shell.current?.material as ShaderMaterial | undefined;
    if (material?.uniforms.uTime) material.uniforms.uTime.value = t;
    if (spin.current) {
      spin.current.rotation.y += delta * 0.16;
      spin.current.rotation.x = Math.sin(t * 0.3) * 0.12;
    }
    if (halo.current) halo.current.rotation.y -= delta * 0.035;
    if (root.current) {
      easing.dampE(
        root.current.rotation,
        [state.pointer.y * -0.22, state.pointer.x * 0.32, 0],
        0.6,
        delta,
      );
    }
  });

  return (
    <group ref={root}>
      <group ref={spin}>
        <mesh ref={shell} material={resources.shellMaterial}>
          <icosahedronGeometry args={[1.4, 1]} />
        </mesh>
        <lineSegments geometry={resources.edges}>
          <lineBasicMaterial
            color={palette.cyan}
            transparent
            opacity={0.28}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
        {/* Core: over-bright so it, and the ring, are what the bloom pass picks up. */}
        <mesh>
          <icosahedronGeometry args={[0.16, 2]} />
          <meshBasicMaterial color={resources.coreColor} toneMapped={false} />
        </mesh>
      </group>
      <mesh rotation={[Math.PI / 2.3, 0.28, 0]}>
        <torusGeometry args={[2.1, 0.004, 6, 240]} />
        <meshBasicMaterial
          color={resources.ringColor}
          transparent
          opacity={0.7}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <points ref={halo} geometry={resources.halo}>
        <pointsMaterial
          size={0.02}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
