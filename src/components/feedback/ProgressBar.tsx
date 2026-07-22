'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  label?: string;
  showText?: boolean;
  className?: string;
}

export function ProgressBar({ value, label, showText, className }: ProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('w-full space-y-2', className)}>
      {(label || showText) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showText && <span className="font-medium">{clampedValue}%</span>}
        </div>
      )}

      <div
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        {/* transform: scaleX is compositor-only (never triggers layout, unlike
            animating width directly) — origin-left so it grows rightward. */}
        <div
          className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: `scaleX(${clampedValue / 100})` }}
        />
      </div>
    </div>
  );
}
