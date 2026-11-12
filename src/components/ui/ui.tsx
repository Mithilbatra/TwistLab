import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

const VARIANTS = {
  primary: 'bg-accent font-semibold text-accent-ink hover:bg-accent/85',
  outline: 'border border-line bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08] hover:text-zinc-50',
  ghost: 'text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS };

export function Button({ variant = 'outline', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
        'disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[15px] [&_svg]:shrink-0',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

/** A square button showing only an icon. `label` is its accessible name and its tooltip. */
export function IconButton({ label, className, ...props }: ButtonProps & { label: string }) {
  return <Button variant="ghost" aria-label={label} title={label} {...props} className={cx('w-8 px-0', className)} />;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cx('text-[11px] font-medium tracking-[0.14em] text-zinc-500 uppercase', className)}>{children}</h2>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-white/[0.06] px-1 font-mono text-[11px] text-zinc-200">
      {children}
    </kbd>
  );
}

/** An isometric cube with its top layer about to turn. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-6 shrink-0', className)} aria-hidden="true">
      <path d="M12 2 20.66 7 12 12 3.34 7Z" className="fill-accent" />
      <path d="M3.34 7 12 12v10l-8.66-5Z" className="fill-zinc-500" />
      <path d="M20.66 7 12 12v10l8.66-5Z" className="fill-zinc-300" />
      <path d="M3.34 10.6 12 15.6l8.66-5" className="fill-none stroke-panel" strokeWidth="1.2" />
    </svg>
  );
}
