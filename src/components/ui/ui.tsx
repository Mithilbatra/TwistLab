import { Fragment, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Move } from '../../engine/core/Move';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

const VARIANTS = {
  primary:
    'key bg-accent font-semibold text-accent-ink [--key-edge:color-mix(in_oklab,var(--color-accent)_48%,black)] hover:brightness-110',
  outline: 'key bg-raised text-zinc-200 hover:bg-[#282a30] hover:text-zinc-50',
  ghost: 'text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS };

export function Button({ variant = 'outline', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap',
        'disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[15px] [&_svg]:shrink-0',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

/** A square button showing only an icon. `label` is its accessible name and its tooltip. */
export function IconButton({ label, variant = 'ghost', className, ...props }: ButtonProps & { label: string }) {
  return <Button variant={variant} aria-label={label} title={label} {...props} className={cx('w-8 px-0', className)} />;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cx('flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.16em] text-zinc-400 uppercase', className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-[1px] bg-accent" />
      {children}
    </h2>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-raised px-1 font-mono text-[11px] text-zinc-100 shadow-[0_2px_0_0_#000,inset_0_1px_0_0_#ffffff26]">
      {children}
    </kbd>
  );
}

/**
 * A sequence drawn as stickers. Each move takes the colour of the face it turns
 * (`faces`, from the engine's `turnedFaces`); slices and rotations stay grey.
 */
export function Stickers({ moves, faces, className }: { moves: readonly Move[]; faces: readonly (number | null)[]; className?: string }) {
  return (
    <code className={cx('flex flex-wrap gap-1', className)}>
      {moves.map((move, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span data-sticker={faces[i] ?? 'n'} data-lit="" className="chip h-6 min-w-6 rounded-[5px] px-1 text-xs">
            {move.notation}
          </span>
        </Fragment>
      ))}
    </code>
  );
}

/** Three rows of stickers with the top layer part-way through a turn. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 24" className={cx('h-6 w-[26px] shrink-0', className)} aria-hidden="true">
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((column) => (
          <rect
            key={`${row}${column}`}
            x={2 + column * 6.75 + (row === 0 ? 3 : 0)}
            y={2.5 + row * 6.75}
            width="5.5"
            height="5.5"
            rx="1.3"
            className={row === 0 ? 'fill-accent' : row === 1 ? 'fill-zinc-200' : 'fill-zinc-500'}
          />
        )),
      )}
    </svg>
  );
}
