import { useEffect, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, Vector3, type Group, type Mesh } from 'three';
import type { AnimationQueue } from '../../engine/animation/AnimationQueue';
import { clockTurn, movingDials, PIN_SETS, type ClockMove, type ClockState } from '../../engine/puzzles/clock';
import { animation as sharedQueue, useCube } from '../../store/cubeStore';
import { canTurn, useSettings } from '../../store/settingsStore';
import { DRAG_THRESHOLD, easeInOut, TURN_SECONDS } from './CubeModel';

// The queue is shared by every puzzle. While this model is mounted it holds the Clock's states and moves.
const animation: AnimationQueue<ClockState, ClockMove> = sharedQueue;

const RADIUS = 2.45;
const THICKNESS = 0.62;
const FACE = THICKNESS / 2;
const SPACING = 1.12;
const DIAL = 0.42;
const HOUR = Math.PI / 6;
/** Where dial i sits, read row by row from its own side. Seen from behind, left and right swap. */
const at = (i: number, behind: boolean): [number, number] => [((i % 3) - 1) * SPACING * (behind ? -1 : 1), (1 - Math.floor(i / 3)) * SPACING];
const PINS = ['UL', 'UR', 'DL', 'DR'] as const;
const PIN_AT = { UL: [-1, 1], UR: [1, 1], DL: [-1, -1], DR: [1, -1] } as const;
/** The pin settings a dial turns when it is dragged: a corner its own pin, an edge the two beside it, the centre all four. */
const GRAB = ['UL', 'U', 'UR', 'L', 'ALL', 'R', 'DL', 'D', 'DR'];

const face = new CylinderGeometry(DIAL, DIAL, 0.05, 48).rotateX(Math.PI / 2);
const hand = new BoxGeometry(0.075, DIAL * 0.82, 0.03).translate(0, DIAL * 0.41, 0);
const notch = new BoxGeometry(0.05, 0.1, 0.03).translate(0, DIAL * 0.82, 0);
const pin = new CylinderGeometry(0.09, 0.09, 0.34, 16).rotateX(Math.PI / 2);
const wheel = new CylinderGeometry(1.0, 1.0, 0.18, 30).rotateX(Math.PI / 2);
const body = new CylinderGeometry(RADIUS, RADIUS, THICKNESS, 96).rotateX(Math.PI / 2);
const plate = new CylinderGeometry(RADIUS - 0.12, RADIUS - 0.12, 0.02, 96).rotateX(Math.PI / 2);

// One face is blue with white dials, the other pale with dark ones, so you can always tell which way round it is.
const plastic = new MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.55 });
const frontPlate = new MeshStandardMaterial({ color: '#1d5bdc', roughness: 0.45 });
const backPlate = new MeshStandardMaterial({ color: '#e7e9ee', roughness: 0.5 });
const frontDial = new MeshStandardMaterial({ color: '#f5f6f8', roughness: 0.35 });
const backDial = new MeshStandardMaterial({ color: '#1a1d23', roughness: 0.4 });
const darkHand = new MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.4 });
const lightHand = new MeshStandardMaterial({ color: '#f5f6f8', roughness: 0.4 });
const twelve = new MeshStandardMaterial({ color: '#d8222f', roughness: 0.4 });
const metal = new MeshStandardMaterial({ color: '#c7ccd6', roughness: 0.3, metalness: 0.6 });
const SKINS = [
  { plate: frontPlate, dial: frontDial, hand: darkHand },
  { plate: backPlate, dial: backDial, hand: lightHand },
] as const;

/**
 * Draws the Clock from the animation queue. As with the other models, every frame
 * starts from an exact engine state: the dials of a turn in progress are swung part
 * of the way, and y2 swings the whole clock round before the next state takes over.
 */
