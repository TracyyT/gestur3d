import { useId, type CSSProperties } from 'react';
import { cn } from './cn';

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Format the readout; defaults to a percentage of the range. */
  format?: (value: number) => string;
  hint?: string;
  disabled?: boolean;
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format,
  hint,
  disabled,
}: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const readout = format ? format(value) : `${Math.round(pct)}%`;

  return (
    <div className={cn('space-y-1.5', disabled && 'opacity-50')}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] text-ink-2">
          {label}
        </label>
        <output htmlFor={id} className="tabular font-mono text-[12px] text-ink-1">
          {readout}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="g3d-range w-full"
        style={{ '--fill': `${pct}%` } as CSSProperties}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-[11.5px] text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}
