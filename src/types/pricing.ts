export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  type: 'free' | 'paid' | 'usage-based';
  features: string[];
  interval?: 'month' | 'year';
  usageMetric?: string;
}
