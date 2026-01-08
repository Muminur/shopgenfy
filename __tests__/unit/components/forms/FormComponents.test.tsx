import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

describe('Form Components', () => {
  describe('CharacterCountInput', () => {
    it('should render input with label', async () => {
      const { CharacterCountInput } = await import('@/components/forms/CharacterCountInput');
      render(<CharacterCountInput label="App Name" maxLength={30} />);

      expect(screen.getByLabelText('App Name')).toBeInTheDocument();
    });

    it('should display character count', async () => {
      const { CharacterCountInput } = await import('@/components/forms/CharacterCountInput');
      render(<CharacterCountInput label="App Name" maxLength={30} value="Test" />);

      expect(screen.getByText('4/30')).toBeInTheDocument();
    });

    it('should update character count on input', async () => {
      const onChange = vi.fn((e) => e.target.value);
      const TestWrapper = () => {
        const [value, setValue] = React.useState('');
        return (
          <CharacterCountInput
            label="App Name"
            maxLength={30}
            value={value}
            onChange={(e) => {
              onChange(e);
              setValue(e.target.value);
            }}
          />
        );
      };
      const React = await import('react');
      const { CharacterCountInput } = await import('@/components/forms/CharacterCountInput');
      render(<TestWrapper />);

      const input = screen.getByLabelText('App Name');
      await userEvent.type(input, 'Hello');

      expect(onChange).toHaveBeenCalled();
      expect(screen.getByText('5/30')).toBeInTheDocument();
    });

    it('should show warning when approaching limit', async () => {
      const { CharacterCountInput } = await import('@/components/forms/CharacterCountInput');
      render(<CharacterCountInput label="App Name" maxLength={30} value={'A'.repeat(25)} />);

      const counter = screen.getByText('25/30');
      expect(counter).toHaveClass('text-warning');
    });

    it('should show error when at limit', async () => {
      const { CharacterCountInput } = await import('@/components/forms/CharacterCountInput');
      render(<CharacterCountInput label="App Name" maxLength={30} value={'A'.repeat(30)} />);

      const counter = screen.getByText('30/30');
      expect(counter).toHaveClass('text-destructive');
    });

    it('should enforce maxLength', async () => {
      const { CharacterCountInput } = await import('@/components/forms/CharacterCountInput');
      render(<CharacterCountInput label="App Name" maxLength={30} />);

      const input = screen.getByLabelText('App Name') as HTMLInputElement;
      expect(input).toHaveAttribute('maxLength', '30');
    });

    it('should display helper text when provided', async () => {
      const { CharacterCountInput } = await import('@/components/forms/CharacterCountInput');
      render(
        <CharacterCountInput
          label="App Name"
          maxLength={30}
          helperText="Must start with your brand name"
        />
      );

      expect(screen.getByText('Must start with your brand name')).toBeInTheDocument();
    });

    it('should display error message when invalid', async () => {
      const { CharacterCountInput } = await import('@/components/forms/CharacterCountInput');
      render(<CharacterCountInput label="App Name" maxLength={30} error="App name is required" />);

      expect(screen.getByText('App name is required')).toBeInTheDocument();
      expect(screen.getByLabelText('App Name')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('CharacterCountTextarea', () => {
    it('should render textarea with label', async () => {
      const { CharacterCountTextarea } = await import('@/components/forms/CharacterCountTextarea');
      render(<CharacterCountTextarea label="Description" maxLength={500} />);

      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('should display character count', async () => {
      const { CharacterCountTextarea } = await import('@/components/forms/CharacterCountTextarea');
      render(
        <CharacterCountTextarea
          label="Description"
          maxLength={500}
          value="This is a test description"
        />
      );

      expect(screen.getByText('26/500')).toBeInTheDocument();
    });

    it('should update character count on input', async () => {
      const onChange = vi.fn((e) => e.target.value);
      const TestWrapper = () => {
        const [value, setValue] = React.useState('');
        return (
          <CharacterCountTextarea
            label="Description"
            maxLength={500}
            value={value}
            onChange={(e) => {
              onChange(e);
              setValue(e.target.value);
            }}
          />
        );
      };
      const React = await import('react');
      const { CharacterCountTextarea } = await import('@/components/forms/CharacterCountTextarea');
      render(<TestWrapper />);

      const textarea = screen.getByLabelText('Description');
      await userEvent.type(textarea, 'Hello World');

      expect(onChange).toHaveBeenCalled();
      expect(screen.getByText('11/500')).toBeInTheDocument();
    });

    it('should support multi-line input', async () => {
      const { CharacterCountTextarea } = await import('@/components/forms/CharacterCountTextarea');
      render(<CharacterCountTextarea label="Description" maxLength={500} rows={5} />);

      const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement;
      expect(textarea).toHaveAttribute('rows', '5');
    });
  });

  describe('FeatureListEditor', () => {
    it('should render empty list with add button', async () => {
      const { FeatureListEditor } = await import('@/components/forms/FeatureListEditor');
      render(<FeatureListEditor features={[]} onChange={() => {}} />);

      expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
    });

    it('should render existing features', async () => {
      const { FeatureListEditor } = await import('@/components/forms/FeatureListEditor');
      render(<FeatureListEditor features={['Feature 1', 'Feature 2']} onChange={() => {}} />);

      expect(screen.getByDisplayValue('Feature 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Feature 2')).toBeInTheDocument();
    });

    it('should add new feature when add button is clicked', async () => {
      const onChange = vi.fn();
      const { FeatureListEditor } = await import('@/components/forms/FeatureListEditor');
      render(<FeatureListEditor features={['Feature 1']} onChange={onChange} />);

      const addButton = screen.getByRole('button', { name: /add feature/i });
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith(['Feature 1', '']);
    });

    it('should remove feature when remove button is clicked', async () => {
      const onChange = vi.fn();
      const { FeatureListEditor } = await import('@/components/forms/FeatureListEditor');
      render(<FeatureListEditor features={['Feature 1', 'Feature 2']} onChange={onChange} />);

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      fireEvent.click(removeButtons[0]);

      expect(onChange).toHaveBeenCalledWith(['Feature 2']);
    });

    it('should update feature when input changes', async () => {
      const onChange = vi.fn();

      const TestWrapper = () => {
        const [features, setFeatures] = React.useState(['Feature 1']);
        return (
          <FeatureListEditor
            features={features}
            onChange={(newFeatures) => {
              onChange(newFeatures);
              setFeatures(newFeatures);
            }}
          />
        );
      };

      const React = await import('react');
      const { FeatureListEditor } = await import('@/components/forms/FeatureListEditor');
      render(<TestWrapper />);

      const input = screen.getByDisplayValue('Feature 1');
      await userEvent.clear(input);
      await userEvent.type(input, 'Updated Feature');

      expect(onChange).toHaveBeenCalled();
      // Last call should have the updated feature
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0]).toEqual(['Updated Feature']);
    });

    it('should enforce max items limit', async () => {
      const { FeatureListEditor } = await import('@/components/forms/FeatureListEditor');
      const features = Array(10)
        .fill('')
        .map((_, i) => `Feature ${i + 1}`);
      render(<FeatureListEditor features={features} onChange={() => {}} maxItems={10} />);

      const addButton = screen.getByRole('button', { name: /add feature/i });
      expect(addButton).toBeDisabled();
    });

    it('should enforce character limit per feature', async () => {
      const { FeatureListEditor } = await import('@/components/forms/FeatureListEditor');
      render(
        <FeatureListEditor features={['A'.repeat(80)]} onChange={() => {}} maxCharPerItem={80} />
      );

      const input = screen.getByDisplayValue('A'.repeat(80)) as HTMLInputElement;
      expect(input).toHaveAttribute('maxLength', '80');
    });

    it('should show character count for each feature', async () => {
      const { FeatureListEditor } = await import('@/components/forms/FeatureListEditor');
      render(
        <FeatureListEditor features={['Test feature']} onChange={() => {}} maxCharPerItem={80} />
      );

      expect(screen.getByText('12/80')).toBeInTheDocument();
    });
  });

  describe('URLInput', () => {
    it('should render input with label', async () => {
      const { URLInput } = await import('@/components/forms/URLInput');
      render(<URLInput label="Landing Page URL" />);

      expect(screen.getByLabelText('Landing Page URL')).toBeInTheDocument();
    });

    it('should validate URL format', async () => {
      const onValidate = vi.fn();
      const { URLInput } = await import('@/components/forms/URLInput');
      render(<URLInput label="URL" value="not-a-url" onValidate={onValidate} />);

      expect(onValidate).toHaveBeenCalledWith(false);
    });

    it('should accept valid URL', async () => {
      const onValidate = vi.fn();
      const { URLInput } = await import('@/components/forms/URLInput');
      render(<URLInput label="URL" value="https://example.com" onValidate={onValidate} />);

      expect(onValidate).toHaveBeenCalledWith(true);
    });

    it('should show error for invalid URL', async () => {
      const { URLInput } = await import('@/components/forms/URLInput');
      render(<URLInput label="URL" value="not-a-url" showValidation />);

      expect(screen.getByText(/invalid url/i)).toBeInTheDocument();
    });

    it('should show success indicator for valid URL', async () => {
      const { URLInput } = await import('@/components/forms/URLInput');
      render(<URLInput label="URL" value="https://example.com" showValidation />);

      // Check for success indicator (check icon or green border)
      const input = screen.getByLabelText('URL');
      expect(input.parentElement).toHaveClass('border-green-500');
    });
  });
});
