import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'inline-grid size-9 place-items-center rounded-(--radius-control) text-ink-2',
        'transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink-1',
        active && 'bg-white/[0.06] text-holo-cyan',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
