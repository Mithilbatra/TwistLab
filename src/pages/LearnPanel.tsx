import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Dumbbell, Play } from 'lucide-react';
import { Transport } from '../components/algorithm/Transport';
import { Button, cx, Label, Stickers } from '../components/ui/ui';
import { demoSetup, demoStrip, HOLD, laterPieces, lessonDone, LESSONS, parse3x3, practiceSetup } from '../engine/algorithms/lessons';
import { PUZZLES } from '../engine/puzzles';
import { useAlgorithm } from '../store/algorithmStore';
import { useCube } from '../store/cubeStore';

export function LearnPanel() {
  const ready = useCube((s) => s.puzzleId === '3x3');
  const completed = useAlgorithm((s) => s.completedLessons);
  // Open on the first lesson not yet completed.
  const [step, setStep] = useState(() => Math.max(0, LESSONS.findIndex((lesson) => !completed.includes(lesson.id))));
  const [practising, setPractising] = useState(false);
  const lesson = LESSONS[step];
  const isComplete = completed.includes(lesson.id);

  // Show the lesson's stage on the cube: held white-down, with the pieces of later steps greyed out.
  useEffect(() => {
    if (!ready) return;
    useAlgorithm.getState().close();
    useCube.getState().load(HOLD);
    useCube.getState().setDimmed(laterPieces(lesson));
    setPractising(false);
    return () => useCube.getState().setDimmed(null);
  }, [lesson, ready]);

  // Practice is judged on the cube's real state, not on which moves were made.
  const solved = useCube((s) => practising && s.puzzleId === '3x3' && lessonDone(lesson, s.state));
  const movesUsed = useCube((s) => s.history.filter((move) => PUZZLES[s.puzzleId].countsAsMove(move)).length);
  useEffect(() => {
    if (solved) useAlgorithm.getState().setLessonDone(lesson.id, true);
  }, [solved, lesson]);

  if (!ready)
    return (
      <section className="px-4 py-4">
        <Label>Learn</Label>
        <p className="mt-2 leading-relaxed text-zinc-400">The beginner's method is taught on the 3×3.</p>
        <Button className="mt-3" onClick={() => useCube.getState().setPuzzle('3x3')}>
          Switch to the 3×3
        </Button>
      </section>
    );

  const demonstrate = (name: string, algorithm: string) => {
    const moves = parse3x3(algorithm);
    setPractising(false);
    const playback = useAlgorithm.getState();
    playback.open(moves, { title: name, setup: demoSetup(moves) });
    void playback.play();
  };

  const practise = () => {
    useAlgorithm.getState().close();
    useCube.getState().load(practiceSetup(lesson));
    setPractising(true);
  };

  return (
    <div className="divide-y divide-dotted divide-white/20">
      <section className="px-4 py-4">
        <div className="flex items-baseline justify-between">
          <Label>Beginner's method</Label>
          <span className="font-mono text-xs text-muted">
            <span className="text-zinc-100">{LESSONS.filter((l) => completed.includes(l.id)).length}</span> / {LESSONS.length} complete
          </span>
        </div>
        {/* One sticker per step: filled in once the step is done, ringed while it is open. */}
        <ol className="mt-3 flex gap-1.5">
          {LESSONS.map((item, i) => {
            const done = completed.includes(item.id);
            return (
              <li key={item.id} className="flex-1">
                <button
                  type="button"
                  title={item.title}
                  aria-label={`Step ${i + 1}: ${item.title}${done ? ', complete' : ''}`}
                  aria-current={i === step ? 'step' : undefined}
                  onClick={() => setStep(i)}
                  className={cx(
                    'flex aspect-square w-full items-center justify-center rounded-lg font-mono text-sm font-semibold transition-colors',
                    done ? 'bg-accent text-accent-ink' : 'bg-white/[0.06] text-zinc-400 hover:bg-white/[0.11] hover:text-zinc-100',
                    i === step && 'outline-2 outline-offset-2 outline-zinc-50',
                  )}
                >
                  {done ? <Check size={16} strokeWidth={3} /> : i + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Stays in view while the lesson scrolls, so a running demonstration is never off screen. */}
      <div className="sticky top-0 z-10 bg-panel empty:hidden">
        <Transport />
      </div>

      <section className="px-4 py-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
          Step {step + 1} of {LESSONS.length}
        </p>
        <h3 className="display mt-1.5 text-[26px] text-zinc-50 uppercase">{lesson.title}</h3>
        <p className="mt-2 leading-relaxed text-zinc-400">{lesson.goal}</p>
        <ol className="mt-3.5 space-y-2.5">
          {lesson.steps.map((text, i) => (
            <li key={i} className="flex gap-3 leading-relaxed">
              <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-[4px] bg-white/[0.08] font-mono text-[10px] font-semibold text-zinc-300">
                {i + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-4 py-4">
        <Label>Demonstrations</Label>
        <ul className="mt-3 space-y-4">
          {lesson.cases.map((item) => {
            const strip = demoStrip(item.algorithm);
            return (
              <li key={item.name} className="flex items-start gap-3 pb-1">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-zinc-100">{item.name}</h4>
                  <p className="text-xs text-muted">{item.when}</p>
                  <Stickers moves={strip.moves} faces={strip.faces} className="mt-2" />
                </div>
                <Button aria-label={`Demo: ${item.name}`} onClick={() => demonstrate(item.name, item.algorithm)}>
                  <Play />
                  Demo
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="px-4 py-4">
        <Label>Practice</Label>
        <p role="status" className={cx('mt-2 leading-relaxed', solved ? 'text-accent' : 'text-zinc-400')}>
          {!practising
            ? 'Get a random position for this step and solve it yourself. Grey pieces belong to later steps and can end up anywhere.'
            : solved
              ? `Step solved in ${movesUsed} ${movesUsed === 1 ? 'move' : 'moves'}. Inspect the cube, then carry on.`
              : 'Solve the coloured pieces. Turn with the keyboard or drag a face.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 pb-1">
          <Button variant={practising && !solved ? 'outline' : 'primary'} onClick={practise}>
            <Dumbbell />
            {practising ? 'New position' : 'Practice'}
          </Button>
          <Button aria-pressed={isComplete} onClick={() => useAlgorithm.getState().setLessonDone(lesson.id, !isComplete)}>
            {isComplete && <Check />}
            {isComplete ? 'Completed' : 'Mark complete'}
          </Button>
        </div>
      </section>

      <section className="flex justify-between px-3 py-3">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ChevronLeft />
          Previous
        </Button>
        <Button variant="ghost" disabled={step === LESSONS.length - 1} onClick={() => setStep(step + 1)}>
          Next step
          <ChevronRight />
        </Button>
      </section>
    </div>
  );
}
