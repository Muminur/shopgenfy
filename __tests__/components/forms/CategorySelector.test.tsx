import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { CategorySelector } from '@/components/forms/CategorySelector';

describe('CategorySelector Component', () => {
  const defaultCategories = [
    { value: 'sales', label: 'Sales & Marketing', description: 'Drive sales and marketing' },
    { value: 'customer', label: 'Customer Support', description: 'Enhance customer service' },
    { value: 'shipping', label: 'Shipping & Fulfillment', description: 'Manage shipping' },
    { value: 'inventory', label: 'Inventory Management', description: 'Track inventory' },
  ];

  it('should render the category selector component', () => {
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory=""
        secondaryCategory=""
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/primary category/i)).toBeInTheDocument();
  });

  it('should show primary category selector', () => {
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory=""
        secondaryCategory=""
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: /primary category/i })).toBeInTheDocument();
  });

  it('should show secondary category selector', () => {
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory=""
        secondaryCategory=""
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: /secondary category/i })).toBeInTheDocument();
  });

  it('should allow selecting primary category', async () => {
    const onPrimaryCategoryChange = vi.fn();
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory=""
        secondaryCategory=""
        onPrimaryCategoryChange={onPrimaryCategoryChange}
        onSecondaryCategoryChange={vi.fn()}
      />
    );

    const primarySelect = screen.getByRole('combobox', { name: /primary category/i });
    await userEvent.click(primarySelect);

    const salesOption = screen.getByRole('option', { name: /sales & marketing/i });
    await userEvent.click(salesOption);

    expect(onPrimaryCategoryChange).toHaveBeenCalledWith('sales');
  });

  it('should allow selecting secondary category', async () => {
    const onSecondaryCategoryChange = vi.fn();
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory="sales"
        secondaryCategory=""
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={onSecondaryCategoryChange}
      />
    );

    const secondarySelect = screen.getByRole('combobox', { name: /secondary category/i });
    await userEvent.click(secondarySelect);

    const customerOption = screen.getByRole('option', { name: /customer support/i });
    await userEvent.click(customerOption);

    expect(onSecondaryCategoryChange).toHaveBeenCalledWith('customer');
  });

  it('should show category descriptions in options', async () => {
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory=""
        secondaryCategory=""
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={vi.fn()}
      />
    );

    const primarySelect = screen.getByRole('combobox', { name: /primary category/i });
    await userEvent.click(primarySelect);

    expect(screen.getByText(/drive sales and marketing/i)).toBeInTheDocument();
  });

  it('should prevent selecting same category for both primary and secondary', async () => {
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory="sales"
        secondaryCategory=""
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={vi.fn()}
      />
    );

    const secondarySelect = screen.getByRole('combobox', { name: /secondary category/i });
    await userEvent.click(secondarySelect);

    const salesOption = screen.getByRole('option', { name: /sales & marketing/i });
    expect(salesOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('should show helper text for secondary category', () => {
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory=""
        secondaryCategory=""
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={vi.fn()}
      />
    );

    expect(screen.getByText(/optional - select a second category/i)).toBeInTheDocument();
  });

  it('should display selected category labels', () => {
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory="sales"
        secondaryCategory="customer"
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={vi.fn()}
      />
    );

    const primarySelect = screen.getByRole('combobox', { name: /primary category/i });
    expect(primarySelect).toHaveTextContent(/sales & marketing/i);

    const secondarySelect = screen.getByRole('combobox', { name: /secondary category/i });
    expect(secondarySelect).toHaveTextContent(/customer support/i);
  });

  it('should allow clearing secondary category', async () => {
    const onSecondaryCategoryChange = vi.fn();
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory="sales"
        secondaryCategory="customer"
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={onSecondaryCategoryChange}
      />
    );

    const clearButton = screen.getByTestId('clear-secondary-category');
    await userEvent.click(clearButton);

    expect(onSecondaryCategoryChange).toHaveBeenCalledWith('');
  });

  it('should be accessible with proper ARIA labels', () => {
    render(
      <CategorySelector
        categories={defaultCategories}
        primaryCategory="sales"
        secondaryCategory=""
        onPrimaryCategoryChange={vi.fn()}
        onSecondaryCategoryChange={vi.fn()}
      />
    );

    const primarySelect = screen.getByRole('combobox', { name: /primary category/i });
    expect(primarySelect).toHaveAccessibleName();

    const secondarySelect = screen.getByRole('combobox', { name: /secondary category/i });
    expect(secondarySelect).toHaveAccessibleName();
  });
});
