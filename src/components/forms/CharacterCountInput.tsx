'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CharacterCountInputProps {
  label: string;
  maxLength: number;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  helperText?: string;
  error?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}

export function CharacterCountInput({
  label,
  maxLength,
  value = '',
  onChange,
  helperText,
  error,
  placeholder,
  className,
  required,
  disabled,
  name,
}: CharacterCountInputProps) {
  const id = useId();
  const charCount = value.length;
  const percentage = (charCount / maxLength) * 100;

  const getCounterClass = () => {
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 80) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className={error ? 'text-destructive' : ''}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <span className={cn('text-sm', getCounterClass())}>
          {charCount}/{maxLength}
        </span>
      </div>

      <Input
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        className={cn(error && 'border-destructive focus-visible:ring-destructive')}
      />

      {helperText && !error && (
        <p id={`${id}-helper`} className="text-sm text-muted-foreground">
          {helperText}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
