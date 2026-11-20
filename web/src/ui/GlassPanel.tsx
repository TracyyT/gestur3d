import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export const GlassPanel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function GlassPanel({ className, ...rest }, ref) {
    return <div ref={ref} className={cn('glass rounded-(--radius-panel)', className)} {...rest} />;
  },
);
