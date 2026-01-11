import { useState, useMemo, useCallback } from 'react';
import { Check, ChevronsUpDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  helperText?: string;
  maxItems?: number;
  disabled?: boolean;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select items...',
  helperText,
  maxItems,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLabels = useMemo(() => {
    return value
      .map((v) => options.find((opt) => opt.value === v)?.label)
      .filter(Boolean) as string[];
  }, [value, options]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const handleSelect = useCallback(
    (selectedValue: string) => {
      const isSelected = value.includes(selectedValue);

      if (isSelected) {
        onChange(value.filter((v) => v !== selectedValue));
      } else {
        if (maxItems && value.length >= maxItems) {
          return;
        }
        onChange([...value, selectedValue]);
      }
    },
    [value, onChange, maxItems]
  );

  const handleRemove = useCallback(
    (removedValue: string) => {
      onChange(value.filter((v) => v !== removedValue));
    },
    [value, onChange]
  );

  const isMaxReached = maxItems ? value.length >= maxItems : false;

  return (
    <div className="space-y-2">
      <Label htmlFor={`multi-select-${label}`}>{label}</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={`multi-select-${label}`}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn(
              'w-full justify-between min-h-10 h-auto',
              value.length === 0 && 'text-muted-foreground'
            )}
          >
            <div className="flex flex-wrap gap-1">
              {value.length === 0 ? (
                <span>{placeholder}</span>
              ) : (
                selectedLabels.map((label, index) => (
                  <Badge key={value[index]} variant="secondary" className="mr-1 cursor-pointer">
                    {label}
                    <span
                      role="button"
                      tabIndex={0}
                      className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      aria-label={`Remove ${label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(value[index]);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          handleRemove(value[index]);
                        }
                      }}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground inline-block" />
                    </span>
                  </Badge>
                ))
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filteredOptions.map((option) => {
                const isSelected = value.includes(option.value);
                const isDisabled = !isSelected && isMaxReached;

                return (
                  <CommandItem
                    key={option.value}
                    data-value={option.value}
                    onClick={() => handleSelect(option.value)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
                    />
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {(helperText || isMaxReached) && (
        <div className="flex items-center justify-between">
          {helperText && <p className="text-sm text-muted-foreground">{helperText}</p>}
          {isMaxReached && (
            <p className="text-sm text-destructive">Maximum {maxItems} items allowed</p>
          )}
        </div>
      )}
    </div>
  );
}
