import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { PricingPlanBuilder } from '@/components/forms/PricingPlanBuilder';
import type { PricingPlan } from '@/types';

describe('PricingPlanBuilder Component', () => {
  const defaultPlans: PricingPlan[] = [];

  it('should render the pricing plan builder', () => {
    render(<PricingPlanBuilder plans={defaultPlans} onChange={vi.fn()} />);
    expect(screen.getByText(/pricing plans/i)).toBeInTheDocument();
  });

  it('should show add plan button when empty', () => {
    render(<PricingPlanBuilder plans={defaultPlans} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add pricing plan/i })).toBeInTheDocument();
  });

  it('should allow adding a new pricing plan', async () => {
    const onChange = vi.fn();
    render(<PricingPlanBuilder plans={defaultPlans} onChange={onChange} />);

    const addButton = screen.getByRole('button', { name: /add pricing plan/i });
    await userEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.any(String),
        name: '',
        price: 0,
        type: 'free',
      }),
    ]);
  });

  it('should display existing pricing plans', () => {
    const plans: PricingPlan[] = [
      { id: '1', name: 'Free Plan', price: 0, type: 'free', features: [] },
      { id: '2', name: 'Pro Plan', price: 29.99, type: 'paid', features: [] },
    ];

    render(<PricingPlanBuilder plans={plans} onChange={vi.fn()} />);

    expect(screen.getByDisplayValue('Free Plan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pro Plan')).toBeInTheDocument();
  });

  it('should allow editing plan name', async () => {
    const plans: PricingPlan[] = [
      { id: '1', name: 'Free Plan', price: 0, type: 'free', features: [] },
    ];
    const onChange = vi.fn();

    render(<PricingPlanBuilder plans={plans} onChange={onChange} />);

    const nameInput = screen.getByDisplayValue('Free Plan');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Basic Plan');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '1',
        name: 'Basic Plan',
      }),
    ]);
  });

  it('should allow editing plan price', async () => {
    const plans: PricingPlan[] = [
      { id: '1', name: 'Pro Plan', price: 29.99, type: 'paid', features: [] },
    ];
    const onChange = vi.fn();

    render(<PricingPlanBuilder plans={plans} onChange={onChange} />);

    const priceInput = screen.getByLabelText(/price.*pro plan/i);
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, '39.99');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '1',
        price: 39.99,
      }),
    ]);
  });

  it('should allow selecting plan type', async () => {
    const plans: PricingPlan[] = [{ id: '1', name: 'Plan', price: 0, type: 'free', features: [] }];
    const onChange = vi.fn();

    render(<PricingPlanBuilder plans={plans} onChange={onChange} />);

    const typeSelect = screen.getByLabelText(/type.*plan/i);
    await userEvent.click(typeSelect);

    const paidOption = screen.getByRole('option', { name: /paid/i });
    await userEvent.click(paidOption);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '1',
        type: 'paid',
      }),
    ]);
  });

  it('should allow removing a pricing plan', async () => {
    const plans: PricingPlan[] = [
      { id: '1', name: 'Free Plan', price: 0, type: 'free', features: [] },
      { id: '2', name: 'Pro Plan', price: 29.99, type: 'paid', features: [] },
    ];
    const onChange = vi.fn();

    render(<PricingPlanBuilder plans={plans} onChange={onChange} />);

    const removeButtons = screen.getAllByRole('button', { name: /remove plan/i });
    await userEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '2',
        name: 'Pro Plan',
      }),
    ]);
  });

  it('should support free pricing model', () => {
    const plans: PricingPlan[] = [
      { id: '1', name: 'Free Plan', price: 0, type: 'free', features: [] },
    ];

    render(<PricingPlanBuilder plans={plans} onChange={vi.fn()} />);

    const typeSelect = screen.getByLabelText(/type.*free plan/i);
    expect(typeSelect).toHaveTextContent(/free/i);
  });

  it('should support paid pricing model', () => {
    const plans: PricingPlan[] = [
      { id: '1', name: 'Pro Plan', price: 29.99, type: 'paid', features: [] },
    ];

    render(<PricingPlanBuilder plans={plans} onChange={vi.fn()} />);

    const typeSelect = screen.getByLabelText(/type.*pro plan/i);
    expect(typeSelect).toHaveTextContent(/paid/i);
  });

  it('should support usage-based pricing model', () => {
    const plans: PricingPlan[] = [
      { id: '1', name: 'Usage Plan', price: 0, type: 'usage-based', features: [] },
    ];

    render(<PricingPlanBuilder plans={plans} onChange={vi.fn()} />);

    const typeSelect = screen.getByLabelText(/type.*usage plan/i);
    expect(typeSelect).toHaveTextContent(/usage-based/i);
  });

  it('should validate pricing fields', async () => {
    const onChange = vi.fn();
    const plans: PricingPlan[] = [
      { id: '1', name: 'Pro Plan', price: 29.99, type: 'paid', features: [] },
    ];

    render(<PricingPlanBuilder plans={plans} onChange={onChange} />);

    const priceInput = screen.getByLabelText(/price.*pro plan/i);
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, '-10');

    // Should show validation error
    expect(screen.getByText(/price must be positive/i)).toBeInTheDocument();
  });

  it('should show helper text for pricing', () => {
    render(<PricingPlanBuilder plans={defaultPlans} onChange={vi.fn()} />);
    expect(screen.getByText(/add one or more pricing tiers/i)).toBeInTheDocument();
  });

  it('should enforce maximum number of plans (e.g., 5)', async () => {
    const plans: PricingPlan[] = Array.from({ length: 5 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Plan ${i + 1}`,
      price: i * 10,
      type: 'paid' as const,
      features: [],
    }));

    render(<PricingPlanBuilder plans={plans} onChange={vi.fn()} maxPlans={5} />);

    const addButton = screen.queryByRole('button', { name: /add pricing plan/i });
    expect(addButton).toBeDisabled();
  });

  it('should have proper accessibility labels', () => {
    const plans: PricingPlan[] = [
      { id: '1', name: 'Pro Plan', price: 29.99, type: 'paid', features: [] },
    ];

    render(<PricingPlanBuilder plans={plans} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/plan name.*pro plan/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/price.*pro plan/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type.*pro plan/i)).toBeInTheDocument();
  });
});
