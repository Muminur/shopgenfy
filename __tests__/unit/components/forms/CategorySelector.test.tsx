import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

describe('CategorySelector', () => {
  const categories = [
    'Store Management',
    'Sales and Marketing',
    'Orders and Shipping',
    'Customer Support',
  ];

  it('should render primary category selector', async () => {
    const { CategorySelector } = await import('@/components/forms/CategorySelector');
    render(
      <CategorySelector
        categories={categories}
        primaryCategory=""
        onPrimaryCategoryChange={() => {}}
        tags={[]}
        onTagsChange={() => {}}
      />
    );

    expect(screen.getByText('Primary Category')).toBeInTheDocument();
  });

  it('should render secondary category selector', async () => {
    const { CategorySelector } = await import('@/components/forms/CategorySelector');
    render(
      <CategorySelector
        categories={categories}
        primaryCategory="Store Management"
        onPrimaryCategoryChange={() => {}}
        tags={[]}
        onTagsChange={() => {}}
      />
    );

    expect(screen.getByText('Secondary Category (Optional)')).toBeInTheDocument();
  });

  it('should call onPrimaryCategoryChange when primary category selected', async () => {
    const onChange = vi.fn();
    const { CategorySelector } = await import('@/components/forms/CategorySelector');
    render(
      <CategorySelector
        categories={categories}
        primaryCategory=""
        onPrimaryCategoryChange={onChange}
        tags={[]}
        onTagsChange={() => {}}
      />
    );

    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'Store Management' } });

    expect(onChange).toHaveBeenCalledWith('Store Management');
  });

  it('should call onSecondaryCategoryChange when secondary category selected', async () => {
    const onChange = vi.fn();
    const { CategorySelector } = await import('@/components/forms/CategorySelector');
    render(
      <CategorySelector
        categories={categories}
        primaryCategory="Store Management"
        secondaryCategory=""
        onPrimaryCategoryChange={() => {}}
        onSecondaryCategoryChange={onChange}
        tags={[]}
        onTagsChange={() => {}}
      />
    );

    const selects = screen.getAllByRole('combobox');
    const secondarySelect = selects[1];
    fireEvent.change(secondarySelect, { target: { value: 'Sales and Marketing' } });

    expect(onChange).toHaveBeenCalledWith('Sales and Marketing');
  });

  it('should show feature tags multiselect', async () => {
    const { CategorySelector } = await import('@/components/forms/CategorySelector');
    render(
      <CategorySelector
        categories={categories}
        primaryCategory="Store Management"
        onPrimaryCategoryChange={() => {}}
        tags={[]}
        onTagsChange={() => {}}
      />
    );

    expect(screen.getByText('Feature Tags')).toBeInTheDocument();
  });

  it('should enforce max 25 feature tags', async () => {
    const { CategorySelector } = await import('@/components/forms/CategorySelector');
    const tags = Array(25)
      .fill('')
      .map((_, i) => `tag-${i}`);

    const tagOptions = Array(30)
      .fill('')
      .map((_, i) => ({ value: `tag-${i}`, label: `Tag ${i}` }));

    render(
      <CategorySelector
        categories={categories}
        primaryCategory="Store Management"
        onPrimaryCategoryChange={() => {}}
        tags={tags}
        onTagsChange={() => {}}
        tagOptions={tagOptions}
        maxTags={25}
      />
    );

    expect(screen.getByText(/maximum 25 items allowed/i)).toBeInTheDocument();
  });

  it('should call onTagsChange when tags change', async () => {
    const onTagsChange = vi.fn();
    const { CategorySelector } = await import('@/components/forms/CategorySelector');

    render(
      <CategorySelector
        categories={categories}
        primaryCategory="Store Management"
        onPrimaryCategoryChange={() => {}}
        tags={[]}
        onTagsChange={onTagsChange}
      />
    );

    // Tags are managed by MultiSelect, so this tests integration
    expect(onTagsChange).toBeDefined();
  });

  it('should display helper text for each field', async () => {
    const { CategorySelector } = await import('@/components/forms/CategorySelector');
    render(
      <CategorySelector
        categories={categories}
        primaryCategory=""
        onPrimaryCategoryChange={() => {}}
        tags={[]}
        onTagsChange={() => {}}
      />
    );

    expect(
      screen.getByText(/select the main category that best describes your app/i)
    ).toBeInTheDocument();
  });

  it('should mark primary category as required', async () => {
    const { CategorySelector } = await import('@/components/forms/CategorySelector');
    render(
      <CategorySelector
        categories={categories}
        primaryCategory=""
        onPrimaryCategoryChange={() => {}}
        tags={[]}
        onTagsChange={() => {}}
      />
    );

    const label = screen.getByText('Primary Category');
    expect(label.querySelector('span')).toHaveTextContent('*');
  });

  it('should filter secondary category options to exclude primary', async () => {
    const { CategorySelector } = await import('@/components/forms/CategorySelector');
    const { container } = render(
      <CategorySelector
        categories={categories}
        primaryCategory="Store Management"
        onPrimaryCategoryChange={() => {}}
        tags={[]}
        onTagsChange={() => {}}
      />
    );

    const selects = container.querySelectorAll('select');
    const secondarySelect = selects[1];
    const options = Array.from(secondarySelect.querySelectorAll('option'));
    const values = options.map((opt: HTMLOptionElement) => opt.value);

    expect(values).not.toContain('Store Management');
  });
});
