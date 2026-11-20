import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useCallback, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScene } from '@/stores/scene';
import { useSettings } from '@/stores/settings';
import { HoloLab } from './environments/HoloLab';
import { FrameProbe } from './FrameProbe';
import { HandController } from './HandController';
import { PanelAwareFraming } from './PanelAwareFraming';
import { HoloObject } from './objects/HoloObject';

function SceneObjects({
  instant,
  onHoverChange,
}: {
  instant: boolean;
  onHoverChange: (id: string, on: boolean) => void;
}) {
  const objects = useScene((s) => s.objects);
  const selectedId = useScene((s) => s.selectedId);
  return (
    <>
      {objects.map((o) => (
        <HoloObject
          key={o.id}
          object={o}
          selected={o.id === selectedId}
          instant={instant}
          onHoverChange={onHoverChange}
        />
      ))}
    </>
  );
}

/**
 * The workspace 3D view. Drag empty space to orbit, click an object to
 * select it; HoloObject handles direct manipulation.
 */
export default function WorkspaceCanvas() {
  const reducedMotion = useReducedMotion();
  const particleDensity = useSettings((s) => s.particleDensity);
  const quality = useSettings((s) => s.visualQuality);
  const selectedId = useScene((s) => s.selectedId);
  const dispatch = useScene((s) => s.dispatch);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const onHoverChange = useCallback((id: string, on: boolean) => {
    setHoveredId((cur) => (on ? id : cur === id ? null : cur));
  }, []);

  const bloom = quality !== 'low';
  const dpr: [number, number] =
    quality === 'low' ? [1, 1] : quality === 'high' ? [1, 2] : [1, 1.75];

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 2.3, 7.4], fov: 42, near: 0.1, far: 60 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={(e) => {
        if (e.button === 0) dispatch({ type: 'select', id: null }, 'mouse');
      }}
    >
      <FrameProbe />
      <PanelAwareFraming instant={reducedMotion} />
      <HandController />
      <HoloLab particleDensity={particleDensity} />
      <SceneObjects instant={reducedMotion} onHoverChange={onHoverChange} />
      <OrbitControls
        makeDefault
        target={[0, 0.15, 0]}
        enablePan={false}
        // Scrolling over the selected object scales it instead of zooming.
        enableZoom={!(hoveredId && hoveredId === selectedId)}
        enableDamping={!reducedMotion}
        dampingFactor={0.08}
        minDistance={3.5}
        maxDistance={12}
        minPolarAngle={0.25}
        maxPolarAngle={1.5}
      />
      {bloom && (
        <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
          <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={0.7} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
