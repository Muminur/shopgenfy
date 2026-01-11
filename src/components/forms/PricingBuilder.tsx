import { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PricingConfig } from '@/types';

export interface PricingBuilderProps {
  value: PricingConfig;
  onChange: (value: PricingConfig) => void;
  disabled?: boolean;
}

export function PricingBuilder({ value, onChange, disabled = false }: PricingBuilderProps) {
  const handleTypeChange = useCallback(
    (type: PricingConfig['type']) => {
      if (type === 'free') {
        onChange({ type: 'free' });
      } else if (type === 'freemium') {
        onChange({ type: 'freemium' });
      } else if (type === 'paid') {
        onChange({
          type: 'paid',
          price: value.price || 9.99,
          currency: value.currency || 'USD',
          billingCycle: value.billingCycle || 'monthly',
        });
      } else {
        onChange({
          type: 'subscription',
          price: value.price || 9.99,
          currency: value.currency || 'USD',
          billingCycle: value.billingCycle || 'monthly',
        });
      }
    },
    [value, onChange]
  );

  const handlePriceChange = useCallback(
    (price: string) => {
      const numPrice = parseFloat(price);
      if (!isNaN(numPrice) && 'price' in value) {
        onChange({ ...value, price: numPrice });
      }
    },
    [value, onChange]
  );

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      if ('currency' in value) {
        onChange({ ...value, currency });
      }
    },
    [value, onChange]
  );

  const handleBillingCycleChange = useCallback(
    (billingCycle: 'monthly' | 'yearly' | 'one-time') => {
      if ('billingCycle' in value) {
        onChange({ ...value, billingCycle });
      }
    },
    [value, onChange]
  );

  const handleTrialDaysChange = useCallback(
    (trialDays: string) => {
      const numDays = parseInt(trialDays, 10);
      if (!isNaN(numDays) && numDays >= 0 && 'trialDays' in value) {
        onChange({ ...value, trialDays: numDays });
      }
    },
    [value, onChange]
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pricing-type">Pricing Type</Label>
        <Select value={value.type} onValueChange={handleTypeChange} disabled={disabled}>
          <SelectTrigger id="pricing-type">
            <SelectValue placeholder="Select pricing type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="freemium">Freemium</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="subscription">Subscription</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(value.type === 'paid' || value.type === 'subscription' || value.type === 'freemium') && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={'price' in value ? value.price || '' : ''}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="9.99"
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={'currency' in value ? value.currency || 'USD' : 'USD'}
                onValueChange={handleCurrencyChange}
                disabled={disabled}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(value.type === 'paid' || value.type === 'subscription') && (
            <div className="space-y-2">
              <Label htmlFor="billing-cycle">Billing Cycle</Label>
              <Select
                value={'billingCycle' in value ? value.billingCycle : 'monthly'}
                onValueChange={handleBillingCycleChange}
                disabled={disabled}
              >
                <SelectTrigger id="billing-cycle">
                  <SelectValue placeholder="Select billing cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  {value.type !== 'subscription' && (
                    <SelectItem value="one-time">One-time</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="trial-days">Free Trial Days (Optional)</Label>
            <Input
              id="trial-days"
              type="number"
              min="0"
              value={'trialDays' in value ? value.trialDays || '' : ''}
              onChange={(e) => handleTrialDaysChange(e.target.value)}
              placeholder="14"
              disabled={disabled}
            />
          </div>
        </>
      )}
    </div>
  );
}
