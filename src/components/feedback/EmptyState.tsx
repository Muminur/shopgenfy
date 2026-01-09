'use client';

import { memo } from 'react';
import { FileText, ImageIcon, Settings, FolderOpen, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: 'file' | 'image' | 'settings' | 'folder';
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  file: FileText,
  image: ImageIcon,
  settings: Settings,
  folder: FolderOpen,
};

export const EmptyState = memo(function EmptyState({
  title,
  description,
  icon = 'file',
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const Icon = iconMap[icon] || FileText;

  return (
    <div
      className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" role="img" aria-hidden="true" />
      </div>

      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>

      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
});
