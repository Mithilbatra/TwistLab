import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei';
import { Focus, ZoomIn, ZoomOut } from 'lucide-react';
import { MathUtils, NeutralToneMapping, Vector3, type PerspectiveCamera } from 'three';
import { PUZZLES } from '../../engine/puzzles';
import { useCube } from '../../store/cubeStore';
import { LIMITS, useSettings } from '../../store/settingsStore';
import { IconButton } from '../ui/ui';
import { CubeModel } from './CubeModel';

/** Where the camera sits by default: up, front and right faces in view. */
const HOME_DIRECTION = new Vector3(0.58, 0.44, 0.69).normalize();
/** Radius of the sphere the cube turns inside, with breathing room. */
const FRAMED_RADIUS = 2.6 * 1.42;
const FLOOR = -2.45;

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
      <Grid
        position={[0, FLOOR - 0.01, 0]}
        infiniteGrid
        cellSize={0.75}
        sectionSize={3}
        cellThickness={0.7}
        sectionThickness={1}
        cellColor="#3d424c"
        sectionColor="#5a606c"
        fadeDistance={22}
        fadeStrength={1.8}
      />
      <CameraRig />
    </>
  );
}

function MoveIndicator() {
  const last = useCube((s) => s.lastTurn);
  if (!last) return null;
  return (
    <div className="pointer-events-none absolute top-3 left-4 select-none">
      <div className="text-[10px] font-medium tracking-[0.16em] text-zinc-500 uppercase">Move</div>
      <div
        key={last.serial}
        data-testid="current-move"
        className="animate-move-in font-mono text-4xl leading-tight font-medium text-zinc-50 motion-reduce:animate-none"
      >
        {last.notation}
      </div>
    </div>
  );
}

function CameraControls() {
  const fov = useSettings((s) => s.fov);
  const setFov = useSettings((s) => s.setFov);
  return (
    <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border border-line bg-base/55 p-1 backdrop-blur-md">
      <IconButton label="Zoom out" onClick={() => cameraActions.zoom(1.15)}>
        <ZoomOut />
      </IconButton>
      <IconButton label="Zoom in" onClick={() => cameraActions.zoom(1 / 1.15)}>
        <ZoomIn />
      </IconButton>
      <IconButton label="Reset camera" onClick={() => cameraActions.reset()}>
        <Focus />
      </IconButton>
      <label className="ml-1 hidden items-center gap-2 border-l border-line pr-2 pl-3 sm:flex">
        <span className="text-[11px] text-zinc-500">Perspective</span>
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

export function Viewport() {
  // In the timer the cube only previews the scramble, so it cannot be turned.
  const turnable = useSettings((s) => s.view !== 'timer');
  return (
    <section aria-label="3D puzzle" className="viewport relative min-h-0 flex-1">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: 35, near: 0.5, far: 90, position: HOME_DIRECTION.toArray() }}
        gl={{ toneMapping: NeutralToneMapping }}
      >
        <Scene />
      </Canvas>
      <MoveIndicator />
      <p className="pointer-events-none absolute top-4 right-4 hidden text-right text-[11px] leading-relaxed text-zinc-600 select-none sm:block">
        {turnable && 'Drag a face to turn it'}
        <br />
        Drag the background to orbit
      </p>
      <CameraControls />
    </section>
  );
}
