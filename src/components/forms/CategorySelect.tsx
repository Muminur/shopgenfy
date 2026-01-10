import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SHOPIFY_CATEGORIES } from '@/lib/validators/constants';

export interface CategorySelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  optional?: boolean;
  disabled?: boolean;
}

export function CategorySelect({
  label,
  value,
  onChange,
  placeholder = 'Select a category',
  optional = false,
  disabled = false,
}: CategorySelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`category-${label}`}>
        {label}
        {optional && <span className="text-muted-foreground ml-1">(Optional)</span>}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={`category-${label}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {SHOPIFY_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
