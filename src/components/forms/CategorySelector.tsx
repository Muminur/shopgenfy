import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiSelect, MultiSelectOption } from './MultiSelect';
import type { Category } from '@/types';

interface CategorySelectorProps {
  categories: Category[] | string[];
  primaryCategory: string;
  secondaryCategory?: string;
  tags: string[];
  onPrimaryCategoryChange: (value: string) => void;
  onSecondaryCategoryChange?: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
  maxTags?: number;
  tagOptions?: MultiSelectOption[];
}

export function CategorySelector({
  categories,
  primaryCategory,
  secondaryCategory,
  tags,
  onPrimaryCategoryChange,
  onSecondaryCategoryChange,
  onTagsChange,
  maxTags = 25,
  tagOptions = [],
}: CategorySelectorProps) {
  // Normalize categories - support both string[] and Category[]
  const isStringArray = typeof categories[0] === 'string';

  return (
    <div className="space-y-4">
      {/* Primary Category */}
      <div>
        <Label htmlFor="primary-category">
          Primary Category
          <span className="text-destructive ml-1">*</span>
        </Label>
        <select
          id="primary-category"
          role="combobox"
          aria-label="Primary Category"
          value={primaryCategory}
          onChange={(e) => onPrimaryCategoryChange(e.target.value)}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          )}
        >
          <option value="">Select category...</option>
          {categories.map((cat) => {
            const value = isStringArray ? (cat as string) : (cat as Category).value;
            const label = isStringArray ? (cat as string) : (cat as Category).label;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
        </select>
        <p className="text-sm text-muted-foreground mt-1">
          Select the main category that best describes your app
        </p>
      </div>

      {/* Secondary Category */}
      {primaryCategory && (
        <div>
          <Label htmlFor="secondary-category">Secondary Category (Optional)</Label>
          <div className="relative">
            <select
              id="secondary-category"
              role="combobox"
              aria-label="Secondary Category"
              value={secondaryCategory || ''}
              onChange={(e) => onSecondaryCategoryChange?.(e.target.value)}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
              )}
            >
              <option value="">Select category (optional)...</option>
              {categories
                .filter((cat) => {
                  const value = isStringArray ? (cat as string) : (cat as Category).value;
                  return value !== primaryCategory;
                })
                .map((cat) => {
                  const value = isStringArray ? (cat as string) : (cat as Category).value;
                  const label = isStringArray ? (cat as string) : (cat as Category).label;
                  return (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  );
                })}
            </select>
            {secondaryCategory && (
              <button
                type="button"
                onClick={() => onSecondaryCategoryChange?.('')}
                data-testid="clear-secondary-category"
                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded"
                aria-label="Clear secondary category"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Optional - select a second category</p>
        </div>
      )}

      {/* Feature Tags */}
      <MultiSelect
        label="Feature Tags"
        options={tagOptions}
        value={tags}
        onChange={onTagsChange}
        maxSelections={maxTags}
        placeholder="Select feature tags..."
        helperText={`Choose up to ${maxTags} tags that describe your app's key features`}
      />
    </div>
  );
}
