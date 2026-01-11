import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Testimonials } from '@/components/landing/Testimonials';

describe('Testimonials Component', () => {
  it('should render the testimonials section', () => {
    render(<Testimonials />);
    expect(screen.getByRole('region', { name: /what developers say/i })).toBeInTheDocument();
  });

  it('should display 3-4 testimonials', () => {
    render(<Testimonials />);
    const testimonials = screen.getAllByTestId('testimonial-card');
    expect(testimonials.length).toBeGreaterThanOrEqual(3);
    expect(testimonials.length).toBeLessThanOrEqual(4);
  });

  it('should show testimonial author info for each testimonial', () => {
    render(<Testimonials />);
    const authorNames = screen.getAllByTestId('testimonial-author');
    expect(authorNames.length).toBeGreaterThanOrEqual(3);
    authorNames.forEach((author) => {
      expect(author).toHaveTextContent(/.+/); // Non-empty author name
    });
  });

  it('should show testimonial role for each testimonial', () => {
    render(<Testimonials />);
    const roles = screen.getAllByTestId('testimonial-role');
    expect(roles.length).toBeGreaterThanOrEqual(3);
    roles.forEach((role) => {
      expect(role).toHaveTextContent(/.+/); // Non-empty role
    });
  });

  it('should render testimonial quotes', () => {
    render(<Testimonials />);
    const quotes = screen.getAllByTestId('testimonial-quote');
    expect(quotes.length).toBeGreaterThanOrEqual(3);
    quotes.forEach((quote) => {
      expect(quote).toHaveTextContent(/.+/); // Non-empty quote
    });
  });

  it('should render in a responsive grid layout', () => {
    render(<Testimonials />);
    const grid = screen.getByTestId('testimonials-grid');
    expect(grid).toHaveClass('grid');
  });

  it('should have proper accessibility attributes', () => {
    render(<Testimonials />);
    const section = screen.getByRole('region', { name: /what developers say/i });
    expect(section).toBeInTheDocument();

    const quotes = screen.getAllByTestId('testimonial-quote');
    quotes.forEach((quote) => {
      expect(quote.closest('[role="figure"]')).toBeInTheDocument();
    });
  });

  it('should include section heading', () => {
    render(<Testimonials />);
    expect(screen.getByRole('heading', { name: /what developers say/i })).toBeInTheDocument();
  });
});
