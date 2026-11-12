import { useEffect, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ExtrudeGeometry, Matrix4, MeshStandardMaterial, Quaternion, Shape, Vector3, type Group, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Axis, Mat3 } from '../../engine/core/math';
import { moveForLayer } from '../../engine/core/Move';
import type { CubePuzzle } from '../../engine/puzzles/cubePuzzle';
import { animation, useCube } from '../../store/cubeStore';
import { useSettings } from '../../store/settingsStore';

/** World units per grid step. Grid coordinates are doubled, so 0.5 makes every cubie one unit wide. */
const STEP = 0.5;
/** Seconds for a quarter turn at 1× speed. */
const TURN_SECONDS = 0.28;
/** Pixels the pointer must travel before a drag on the cube commits to a turn. */
const DRAG_THRESHOLD = 14;

// One entry per side of a cubie, in the engine's order: +x −x +y −y +z −z (right, left, up, down, front, back).
// `rotation` turns a sticker, modelled facing +z, to face that side.
const FACES = [
  { color: '#d8222f', normal: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
  { color: '#f7791a', normal: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  { color: '#f2f3f5', normal: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
  { color: '#f8d313', normal: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] },
  { color: '#17a34f', normal: [0, 0, 1], rotation: [0, 0, 0] },
  { color: '#1d5bdc', normal: [0, 0, -1], rotation: [0, Math.PI, 0] },
] as const;

function roundedSquare(size: number, radius: number): Shape {
  const h = size / 2;
  const shape = new Shape();
  shape.moveTo(-h + radius, -h);
  shape.lineTo(h - radius, -h);
  shape.quadraticCurveTo(h, -h, h, -h + radius);
  shape.lineTo(h, h - radius);
  shape.quadraticCurveTo(h, h, h - radius, h);
  shape.lineTo(-h + radius, h);
  shape.quadraticCurveTo(-h, h, -h, h - radius);
  shape.lineTo(-h, -h + radius);
  shape.quadraticCurveTo(-h, -h, -h + radius, -h);
  return shape;
}

// Shared by every cubie: two geometries and eight materials for the whole puzzle.
const bodyGeometry = new RoundedBoxGeometry(0.98, 0.98, 0.98, 4, 0.09);
const stickerGeometry = new ExtrudeGeometry(roundedSquare(0.8, 0.12), { depth: 0.012, bevelEnabled: false, curveSegments: 6 });
const plastic = new MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.55, metalness: 0.05 });
const stickerMaterials = FACES.map(({ color }) => new MeshStandardMaterial({ color, roughness: 0.32 }));
const dimmedSticker = new MeshStandardMaterial({ color: '#2e3138', roughness: 0.7 });

// Scratch objects reused every frame, so animating allocates nothing.
const scratchMatrix = new Matrix4();
const turnAxis = new Vector3();
const turnRotation = new Quaternion();

