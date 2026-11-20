import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight ' +
  'transition-[background-color,box-shadow,color,transform] duration-200 ease-(--ease-out-expo) ' +
  'disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] select-none';

const variants: Record<Variant, string> = {
  primary:
    'text-void bg-[linear-gradient(110deg,var(--color-holo-cyan),#b9f4ff_45%,var(--color-holo-violet))] ' +
    'shadow-[0_0_0_1px_rgb(255_255_255/0.25)_inset,0_10px_40px_-12px_var(--color-holo-cyan)] ' +
    'hover:shadow-[0_0_0_1px_rgb(255_255_255/0.35)_inset,0_14px_50px_-10px_var(--color-holo-cyan)]',
  secondary: 'glass-inset text-ink-1 hover:bg-white/[0.07] hover:border-line-strong',
  ghost: 'text-ink-2 hover:text-ink-1 hover:bg-white/[0.05]',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-[15px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    />
  );
});

/** Same styling as Button, for router links and anchors. */
export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md', extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}
