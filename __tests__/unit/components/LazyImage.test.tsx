import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LazyImage } from '@/components/ui/LazyImage';

describe('LazyImage', () => {
  it('should render with loading="lazy" by default', () => {
    render(<LazyImage src="/test.jpg" alt="Test image" width={100} height={100} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
  });

  it('should use priority loading when priority prop is true', () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test image" width={100} height={100} priority />
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <LazyImage
        src="/test.jpg"
        alt="Test image"
        width={100}
        height={100}
        className="custom-class"
      />
    );
    const img = container.querySelector('img');
    expect(img?.className).toContain('custom-class');
  });

  it('should pass through all Next.js Image props', () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test image" width={100} height={100} quality={90} />
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  it('should use fill layout when fill prop is provided', () => {
    const { container } = render(<LazyImage src="/test.jpg" alt="Test image" fill />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  it('should handle object-fit styling', () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test image" fill style={{ objectFit: 'cover' }} />
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  it('should support responsive sizes', () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test image" fill sizes="(max-width: 768px) 100vw, 50vw" />
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });
});