/** The engine's 24 possible orientations as quaternions, converted once each and then reused. */
const quaternions = new WeakMap<Mat3, Quaternion>();
function quaternionOf(rot: Mat3): Quaternion {
  let quaternion = quaternions.get(rot);
  if (!quaternion) {
    scratchMatrix.set(rot[0], rot[1], rot[2], 0, rot[3], rot[4], rot[5], 0, rot[6], rot[7], rot[8], 0, 0, 0, 0, 1);
    quaternion = new Quaternion().setFromRotationMatrix(scratchMatrix);
    quaternions.set(rot, quaternion);
  }
  return quaternion;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Renders a cube puzzle from the animation queue.
 *
 * Nothing here is integrated over time. Every frame, each cubie is placed from an
 * exact engine state, and the cubies of a turning layer are then rotated together
 * about the turn axis by the eased angle. When the turn ends the next frame simply
 * draws the exact state after it, so the model cannot drift from the logic.
 */
export function CubeModel({ puzzle }: { puzzle: CubePuzzle }) {
  const groups = useRef<(Group | null)[]>([]);
  const dimmed = useCube((s) => s.dimmed);
  const invalidate = useThree((s) => s.invalidate);
  const max = puzzle.size - 1;

  // The canvas only renders on demand: wake it whenever a turn is queued or the cube is replaced.
  useEffect(() => animation.subscribe(() => invalidate()), [invalidate]);

  useFrame((frame, delta) => {
    if (animation.current) {
      const { speed } = useSettings.getState();
      const halfTurn = Math.abs(animation.current.move.turns) === 2;
      // A backlog (a scramble, fast typing) plays faster so the cube catches up with the logic.
      const seconds = (TURN_SECONDS * (halfTurn ? 1.5 : 1)) / (speed * (1 + animation.backlog * 0.6));
      // After an idle spell the first delta is the whole gap, so cap it at one slow frame.
      animation.tick(Math.min(delta, 1 / 30) / seconds);
    }

    const turn = animation.current;
    const cubies = turn ? turn.from : animation.displayed;
    if (turn) {
      turnAxis.set(0, 0, 0).setComponent(turn.move.axis, 1);
      turnRotation.setFromAxisAngle(turnAxis, easeInOut(animation.progress) * turn.move.turns * (Math.PI / 2));
    }
    for (let i = 0; i < cubies.length; i++) {
      const group = groups.current[i];
      if (!group) continue;
      const { pos, rot } = cubies[i];
      group.position.set(pos[0] * STEP, pos[1] * STEP, pos[2] * STEP);
      group.quaternion.copy(quaternionOf(rot));
      if (turn && turn.move.layers.includes(pos[turn.move.axis])) {
        group.position.applyQuaternion(turnRotation);
        group.quaternion.premultiply(turnRotation);
      }
    }
    if (animation.busy) frame.invalidate();
  });

  const startDrag = useDragToTurn(puzzle);

  return (
    <group scale={3 / puzzle.size} onPointerDown={startDrag}>
      {puzzle.createSolved().map(({ id, home }) => (
        <group
          key={id}
          userData={{ cubie: id }}
          ref={(group) => {
            groups.current[id] = group;
          }}
        >
          <mesh geometry={bodyGeometry} material={plastic} />
          {FACES.map(
            ({ normal, rotation }, face) =>
              // A side gets a sticker only where the cubie's home position is on the outside of the cube.
              home[face >> 1] === (face % 2 === 0 ? max : -max) && (
                <mesh
                  key={face}
                  geometry={stickerGeometry}
                  material={dimmed?.has(id) ? dimmedSticker : stickerMaterials[face]}
                  position={[normal[0] * 0.488, normal[1] * 0.488, normal[2] * 0.488]}
                  rotation={[rotation[0], rotation[1], rotation[2]]}
                />
              ),
          )}
        </group>
      ))}
    </group>
  );
}

/**
 * Drag a sticker to turn its layer. A drag across a face can turn one of two
 * layers; the one whose on-screen direction best matches the drag wins.
 */
function useDragToTurn(puzzle: CubePuzzle) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const max = puzzle.size - 1;

  return (event: ThreeEvent<PointerEvent>) => {
    if (animation.busy || event.nativeEvent.button !== 0 || useSettings.getState().view === 'timer') return;
    let object: Object3D | null = event.object;
    while (object && object.userData.cubie === undefined) object = object.parent;
    const cubie = object ? animation.displayed[object.userData.cubie as number] : undefined;
    if (!cubie || !event.face) return;

    // Which side of the cube was grabbed, as a world axis and a direction along it.
    const normal = event.face.normal.clone().transformDirection(event.object.matrixWorld);
    const faceAxis = ([0, 1, 2] as const).reduce((a, b) =>
      Math.abs(normal.getComponent(b)) > Math.abs(normal.getComponent(a)) ? b : a,
    );
    const faceSign = Math.sign(normal.getComponent(faceAxis));
    if (cubie.pos[faceAxis] !== faceSign * max) return; // not an outer face

    event.stopPropagation();
    if (controls) controls.enabled = false; // the camera must not orbit while a layer is being dragged
    const grabbed = event.point.clone();
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

      // Project both directions the surface can slide in, and measure the drag along each.
      const [x0, y0] = toScreen(grabbed);
      let best: { axis: Axis; along: number } | null = null;
      for (const axis of [0, 1, 2] as const) {
        if (axis === faceAxis) continue;
        const [x1, y1] = toScreen(grabbed.clone().setComponent(axis, grabbed.getComponent(axis) + 0.5));
        const along = (dx * (x1 - x0) + dy * (y1 - y0)) / Math.hypot(x1 - x0, y1 - y0);
        if (Number.isFinite(along) && (!best || Math.abs(along) > Math.abs(best.along))) best = { axis, along };
      }
      finish();
      if (!best || best.along === 0) return;

      // Sliding the surface along t turns the layer about n × t, which for unit axes is ± the third axis.
      const layerAxis = (3 - faceAxis - best.axis) as Axis;
      const handedness = (best.axis - faceAxis + 3) % 3 === 1 ? 1 : -1;
      const move = moveForLayer(puzzle.table, layerAxis, cubie.pos[layerAxis], Math.sign(best.along) * faceSign * handedness);
      if (move) useCube.getState().turn([move]);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };
}
