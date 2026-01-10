'use client';

import { cn } from '@/lib/utils';

interface SkipLinkProps {
  href?: string;
  label?: string;
  className?: string;
}

export function SkipLink({
  href = '#main-content',
  label = 'Skip to main content',
  className,
}: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        'sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50',
        'focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
    >
      {label}
    </a>
  );
}

export default SkipLink;
