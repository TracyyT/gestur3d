import type { ReactNode } from 'react';
import { Grid } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { palette } from '@/ui/theme';
import { HoloSculpture } from './HoloSculpture';

interface Props {
  reducedMotion: boolean;
  particleDensity: number;
}

/** Keeps the sculpture to the right of the copy on wide screens, centered on narrow ones. */
function Layout({ children }: { children: ReactNode }) {
  const { width, aspect } = useThree((s) => s.viewport);
  const wide = aspect > 1.25;
  const x = wide ? width * 0.21 : 0;
  const y = wide ? 0.15 : 1.15;
  const scale = wide ? 0.72 : Math.min(0.6, width * 0.21);
  return (
    <group position={[x, y, 0]} scale={scale}>
      {children}
    </group>
  );
}

export default function HeroScene({ reducedMotion, particleDensity }: Props) {
  return (
    <Canvas
      // A static frame under reduced motion: render on demand only.
      frameloop={reducedMotion ? 'demand' : 'always'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.35, 6.4], fov: 38 }}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: true }}
      aria-hidden
    >
      <fog attach="fog" args={[palette.void, 7, 16]} />
      <Layout>
        <HoloSculpture particleDensity={particleDensity} animate={!reducedMotion} />
      </Layout>
      <Grid
        position={[0, -2.1, 0]}
        args={[30, 30]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#1a2233"
        sectionSize={2.5}
        sectionThickness={0.8}
        sectionColor="#1d4a5a"
        fadeDistance={14}
        fadeStrength={1.6}
        infiniteGrid
      />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.2} intensity={0.75} />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
