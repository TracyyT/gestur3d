import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  Plane,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type ShaderMaterial,
} from 'three';
import type { InputSource, SceneObject, Vec3 } from '@/core/interaction/commands';
import { handRuntime } from '@/features/hands/handRuntime';
import { createHoloMaterial } from '@/scene/materials/holoMaterial';
import { objectRegistry } from '@/scene/objectRegistry';
import { COLOR_STYLE, KINDS, kindGeometry } from './kinds';
import { createPickMaterial, createStrokeMaterial, strokeGeometry } from './stroke';
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

const tmpHit = new Vector3();
const SOURCE: InputSource = 'mouse';

/**
 * A holographic object the user can select, drag (move on a camera-facing
 * plane), Shift-drag (rotate) and scroll (scale). All changes go through
 * scene commands; this component only renders and translates pointer input.
 */
export function HoloObject({ object, selected, instant, onHoverChange }: Props) {
  const group = useRef<Group>(null);
  /** Inner group for the kind's idle spin, so the model's rotation stays untouched. */
  const spin = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const lineRef = useRef<Mesh>(null);
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

  const isStroke = object.kind === 'stroke';
  const kind = object.kind === 'stroke' ? null : KINDS[object.kind];
  const style = object.color ? COLOR_STYLE[object.color] : (kind ?? COLOR_STYLE.cyan);

  // Shapes share geometry per kind; a stroke has its own line and pick box.
  const stroke = useMemo(
    () => (isStroke ? strokeGeometry(object.points ?? []) : null),
    [isStroke, object.points],
  );
  const shape = object.kind === 'stroke' ? null : kindGeometry(object.kind);
  const kindBody = stroke ? stroke.pick : shape!.body;
  const edges = shape?.edges ?? null;

  const material = useMemo(
    () =>
      isStroke
        ? createPickMaterial()
        : createHoloMaterial({
            color: style.color,
            rimColor: style.rim,
            opacity: kind!.opacity,
            scanDensity: 4,
          }),
    [isStroke, style, kind],
  );
  const strokeMaterial = useMemo(
    () => (isStroke ? createStrokeMaterial(style.color) : null),
    [isStroke, style],
  );
  const ringColor = useMemo(() => new Color(palette.cyan).multiplyScalar(1.4), []);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(
    () => () => {
      stroke?.tube.dispose();
      stroke?.pick.dispose();
    },
    [stroke],
  );
  useEffect(() => () => strokeMaterial?.dispose(), [strokeMaterial]);

  // Register the pickable mesh so hands can raycast against it.
  useEffect(() => {
    // The body mesh is the spin group's first child (see JSX below).
    const mesh = spin.current?.children[0];
    if (!mesh) return;
    objectRegistry.set(object.id, mesh);
    return () => objectRegistry.delete(object.id);
  }, [object.id]);

  // Ease the rendered transform toward the model so input feels smooth.
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const [px, py, pz] = object.position;
    const handHeld = handRuntime.held.has(object.id);
    if (instant) {
      g.position.set(px, py, pz);
      g.quaternion.set(...object.rotation);
      g.scale.setScalar(object.scale);
    } else {
      // Hands already arrive smoothed; keep the object tight to the hand cursor.
      easing.damp3(g.position, object.position, handHeld ? 0.03 : 0.08, delta);
      easing.dampQ(g.quaternion, object.rotation, handHeld ? 0.03 : 0.1, delta);
      easing.damp3(
        g.scale,
        [object.scale, object.scale, object.scale],
        handHeld ? 0.03 : 0.1,
        delta,
      );
    }

    // Idle spin, paused while held or dragged, and with reduced motion.
    if (kind?.spin && spin.current && !instant && !handHeld && !drag.current) {
      spin.current.rotation.y += kind.spin * delta;
    }

    // Strokes brighten and thicken a little when held, selected or hovered.
    if (lineRef.current) {
      const sm = lineRef.current.material as MeshBasicMaterial;
      const handHover = handRuntime.hovered.has(object.id);
      const on = handHeld || selected || hovered.current || handHover;
      sm.opacity += ((on ? 1 : 0.8) - sm.opacity) * Math.min(1, delta * 10);
    }

    const m = body.current?.material as ShaderMaterial | undefined;
    if (m?.uniforms?.uTime && m.uniforms.uHighlight) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      const handHover = handRuntime.hovered.has(object.id);
      const target = handHeld ? 1.5 : selected ? 1 : hovered.current || handHover ? 0.45 : 0;
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
    // A hand is holding this object; the mouse waits its turn.
    if (handRuntime.held.has(object.id)) return;
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
    handRuntime.mouseDragId = object.id;
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
    if (handRuntime.mouseDragId === object.id) handRuntime.mouseDragId = null;
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
        <group ref={spin}>
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
          {stroke && strokeMaterial && (
            <mesh
              ref={lineRef}
              geometry={stroke.tube}
              material={strokeMaterial}
              raycast={() => null}
            />
          )}
          {edges && (
            <lineSegments geometry={edges} raycast={() => null}>
              <lineBasicMaterial
                color={style.color}
                transparent
                opacity={selected ? 0.55 : 0.22}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </lineSegments>
          )}
        </group>
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
