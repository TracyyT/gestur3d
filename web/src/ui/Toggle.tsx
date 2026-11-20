import { useId } from 'react';
import { cn } from './cn';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, hint, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-50')}>
      <div>
        <label htmlFor={id} className="text-[13px] text-ink-2">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-[11.5px] text-ink-3">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-holo-cyan/60 bg-holo-cyan/25' : 'border-line-strong bg-white/[0.04]',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 left-0.5 size-3.5 -translate-y-1/2 rounded-full transition-[transform,background-color] duration-200 ease-(--ease-out-expo)',
            checked
              ? 'translate-x-4 bg-holo-cyan shadow-[0_0_10px_var(--color-holo-cyan)]'
              : 'bg-ink-3',
          )}
        />
      </button>
    </div>
  );
}
