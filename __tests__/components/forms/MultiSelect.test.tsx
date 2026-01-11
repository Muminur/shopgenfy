import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MultiSelect } from '@/components/forms/MultiSelect';

describe('MultiSelect Component', () => {
  const defaultOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
  ];

  it('should render the multi-select component', () => {
    render(
      <MultiSelect label="Languages" options={defaultOptions} value={[]} onChange={vi.fn()} />
    );
    expect(screen.getByLabelText(/languages/i)).toBeInTheDocument();
  });

  it('should display selected values as badges', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiSelect label="Languages" options={defaultOptions} value={[]} onChange={onChange} />
    );

    // User selects "English"
    const combobox = screen.getByRole('combobox', { name: /languages/i });
    await userEvent.click(combobox);

    const englishOption = screen.getByRole('option', { name: /english/i });
    await userEvent.click(englishOption);

    expect(onChange).toHaveBeenCalledWith(['en']);

    // Re-render with selected value
    rerender(
      <MultiSelect label="Languages" options={defaultOptions} value={['en']} onChange={onChange} />
    );

    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByTestId('selected-badge-en')).toBeInTheDocument();
  });

  it('should allow removing selections via badge close button', async () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        label="Languages"
        options={defaultOptions}
        value={['en', 'es']}
        onChange={onChange}
      />
    );

    const removeButton = screen.getByTestId('remove-badge-en');
    await userEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith(['es']);
  });

  it('should enforce max selection limit', async () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        label="Integrations"
        options={defaultOptions}
        value={['en', 'es']}
        onChange={onChange}
        maxSelections={2}
      />
    );

    const combobox = screen.getByRole('combobox', { name: /integrations/i });
    await userEvent.click(combobox);

    // Try to select a third option
    const frenchOption = screen.getByRole('option', { name: /french/i });
    expect(frenchOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('should filter options as user types', async () => {
    render(
      <MultiSelect label="Languages" options={defaultOptions} value={[]} onChange={vi.fn()} />
    );

    const combobox = screen.getByRole('combobox', { name: /languages/i });
    await userEvent.click(combobox);

    // Initially all options are visible
    expect(screen.getByRole('option', { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /spanish/i })).toBeInTheDocument();

    // Type to filter
    await userEvent.type(combobox, 'spa');

    expect(screen.queryByRole('option', { name: /english/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /spanish/i })).toBeInTheDocument();
  });

  it('should show placeholder when no selections', () => {
    render(
      <MultiSelect
        label="Languages"
        options={defaultOptions}
        value={[]}
        onChange={vi.fn()}
        placeholder="Select languages..."
      />
    );

    expect(screen.getByPlaceholderText(/select languages/i)).toBeInTheDocument();
  });

  it('should display helper text when provided', () => {
    render(
      <MultiSelect
        label="Languages"
        options={defaultOptions}
        value={[]}
        onChange={vi.fn()}
        helperText="Select up to 6 languages"
      />
    );

    expect(screen.getByText(/select up to 6 languages/i)).toBeInTheDocument();
  });

  it('should handle keyboard navigation', async () => {
    render(
      <MultiSelect label="Languages" options={defaultOptions} value={[]} onChange={vi.fn()} />
    );

    const combobox = screen.getByRole('combobox', { name: /languages/i });
    await userEvent.click(combobox);

    // Arrow down to navigate
    await userEvent.keyboard('{ArrowDown}');
    const firstOption = screen.getByRole('option', { name: /english/i });
    expect(firstOption).toHaveClass('focused'); // or similar class for focus
  });

  it('should prevent selecting already selected options', async () => {
    const onChange = vi.fn();
    render(
      <MultiSelect label="Languages" options={defaultOptions} value={['en']} onChange={onChange} />
    );

    const combobox = screen.getByRole('combobox', { name: /languages/i });
    await userEvent.click(combobox);

    const englishOption = screen.getByRole('option', { name: /english/i });
    expect(englishOption).toHaveAttribute('aria-selected', 'true');
  });
});
