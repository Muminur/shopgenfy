import { useState, useMemo, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (selected: string[]) => void;
  maxSelections?: number;
  placeholder?: string;
  helperText?: string;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  maxSelections,
  placeholder = 'Select options...',
  helperText,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const selectedOptions = useMemo(() => {
    return options.filter((option) => value.includes(option.value));
  }, [options, value]);

  const handleToggleOption = useCallback(
    (optionValue: string) => {
      if (value.includes(optionValue)) {
        onChange(value.filter((v) => v !== optionValue));
      } else {
        if (maxSelections && value.length >= maxSelections) {
          return; // Don't allow selection if max is reached
        }
        onChange([...value, optionValue]);
      }
    },
    [value, onChange, maxSelections]
  );

  const handleRemoveBadge = useCallback(
    (optionValue: string) => {
      onChange(value.filter((v) => v !== optionValue));
    },
    [value, onChange]
  );

  const isMaxReached = maxSelections !== undefined && value.length >= maxSelections;

  return (
    <div className="space-y-2">
      <Label htmlFor={`multiselect-${label}`}>{label}</Label>

      {/* Selected badges */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedOptions.map((option) => (
            <Badge
              key={option.value}
              variant="secondary"
              className="gap-1"
              data-testid={`selected-badge-${option.value}`}
            >
              {option.label}
              <button
                type="button"
                onClick={() => handleRemoveBadge(option.value)}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                aria-label={`Remove ${option.label}`}
                data-testid={`remove-badge-${option.value}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Combobox */}
      <div className="relative">
        <div
          className={cn(
            'flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <input
            id={`multiselect-${label}`}
            type="text"
            role="combobox"
            aria-label={label}
            aria-expanded={isOpen}
            aria-controls={`multiselect-options-${label}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedOptions.length === 0 ? placeholder : ''}
            className="flex-1 bg-transparent outline-none"
          />
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </div>

        {/* Options dropdown */}
        {isOpen && (
          <div
            id={`multiselect-options-${label}`}
            role="listbox"
            aria-label={`${label} options`}
            className="absolute z-10 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-60 overflow-auto"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No options found</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option.value);
                const isDisabled = !isSelected && isMaxReached;

                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                    onClick={() => !isDisabled && handleToggleOption(option.value)}
                    className={cn(
                      'px-3 py-2 text-sm cursor-pointer hover:bg-accent',
                      isSelected && 'bg-accent font-medium',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {option.label}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {helperText && <p className="text-sm text-muted-foreground">{helperText}</p>}
    </div>
  );
}
