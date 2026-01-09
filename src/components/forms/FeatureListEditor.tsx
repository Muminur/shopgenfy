'use client';

import { useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FeatureListEditorProps {
  features: string[];
  onChange: (features: string[]) => void;
  label?: string;
  maxItems?: number;
  maxCharPerItem?: number;
  helperText?: string;
  error?: string;
  className?: string;
}

export function FeatureListEditor({
  features,
  onChange,
  label = 'Features',
  maxItems = 10,
  maxCharPerItem = 80,
  helperText,
  error,
  className,
}: FeatureListEditorProps) {
  const handleAddFeature = useCallback(() => {
    if (features.length < maxItems) {
      onChange([...features, '']);
    }
  }, [features, maxItems, onChange]);

  const handleRemoveFeature = useCallback(
    (index: number) => {
      const newFeatures = features.filter((_, i) => i !== index);
      onChange(newFeatures);
    },
    [features, onChange]
  );

  const handleUpdateFeature = useCallback(
    (index: number, value: string) => {
      const newFeatures = [...features];
      newFeatures[index] = value;
      onChange(newFeatures);
    },
    [features, onChange]
  );

  const isAtLimit = features.length >= maxItems;

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className={error ? 'text-destructive' : ''}>{label}</Label>
          <span className="text-sm text-muted-foreground">
            {features.length}/{maxItems} items
          </span>
        </div>
      )}

      <div className="space-y-2">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              <Input
                value={feature}
                onChange={(e) => handleUpdateFeature(index, e.target.value)}
                maxLength={maxCharPerItem}
                placeholder={`Feature ${index + 1}`}
                aria-label={`Feature ${index + 1}`}
              />
              <div className="flex justify-end">
                <span
                  className={cn(
                    'text-xs',
                    feature.length >= maxCharPerItem
                      ? 'text-destructive'
                      : feature.length >= maxCharPerItem * 0.8
                        ? 'text-warning'
                        : 'text-muted-foreground'
                  )}
                >
                  {feature.length}/{maxCharPerItem}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveFeature(index)}
              aria-label={`Remove feature ${index + 1}`}
              className="mt-0.5"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddFeature}
        disabled={isAtLimit}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Feature
      </Button>

      {helperText && !error && <p className="text-sm text-muted-foreground">{helperText}</p>}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
