import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Focus, ZoomIn, ZoomOut } from 'lucide-react';
import { CanvasTexture, MathUtils, NeutralToneMapping, RepeatWrapping, Vector3, type PerspectiveCamera } from 'three';
import { turnedFace } from '../../engine/core/CubeState';
import { PUZZLES } from '../../engine/puzzles';
import { useCube } from '../../store/cubeStore';
import { LIMITS, useSettings } from '../../store/settingsStore';
import { cx, IconButton } from '../ui/ui';
import { CubeModel } from './CubeModel';

/** Where the camera sits by default: up, front and right faces in view. */
const HOME_DIRECTION = new Vector3(0.58, 0.44, 0.69).normalize();
/** Radius of the sphere the cube turns inside, with breathing room. */
const FRAMED_RADIUS = 2.6 * 1.42;
const FLOOR = -2.45;
/** Side of the floor plane, and the spacing of the dots on it, in world units. */
const FLOOR_SIZE = 36;
const DOT_PITCH = 0.75;

/** Camera actions for the buttons that live outside the canvas. Filled in by CameraRig. */
const cameraActions = { reset: () => {}, zoom: (_factor: number) => {} };

const target = new Vector3();

function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as { update(): void } | null;
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const fov = useSettings((s) => s.fov);
  const resetting = useRef(false);

  // Distance at which the framed sphere fills the shorter side of the view. Narrow perspectives stand further back,
  // so changing the field of view changes the perspective distortion and not the size of the cube.
  const fit = FRAMED_RADIUS / Math.sin(Math.atan(Math.tan(MathUtils.degToRad(fov) / 2) * Math.min(1, aspect)));

  useEffect(() => {
    camera.fov = fov;
    camera.position.setLength(fit);
    camera.updateProjectionMatrix();
    controls?.update();
    invalidate();
    cameraActions.reset = () => {
      resetting.current = true;
      invalidate();
    };
    cameraActions.zoom = (factor) => {
      camera.position.setLength(MathUtils.clamp(camera.position.length() * factor, fit * 0.6, fit * 2));
      controls?.update();
      invalidate();
    };
  }, [camera, controls, invalidate, fov, fit]);

  useFrame((frame, delta) => {
    if (!resetting.current) return;
    target.copy(HOME_DIRECTION).multiplyScalar(fit);
    const blend = 1 - Math.exp(-9 * Math.min(delta, 1 / 30));
    // Blend direction and distance separately so the camera swings around the cube instead of cutting through it.
    const length = MathUtils.lerp(camera.position.length(), fit, blend);
    camera.position.lerp(target, blend).setLength(length);
    if (camera.position.distanceTo(target) < 0.02) {
      camera.position.copy(target);
      resetting.current = false;
    }
    frame.invalidate();
  });

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.85}
      minDistance={fit * 0.6}
      maxDistance={fit * 2}
      onStart={() => {
        resetting.current = false;
      }}
    />
  );
}

