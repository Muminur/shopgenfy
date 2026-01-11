import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';

describe('MultiSelect', () => {
  it('should render with label', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    render(<MultiSelect label="Languages" options={[]} value={[]} onChange={() => {}} />);

    expect(screen.getByText('Languages')).toBeInTheDocument();
  });

  it('should display placeholder when no items selected', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    render(
      <MultiSelect
        label="Languages"
        placeholder="Select languages..."
        options={[]}
        value={[]}
        onChange={() => {}}
      />
    );

    expect(screen.getByPlaceholderText('Select languages...')).toBeInTheDocument();
  });

  it('should render available options when opened', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
      { value: 'fr', label: 'French' },
    ];

    render(<MultiSelect label="Languages" options={options} value={[]} onChange={() => {}} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Spanish')).toBeInTheDocument();
    expect(screen.getByText('French')).toBeInTheDocument();
  });

  it('should call onChange when option is selected', async () => {
    const onChange = vi.fn();
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
    ];

    render(<MultiSelect label="Languages" options={options} value={[]} onChange={onChange} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    const englishOption = screen.getByRole('option', { name: 'English' });
    fireEvent.click(englishOption);

    expect(onChange).toHaveBeenCalledWith(['en']);
  });

  it('should display selected items as badges', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
    ];

    render(
      <MultiSelect label="Languages" options={options} value={['en', 'es']} onChange={() => {}} />
    );

    expect(screen.getByTestId('selected-badge-en')).toBeInTheDocument();
    expect(screen.getByTestId('selected-badge-es')).toBeInTheDocument();
  });

  it('should remove item when badge close button is clicked', async () => {
    const onChange = vi.fn();
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
    ];

    render(
      <MultiSelect label="Languages" options={options} value={['en', 'es']} onChange={onChange} />
    );

    const removeButton = screen.getByTestId('remove-badge-en');
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith(['es']);
  });

  it('should filter options based on search input', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
      { value: 'fr', label: 'French' },
    ];

    render(<MultiSelect label="Languages" options={options} value={[]} onChange={() => {}} />);

    const input = screen.getByRole('combobox');
    await userEvent.click(input); // Click to focus and open
    await userEvent.type(input, 'Spa');

    expect(screen.getByText('Spanish')).toBeInTheDocument();
    expect(screen.queryByText('English')).not.toBeInTheDocument();
    expect(screen.queryByText('French')).not.toBeInTheDocument();
  });

  it('should enforce max selections limit', async () => {
    const onChange = vi.fn();
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
      { value: '3', label: 'Option 3' },
    ];

    render(
      <MultiSelect
        label="Options"
        options={options}
        value={['1', '2']}
        maxSelections={2}
        onChange={onChange}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    const option3 = screen.getByRole('option', { name: 'Option 3' });
    fireEvent.click(option3);

    // Should not call onChange as limit is reached
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should deselect item when clicking selected option', async () => {
    const onChange = vi.fn();
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
    ];

    render(<MultiSelect label="Languages" options={options} value={['en']} onChange={onChange} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    const englishOption = screen.getByRole('option', { name: 'English' });
    fireEvent.click(englishOption);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should show helper text when provided', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    render(
      <MultiSelect
        label="Languages"
        options={[]}
        value={[]}
        onChange={() => {}}
        helperText="Select supported languages"
      />
    );

    expect(screen.getByText('Select supported languages')).toBeInTheDocument();
  });

  it('should show no options message when options array is empty', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    render(<MultiSelect label="Languages" options={[]} value={[]} onChange={() => {}} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    expect(screen.getByText(/no options found/i)).toBeInTheDocument();
  });

  it('should show no options message when search returns empty', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
    ];

    render(<MultiSelect label="Languages" options={options} value={[]} onChange={() => {}} />);

    const input = screen.getByRole('combobox');
    await userEvent.click(input); // Click to focus and open
    await userEvent.type(input, 'xyz');

    expect(screen.getByText(/no options found/i)).toBeInTheDocument();
  });

  it('should toggle dropdown on input focus', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [{ value: 'en', label: 'English' }];

    render(<MultiSelect label="Languages" options={options} value={[]} onChange={() => {}} />);

    const input = screen.getByRole('combobox');

    // Initially not expanded
    expect(input).toHaveAttribute('aria-expanded', 'false');

    // Focus should open
    fireEvent.focus(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('should toggle dropdown on wrapper click', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [{ value: 'en', label: 'English' }];

    const { container } = render(
      <MultiSelect label="Languages" options={options} value={[]} onChange={() => {}} />
    );

    const wrapper = container.querySelector('.cursor-pointer') as HTMLElement;
    const input = screen.getByRole('combobox');

    // Initially closed
    expect(input).toHaveAttribute('aria-expanded', 'false');

    // Click to open
    fireEvent.click(wrapper);
    expect(input).toHaveAttribute('aria-expanded', 'true');

    // Click to close
    fireEvent.click(wrapper);
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('should mark selected options visually', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
    ];

    render(<MultiSelect label="Languages" options={options} value={['en']} onChange={() => {}} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    const englishOption = screen.getByRole('option', { name: 'English' });
    const spanishOption = screen.getByRole('option', { name: 'Spanish' });

    expect(englishOption).toHaveAttribute('aria-selected', 'true');
    expect(spanishOption).toHaveAttribute('aria-selected', 'false');
  });

  it('should disable unselected options when max is reached', async () => {
    const { MultiSelect } = await import('@/components/forms/MultiSelect');
    const options = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
      { value: '3', label: 'Option 3' },
    ];

    render(
      <MultiSelect
        label="Options"
        options={options}
        value={['1', '2']}
        maxSelections={2}
        onChange={() => {}}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    const option3 = screen.getByRole('option', { name: 'Option 3' });
    expect(option3).toHaveAttribute('aria-disabled', 'true');
  });
});
