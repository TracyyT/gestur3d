import { useId } from 'react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  hideLabel?: boolean;
}

/** Native select (best keyboard and screen-reader support), styled as glass. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  hideLabel,
}: SelectProps<T>) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block text-[13px] text-ink-2'}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value as T)}
          className="glass-inset h-9 w-full appearance-none rounded-(--radius-control) pr-8 pl-3 text-[13px] text-ink-1 disabled:opacity-50"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-deep">
              {o.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-3"
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