/** A floor of square dots fading into the dark: ground under the cube that moves with the camera. */
function Floor() {
  const [dots, fade] = useMemo(() => {
    const paint = (size: number, draw: (context: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      draw(canvas.getContext('2d')!);
      return new CanvasTexture(canvas);
    };
    const dots = paint(64, (context) => {
      context.fillStyle = '#fff';
      context.fillRect(27, 27, 10, 10);
    });
    dots.wrapS = dots.wrapT = RepeatWrapping;
    dots.repeat.set(FLOOR_SIZE / DOT_PITCH, FLOOR_SIZE / DOT_PITCH);
    dots.anisotropy = 8;
    const fade = paint(128, (context) => {
      const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0.08, '#fff');
      gradient.addColorStop(1, '#000');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    });
    return [dots, fade];
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={FLOOR - 0.01}>
      <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      <meshBasicMaterial map={dots} alphaMap={fade} transparent opacity={0.26} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Scene() {
  const puzzleId = useCube((s) => s.puzzleId);
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 8, 6]} intensity={1.5} />
      {/* Fill from the right, so the side face keeps its colour instead of falling into shadow. */}
      <directionalLight position={[8, 2, 1]} intensity={0.7} />
      {/* A procedural studio: three soft boxes and a rim light. Nothing is downloaded. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.6} position={[0, 7, 1]} scale={[11, 11, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.3} position={[-7, 1.5, 3]} scale={[9, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} position={[7, 2, -3]} scale={[9, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.6} position={[3, 3, 8]} scale={2.5} target={[0, 0, 0]} />
      </Environment>
      <CubeModel key={puzzleId} puzzle={PUZZLES[puzzleId]} />
      <ContactShadows position={[0, FLOOR, 0]} scale={12} far={5} blur={2.2} opacity={0.85} resolution={512} />
      <Floor />
      <CameraRig />
    </>
  );
}

/**
 * What stands behind the cube. The canvas is transparent, so all of this shows through it:
 * light in the colour of the face that last turned, every colour at once while the cube is
 * solved, and the move itself set in dots.
 */
function Backdrop() {
  const last = useCube((s) => s.lastTurn);
  const solved = useCube((s) => PUZZLES[s.puzzleId].isSolved(s.state));
  const face = useCube((s) => {
    const puzzle = PUZZLES[s.puzzleId];
    // "R2" and "R'" turn the same face as "R": the suffix says how far, not which.
    const turned = s.lastTurn && puzzle.table[s.lastTurn.notation.replace(/[2']/g, '')];
    return turned ? turnedFace(s.state, turned, puzzle.size) : null;
  });
  return (
    // With no face to name (a slice, a rotation, a 2×2) the colour falls back to the section's own.
    <div
      data-sticker={face ?? undefined}
      data-solved={solved || undefined}
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      <div aria-hidden="true" className="stage-halo" />
      <div aria-hidden="true" className="stage-aurora" />
      {last && (
        <div className="absolute top-4 left-5 sm:top-5 sm:left-6">
          <div className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted uppercase">Last move</div>
          <div
            key={last.serial}
            data-testid="current-move"
            className="stage-glyph mt-2 animate-stamp motion-reduce:animate-none motion-reduce:opacity-60"
          >
            {last.notation}
          </div>
        </div>
      )}
    </div>
  );
}

function CameraControls() {
  const fov = useSettings((s) => s.fov);
  const setFov = useSettings((s) => s.setFov);
  return (
    <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-xl bg-panel/85 p-1 shadow-[inset_0_0_0_1px_#ffffff1a] backdrop-blur-md">
      <IconButton label="Zoom out" onClick={() => cameraActions.zoom(1.15)}>
        <ZoomOut />
      </IconButton>
      <IconButton label="Zoom in" onClick={() => cameraActions.zoom(1 / 1.15)}>
        <ZoomIn />
      </IconButton>
      <IconButton label="Reset camera" onClick={() => cameraActions.reset()}>
        <Focus />
      </IconButton>
      <label className="ml-1 hidden items-center gap-2 border-l border-dotted border-white/30 pr-2 pl-3 sm:flex">
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">Perspective</span>
        <input
          type="range"
          className="w-20"
          min={LIMITS.fov[0]}
          max={LIMITS.fov[1]}
          step={1}
          value={fov}
          onChange={(event) => setFov(Number(event.target.value))}
        />
      </label>
    </div>
  );
}

const CORNERS = [
  'top-2.5 left-2.5 border-t border-l',
  'top-2.5 right-2.5 border-t border-r',
  'bottom-2.5 left-2.5 border-b border-l',
  'right-2.5 bottom-2.5 border-r border-b',
];

export function Viewport() {
  // In the timer the cube only previews the scramble, so it cannot be turned.
  const turnable = useSettings((s) => s.view !== 'timer');
  return (
    <section aria-label="3D puzzle" className="stage relative min-h-0 flex-1">
      <Backdrop />
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: 35, near: 0.5, far: 90, position: HOME_DIRECTION.toArray() }}
        gl={{ toneMapping: NeutralToneMapping }}
      >
        <Scene />
      </Canvas>
      {CORNERS.map((corner) => (
        <span key={corner} aria-hidden="true" className={cx('pointer-events-none absolute size-2.5 border-white/30', corner)} />
      ))}
      <p className="pointer-events-none absolute top-5 right-6 hidden text-right font-mono text-[10px] leading-relaxed tracking-[0.14em] text-muted uppercase select-none sm:block">
        {turnable && 'Drag a face to turn it'}
        <br />
        Drag the background to orbit
      </p>
      <CameraControls />
    </section>
  );
}
