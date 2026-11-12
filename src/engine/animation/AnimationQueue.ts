/**
 * Sequences turn animations for a renderer.
 *
 * The queue never computes puzzle state. Each turn arrives carrying the exact
 * logical state before (`from`) and after (`to`) it; the renderer interpolates
 * between the two and, when the turn completes, shows `to` verbatim. However
 * turns are queued, sped up, interrupted or dropped, the screen can only ever
 * come to rest on a state the engine produced.
 */
export interface Turn<S, M> {
  readonly move: M;
  readonly from: S;
  readonly to: S;
}

export class AnimationQueue<S, M> {
  /** State shown when nothing is animating. */
  displayed: S;
  /** Turn being animated, if any. */
  current: Turn<S, M> | null = null;
  /** Progress of `current`, from 0 to 1. */
  progress = 0;
  /** When true a turn completes the moment it is queued. */
  instant = false;

  private pending: Turn<S, M>[] = [];
  private idleWaiters: (() => void)[] = [];
  private listeners = new Set<() => void>();

  constructor(initial: S) {
    this.displayed = initial;
  }

  get busy(): boolean {
    return this.current !== null;
  }

  /** Turns waiting behind the current one. */
  get backlog(): number {
    return this.pending.length;
  }

  enqueue(turn: Turn<S, M>): void {
    if (this.instant) return this.reset(turn.to);
    this.pending.push(turn);
    if (!this.current) this.advance();
    this.notify();
  }

  /** Moves the current turn forward by `fraction` of its duration and completes it at 1. */
  tick(fraction: number): void {
    if (!this.current) return;
    this.progress += fraction;
    if (this.progress < 1) return;
    this.displayed = this.current.to;
    this.advance();
  }

  /** Drops every animation and shows `state` immediately. */
  reset(state: S): void {
    this.pending = [];
    this.displayed = state;
    this.advance();
    this.notify();
  }

  /** Resolves once nothing is animating or queued. */
  whenIdle(): Promise<void> {
    return this.current ? new Promise((resolve) => this.idleWaiters.push(resolve)) : Promise.resolve();
  }

  /** Calls `listener` whenever something is queued or dropped, so a paused render loop can wake up. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private advance(): void {
    this.current = this.pending.shift() ?? null;
    this.progress = 0;
    if (!this.current) for (const resolve of this.idleWaiters.splice(0)) resolve();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
