import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MultiSelect } from '@/components/forms/MultiSelect';

describe('MultiSelect Component', () => {
  const mockOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  it('should render with label', () => {
    render(<MultiSelect label="Test Select" options={mockOptions} value={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Test Select')).toBeInTheDocument();
  });

  it('should display selected values', () => {
    render(
      <MultiSelect
        label="Test Select"
        options={mockOptions}
        value={['option1', 'option2']}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('should call onChange when selecting an option', () => {
    const handleChange = vi.fn();
    render(
      <MultiSelect label="Test Select" options={mockOptions} value={[]} onChange={handleChange} />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Find the option by text content since Command component may not use role="option" correctly
    const option1 = screen.getByText('Option 1');
    fireEvent.click(option1);

    expect(handleChange).toHaveBeenCalledWith(['option1']);
  });

  it('should call onChange when deselecting an option', () => {
    const handleChange = vi.fn();
    render(
      <MultiSelect
        label="Test Select"
        options={mockOptions}
        value={['option1']}
        onChange={handleChange}
      />
    );

    const removeButton = screen.getByLabelText(/remove option 1/i);
    fireEvent.click(removeButton);

    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('should show placeholder when no selection', () => {
    render(
      <MultiSelect
        label="Test Select"
        options={mockOptions}
        value={[]}
        onChange={vi.fn()}
        placeholder="Select options..."
      />
    );
    expect(screen.getByText('Select options...')).toBeInTheDocument();
  });

  it('should display helper text when provided', () => {
    render(
      <MultiSelect
        label="Test Select"
        options={mockOptions}
        value={[]}
        onChange={vi.fn()}
        helperText="This is a helper text"
      />
    );
    expect(screen.getByText('This is a helper text')).toBeInTheDocument();
  });

  it('should enforce maxItems limit', () => {
    const handleChange = vi.fn();
    render(
      <MultiSelect
        label="Test Select"
        options={mockOptions}
        value={['option1', 'option2']}
        onChange={handleChange}
        maxItems={2}
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Should show warning about max items
    expect(screen.getByText(/maximum 2 items/i)).toBeInTheDocument();
  });

  it('should disable selection when max items reached', () => {
    const handleChange = vi.fn();
    render(
      <MultiSelect
        label="Test Select"
        options={mockOptions}
        value={['option1', 'option2']}
        onChange={handleChange}
        maxItems={2}
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Find the option by text since Command component doesn't guarantee role="option"
    const option3 = screen.getByText('Option 3').closest('[data-disabled]');
    expect(option3).toHaveAttribute('data-disabled', 'true');
  });

  it('should have proper accessibility attributes', () => {
    render(<MultiSelect label="Test Select" options={mockOptions} value={[]} onChange={vi.fn()} />);

    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('aria-expanded');
    expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('should display search functionality', () => {
    render(<MultiSelect label="Test Select" options={mockOptions} value={[]} onChange={vi.fn()} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('should filter options based on search', () => {
    render(<MultiSelect label="Test Select" options={mockOptions} value={[]} onChange={vi.fn()} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Option 1' } });

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.queryByText('Option 2')).not.toBeInTheDocument();
  });
});