export function ClockModel() {
  const clock = useRef<Group>(null);
  const hands = useRef<(Mesh | null)[]>([]); // 0–8 the front, 9–17 the back
  const faces = useRef<(Mesh | null)[]>([]);
  const plates = useRef<(Mesh | null)[]>([]);
  const wheels = useRef<(Mesh | null)[]>([]);
  const pins = useRef<(Mesh | null)[]>([]);
  /** The pins up for the last turn, kept on show until the next one. */
  const up = useRef<readonly string[]>([]);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => animation.subscribe(() => invalidate()), [invalidate]);

  useFrame((frame, delta) => {
    const turn = animation.current;
    if (turn) {
      const { speed } = useSettings.getState();
      const size = turn.move.kind === 'flip' ? 6 : Math.abs(turn.move.amount);
      animation.tick(Math.min(delta, 1 / 30) / ((TURN_SECONDS * (0.5 + size / 6)) / (speed * (1 + animation.backlog * 0.6))));
    }
    const now = animation.current;
    const state = now ? now.from : animation.displayed;
    const eased = now ? easeInOut(animation.progress) : 0;
    const move = now?.move;
    const moving = move?.kind === 'turn' ? movingDials(move.pins) : { front: [], back: [] };
    if (move?.kind === 'turn') up.current = PIN_SETS[move.pins];
    if (move?.kind === 'flip') up.current = [];
    const swing = move?.kind === 'turn' ? eased * move.amount : 0;

    // The face towards you is whichever one the state says, so turning the clock over reads continuously.
    const near = SKINS[state.flipped ? 1 : 0];
    const far = SKINS[state.flipped ? 0 : 1];
    plates.current.forEach((mesh, k) => {
      if (mesh) mesh.material = (k === 0 ? near : far).plate;
    });
    for (let i = 0; i < 18; i++) {
      const skin = i < 9 ? near : far;
      if (faces.current[i]) faces.current[i]!.material = skin.dial;
      if (hands.current[i]) hands.current[i]!.material = skin.hand;
    }

    for (let i = 0; i < 9; i++) {
      // Clockwise seen from a dial's own side is the negative way round its own z axis. The back's dials sit in groups
      // turned to face backwards, so the same holds for them.
      const front = state.front[i] + (moving.front.includes(i) ? swing : 0);
      const back = state.back[i] - (moving.back.includes(i) ? swing : 0);
      hands.current[i]?.rotation.set(0, 0, -front * HOUR);
      hands.current[9 + i]?.rotation.set(0, 0, -back * HOUR);
    }
    // Each wheel shares an axle with its corner dials.
    [0, 2, 6, 8].forEach((corner, k) => {
      const turned = state.front[corner] + (moving.front.includes(corner) ? swing : 0);
      wheels.current[k]?.rotation.set(0, 0, -turned * HOUR);
    });
    PINS.forEach((name, k) => pins.current[k]?.position.setZ(up.current.includes(name) ? FACE + 0.1 : -FACE - 0.1));
    clock.current?.rotation.set(0, move?.kind === 'flip' ? eased * Math.PI : 0, 0);
    if (animation.busy) frame.invalidate();
  });

  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;

  /** Drag a front dial round to turn it, with the pins its position calls for, one hour that way. */
  const startDrag = (event: ThreeEvent<PointerEvent>) => {
    const dial = event.intersections[0]?.object.userData.dial as number | undefined;
    if (dial === undefined || animation.busy || event.nativeEvent.button !== 0 || !canTurn(useSettings.getState().view)) return;
    event.stopPropagation();
    if (controls) controls.enabled = false;
    const [x, y] = at(dial, false);
    const centre = clock.current!.localToWorld(new Vector3(x, y, FACE)).project(camera);
    const middle = [((centre.x + 1) * size.width) / 2, ((1 - centre.y) * size.height) / 2];
    const { clientX, clientY } = event.nativeEvent;
    const { left, top } = (event.nativeEvent.target as HTMLElement).getBoundingClientRect();
    const grab = [clientX - left - middle[0], clientY - top - middle[1]];

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
      finish();
      // On screen, with y pointing down, a positive cross product is a clockwise swing round the dial.
      const cross = grab[0] * dy - grab[1] * dx;
      if (cross !== 0) useCube.getState().turn([clockTurn(GRAB[dial], cross > 0 ? 1 : -1)]);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const dials = (behind: boolean) =>
    Array.from({ length: 9 }, (_, i) => {
      const [x, y] = at(i, behind);
      const z = behind ? -FACE - 0.03 : FACE + 0.03;
      return (
        // The back's dials face backwards: turned half a turn about y, they read correctly from behind.
        <group key={`${behind}${i}`} position={[x, y, z]} rotation={[0, behind ? Math.PI : 0, 0]}>
          <mesh
            geometry={face}
            material={behind ? backDial : frontDial}
            userData={behind ? {} : { dial: i }}
            ref={(mesh) => {
              faces.current[(behind ? 9 : 0) + i] = mesh;
            }}
          />
          <mesh geometry={notch} material={twelve} position-z={0.03} userData={behind ? {} : { dial: i }} />
          <mesh
            geometry={hand}
            material={behind ? lightHand : darkHand}
            position-z={0.045}
            userData={behind ? {} : { dial: i }}
            ref={(mesh) => {
              hands.current[(behind ? 9 : 0) + i] = mesh;
            }}
          />
        </group>
      );
    });

  return (
    <group ref={clock} onPointerDown={startDrag}>
      <mesh geometry={body} material={plastic} />
      {[1, -1].map((side, k) => (
        <mesh
          key={side}
          geometry={plate}
          material={k === 0 ? frontPlate : backPlate}
          position-z={side * (FACE + 0.005)}
          ref={(mesh) => {
            plates.current[k] = mesh;
          }}
        />
      ))}
      {dials(false)}
      {dials(true)}
      {PINS.map((name, k) => (
        <mesh
          key={name}
          geometry={pin}
          material={metal}
          position={[(PIN_AT[name][0] * SPACING) / 2, (PIN_AT[name][1] * SPACING) / 2, -FACE - 0.1]}
          ref={(mesh) => {
            pins.current[k] = mesh;
          }}
        />
      ))}
      {[0, 2, 6, 8].map((corner, k) => {
        const [x, y] = at(corner, false);
        return (
          <mesh
            key={corner}
            geometry={wheel}
            material={metal}
            position={[x, y, 0]}
            ref={(mesh) => {
              wheels.current[k] = mesh;
            }}
          />
        );
      })}
    </group>
  );
}
