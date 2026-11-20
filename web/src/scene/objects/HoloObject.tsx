import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  EdgesGeometry,
  IcosahedronGeometry,
  Plane,
  TorusKnotGeometry,
  Vector3,
  type BufferGeometry,
  type Group,
  type Mesh,
  type ShaderMaterial,
} from 'three';
import type { InputSource, ObjectKind, SceneObject, Vec3 } from '@/core/interaction/commands';
import { createHoloMaterial } from '@/scene/materials/holoMaterial';
import { FLOOR_Y } from '@/scene/constants';
import { useScene } from '@/stores/scene';
import { palette } from '@/ui/theme';

interface Props {
  object: SceneObject;
  selected: boolean;
  /** Snap transforms instead of easing (reduced motion). */
  instant: boolean;
  onHoverChange: (id: string, hovering: boolean) => void;
}

const STYLE: Record<ObjectKind, { color: string; rim: string }> = {
  sphere: { color: palette.cyan, rim: palette.violet },
  cube: { color: palette.violet, rim: palette.cyan },
  sculpture: { color: palette.cyanDeep, rim: palette.cyan },
};

function useKindGeometry(kind: ObjectKind) {
  return useMemo(() => {
    switch (kind) {
      case 'sphere':
        return {
          body: new IcosahedronGeometry(0.62, 4) as BufferGeometry,
          edges: new EdgesGeometry(new IcosahedronGeometry(0.63, 1)) as BufferGeometry | null,
        };
      case 'cube':
        return {
          body: new BoxGeometry(0.95, 0.95, 0.95),
          edges: new EdgesGeometry(new BoxGeometry(0.96, 0.96, 0.96)),
        };
      case 'sculpture':
        // Too dense for edge lines; the holo shell carries it alone.
        return { body: new TorusKnotGeometry(0.42, 0.13, 200, 24), edges: null };
    }
  }, [kind]);
}

const tmpHit = new Vector3();
const SOURCE: InputSource = 'mouse';

/**
 * A holographic object the user can select, drag (move on a camera-facing
 * plane), Shift-drag (rotate) and scroll (scale). All changes go through
 * scene commands; this component only renders and translates pointer input.
 */
export function HoloObject({ object, selected, instant, onHoverChange }: Props) {
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const hovered = useRef(false);
  const drag = useRef<{
    pointerId: number;
    mode: 'move' | 'rotate';
    plane: Plane;
    offset: Vector3;
    lastX: number;
    lastY: number;
  } | null>(null);

  const getThree = useThree((s) => s.get);
  const dispatch = useScene((s) => s.dispatch);
  const setMode = useScene((s) => s.setMode);

  const { body: kindBody, edges } = useKindGeometry(object.kind);
  const material = useMemo(() => {
    const s = STYLE[object.kind];
    return createHoloMaterial({
      color: s.color,
      rimColor: s.rim,
      opacity: object.kind === 'cube' ? 0.65 : 0.9,
      scanDensity: 4,
    });
  }, [object.kind]);
  const ringColor = useMemo(() => new Color(palette.cyan).multiplyScalar(1.4), []);

  useEffect(
    () => () => {
      material.dispose();
      kindBody.dispose();
      edges?.dispose();
    },
    [material, kindBody, edges],
  );

  // Ease the rendered transform toward the model so input feels smooth.
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const [px, py, pz] = object.position;
    if (instant) {
      g.position.set(px, py, pz);
      g.rotation.set(...object.rotation);
      g.scale.setScalar(object.scale);
    } else {
      easing.damp3(g.position, object.position, 0.08, delta);
      easing.dampE(g.rotation, object.rotation, 0.1, delta);
      easing.damp3(g.scale, [object.scale, object.scale, object.scale], 0.1, delta);
    }

    const m = body.current?.material as ShaderMaterial | undefined;
    if (m?.uniforms.uTime && m.uniforms.uHighlight) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      const target = selected ? 1 : hovered.current ? 0.45 : 0;
      m.uniforms.uHighlight.value +=
        (target - m.uniforms.uHighlight.value) * Math.min(1, delta * 10);
    }

    // Selection ring sits on the floor under the object.
    if (ring.current) {
      ring.current.visible = selected;
      ring.current.position.set(g.position.x, FLOOR_Y + 0.005, g.position.z);
      const pulse = instant ? 1 : 1 + Math.sin(state.clock.elapsedTime * 3) * 0.04;
      ring.current.scale.setScalar(g.scale.x * pulse);
    }
  });

  /** Pause camera orbiting while an object is being dragged. */
  const setOrbitEnabled = (enabled: boolean) => {
    const controls = getThree().controls as { enabled: boolean } | null;
    if (controls) controls.enabled = enabled;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    dispatch({ type: 'select', id: object.id }, SOURCE);

    const { camera } = getThree();
    const normal = camera.getWorldDirection(new Vector3()).negate();
    const origin = new Vector3(...object.position);
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, origin);
    const hit = e.ray.intersectPlane(plane, tmpHit) ?? origin;
    drag.current = {
      pointerId: e.pointerId,
      mode: e.shiftKey ? 'rotate' : 'move',
      plane,
      offset: origin.clone().sub(hit),
      lastX: e.clientX,
      lastY: e.clientY,
    };
    setOrbitEnabled(false);
    setMode(e.shiftKey ? 'rotating' : 'moving', SOURCE);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    if (d.mode === 'move') {
      const hit = e.ray.intersectPlane(d.plane, tmpHit);
      if (hit) {
        const p = hit.add(d.offset);
        dispatch({ type: 'setPosition', id: object.id, position: [p.x, p.y, p.z] as Vec3 }, SOURCE);
      }
    } else {
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      dispatch({ type: 'rotate', id: object.id, delta: [dy * 0.01, dx * 0.01, 0] }, SOURCE);
    }
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
    setOrbitEnabled(true);
    setMode('selecting', SOURCE);
  };

  const onWheel = (e: ThreeEvent<WheelEvent>) => {
    if (!selected) return;
    e.stopPropagation();
    dispatch({ type: 'scaleBy', id: object.id, factor: Math.exp(-e.deltaY * 0.0008) }, SOURCE);
  };

  const setHover = (on: boolean) => {
    hovered.current = on;
    onHoverChange(object.id, on);
    document.body.style.cursor = on ? 'grab' : '';
  };

  useEffect(() => () => void (document.body.style.cursor = ''), []);

  return (
    <>
      <group ref={group}>
        <mesh
          ref={body}
          material={material}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
          }}
          onPointerOut={() => setHover(false)}
        >
          <primitive object={kindBody} attach="geometry" />
        </mesh>
        {edges && (
          <lineSegments geometry={edges} raycast={() => null}>
            <lineBasicMaterial
              color={STYLE[object.kind].color}
              transparent
              opacity={selected ? 0.55 : 0.22}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </lineSegments>
        )}
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null}>
        <ringGeometry args={[0.72, 0.73, 128]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
