'use client';

import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AlertMessageProps {
  variant: 'error' | 'success' | 'warning' | 'info';
  message: string;
  title?: string;
  onDismiss?: () => void;
  className?: string;
}

const variantConfig = {
  error: {
    icon: AlertCircle,
    bgClass: 'bg-destructive/10 border-destructive/20',
    textClass: 'text-destructive',
    iconClass: 'text-destructive',
  },
  success: {
    icon: CheckCircle2,
    bgClass: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900',
    textClass: 'text-green-800 dark:text-green-200',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900',
    textClass: 'text-yellow-800 dark:text-yellow-200',
    iconClass: 'text-yellow-600 dark:text-yellow-400',
  },
  info: {
    icon: Info,
    bgClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900',
    textClass: 'text-blue-800 dark:text-blue-200',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
};

export function AlertMessage({ variant, message, title, onDismiss, className }: AlertMessageProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn('relative flex gap-3 rounded-lg border p-4', config.bgClass, className)}
    >
      <Icon className={cn('h-5 w-5 shrink-0', config.iconClass)} />

      <div className="flex-1">
        {title && <h4 className={cn('font-medium', config.textClass)}>{title}</h4>}
        <p className={cn('text-sm', config.textClass, title && 'mt-1')}>{message}</p>
      </div>

      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
