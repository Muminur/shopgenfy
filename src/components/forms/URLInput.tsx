'use client';

import { useId, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle } from 'lucide-react';

interface URLInputProps {
  label: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValidate?: (isValid: boolean) => void;
  showValidation?: boolean;
  helperText?: string;
  error?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}

function isValidURL(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function URLInput({
  label,
  value = '',
  onChange,
  onValidate,
  showValidation = false,
  helperText,
  error,
  placeholder = 'https://example.com',
  className,
  required,
  disabled,
  name,
}: URLInputProps) {
  const id = useId();
  const isValid = isValidURL(value);
  const showValidationState = showValidation && value.length > 0;

  // Track previous validation state to avoid unnecessary calls
  const prevIsValidRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Only call onValidate when validation state changes
    if (onValidate && value && prevIsValidRef.current !== isValid) {
      prevIsValidRef.current = isValid;
      onValidate(isValid);
    }
  }, [value, isValid, onValidate]);

  const getValidationMessage = () => {
    if (!showValidationState) return null;
    if (!isValid) return 'Invalid URL format. Must start with http:// or https://';
    return null;
  };

  const validationError = getValidationMessage();

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className={error || validationError ? 'text-destructive' : ''}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      <div
        className={cn(
          'relative rounded-md',
          showValidationState && (isValid ? 'border-green-500' : 'border-destructive')
        )}
      >
        <Input
          id={id}
          name={name}
          type="url"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error || !!validationError}
          aria-describedby={
            error || validationError ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className={cn(
            'pr-10',
            showValidationState && isValid && 'border-green-500 focus-visible:ring-green-500',
            (error || validationError) && 'border-destructive focus-visible:ring-destructive'
          )}
        />

        {showValidationState && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {isValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>

      {helperText && !error && !validationError && (
        <p id={`${id}-helper`} className="text-sm text-muted-foreground">
          {helperText}
        </p>
      )}

      {(error || validationError) && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error || validationError}
        </p>
      )}
    </div>
  );
}
