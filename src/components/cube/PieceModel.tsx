import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Mesh } from 'three';
import { STICKERS } from '../../engine/puzzles';
import type { PieceModel as Model } from '../../engine/puzzles/PuzzleEngine';
import { animation, useCube } from '../../store/cubeStore';
import { canTurn, useSettings } from '../../store/settingsStore';
import { DRAG_THRESHOLD, easeInOut, TURN_SECONDS } from './CubeModel';

const BODY = new Color('#0b0c0e');
const COLOURS = STICKERS.map((hex) => new Color(hex));
// One material for every piece: each corner of each triangle carries its own colour, body or sticker.
const plastic = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05 });

// Scratch objects reused every frame, so animating allocates nothing.
const scratchMatrix = new Matrix4();
const spin = new Quaternion();

/** A puzzle's rotations as quaternions, converted once each and then reused. */
const quaternions = new WeakMap<readonly number[], Quaternion>();
function quaternionOf(rot: readonly number[]): Quaternion {
  let quaternion = quaternions.get(rot);
  if (!quaternion) {
    scratchMatrix.set(rot[0], rot[1], rot[2], 0, rot[3], rot[4], rot[5], 0, rot[6], rot[7], rot[8], 0, 0, 0, 0, 1);
    quaternion = new Quaternion().setFromRotationMatrix(scratchMatrix);
    quaternions.set(rot, quaternion);
  }
  return quaternion;
}

/**
 * Renders any puzzle that is modelled piece by piece, from the animation queue.
 *
 * It works as CubeModel does for cubes. Every piece is a solid modelled in its
 * solved place. Each frame it is given the rotation the engine's state says it has,
 * and the pieces riding on a turn in progress are turned a little further about
 * that turn's axis. Nothing is integrated over time, so the model cannot drift.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PieceModel({ model }: { model: Model<any, any> }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const invalidate = useThree((s) => s.invalidate);

  const geometries = useMemo(
    () =>
      model.pieces.map(({ positions, tags }) => {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
        const colours = new Float32Array(tags.length * 3);
        tags.forEach((tag, i) => (tag < 0 ? BODY : COLOURS[tag]).toArray(colours, i * 3));
        geometry.setAttribute('color', new BufferAttribute(colours, 3));
        geometry.computeVertexNormals();
        return geometry;
      }),
    [model],
  );
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);

  // The canvas only renders on demand: wake it whenever a turn is queued or the puzzle is replaced.
  useEffect(() => animation.subscribe(() => invalidate()), [invalidate]);

  // What the turn in progress does, worked out once when it starts rather than every frame.
  const turning = useRef<{ turn: object; axis: Vector3; angle: number; moving: readonly boolean[] } | null>(null);
  const describe = () => {
    const turn = animation.current;
    if (!turn) return null;
    if (turning.current?.turn !== turn) {
      const { axis, angle, moving } = model.turning(turn.from, turn.move);
      turning.current = { turn, axis: new Vector3(...axis), angle, moving };
    }
    return turning.current;
  };

  useFrame((frame, delta) => {
    const before = describe();
    if (before) {
      const { speed } = useSettings.getState();
      // A quarter turn takes TURN_SECONDS, a half turn half as long again; a backlog plays faster.
      const seconds = (TURN_SECONDS * (0.5 + Math.abs(before.angle) / Math.PI)) / (speed * (1 + animation.backlog * 0.6));
      animation.tick(Math.min(delta, 1 / 30) / seconds);
    }

    const turn = describe();
    const state = animation.current ? animation.current.from : animation.displayed;
    if (turn) spin.setFromAxisAngle(turn.axis, easeInOut(animation.progress) * turn.angle);
    for (let i = 0; i < geometries.length; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      mesh.quaternion.copy(quaternionOf(model.pose(state, i)));
      if (turn?.moving[i]) mesh.quaternion.premultiply(spin);
    }
    if (animation.busy) frame.invalidate();
  });

  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;

  /**
   * Drag a piece to turn it. Several turns may carry the grabbed piece; the one
   * that would move the grabbed point most nearly the way the pointer went wins.
   */
  const startDrag = (event: ThreeEvent<PointerEvent>) => {
    if (animation.busy || event.nativeEvent.button !== 0 || !canTurn(useSettings.getState().view) || !event.face) return;
    const grips = model.grips(animation.displayed, event.object.userData.piece as number);
    if (grips.length === 0) return;

    event.stopPropagation();
    if (controls) controls.enabled = false; // the camera must not orbit while a piece is being dragged
    const grabbed = event.point.clone();
    const facing = event.face.normal.clone().transformDirection(event.object.matrixWorld);
    const centre = event.object.getWorldPosition(new Vector3());
    const { clientX, clientY } = event.nativeEvent;
    const toScreen = (point: Vector3) => {
      const projected = point.clone().project(camera);
      return [(projected.x * size.width) / 2, (-projected.y * size.height) / 2];
    };

    const finish = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (controls) controls.enabled = true;
    };

    const onMove = (pointer: PointerEvent) => {
      const dx = pointer.clientX - clientX;
      const dy = pointer.clientY - clientY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      const [x0, y0] = toScreen(grabbed);
      let best: { turn(direction: 1 | -1): unknown; along: number } | null = null;
      for (const grip of grips) {
        const axis = new Vector3(...grip.axis);
        // As on a cube, dragging across a face does not spin that face: it turns a layer beside it.
        if (Math.abs(axis.dot(facing)) > 0.9) continue;
        // Where the grabbed point would head if this turn went counter-clockwise about its axis.
        const heading = axis.cross(grabbed.clone().sub(centre));
        if (heading.lengthSq() < 1e-6) continue;
        const [x1, y1] = toScreen(grabbed.clone().addScaledVector(heading.normalize(), 0.5));
        const along = (dx * (x1 - x0) + dy * (y1 - y0)) / Math.hypot(x1 - x0, y1 - y0);
        if (Number.isFinite(along) && (!best || Math.abs(along) > Math.abs(best.along))) best = { turn: grip.turn, along };
      }
      finish();
      if (best && best.along !== 0) useCube.getState().turn([best.turn(best.along > 0 ? 1 : -1) as { notation: string }]);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  return (
    <group scale={model.scale} position-y={-model.drop} onPointerDown={startDrag}>
      {geometries.map((geometry, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={plastic}
          userData={{ piece: i }}
          ref={(mesh) => {
            meshes.current[i] = mesh;
          }}
        />
      ))}
    </group>
  );
}
