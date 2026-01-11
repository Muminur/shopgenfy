import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Testimonials } from '@/components/landing/Testimonials';

describe('Testimonials Component', () => {
  it('should render the testimonials section', () => {
    render(<Testimonials />);
    expect(screen.getByRole('region', { name: /testimonials/i })).toBeInTheDocument();
  });

  it('should display section heading', () => {
    render(<Testimonials />);
    expect(
      screen.getByRole('heading', { name: /what developers are saying/i })
    ).toBeInTheDocument();
  });

  it('should display section description', () => {
    render(<Testimonials />);
    expect(screen.getByText(/join developers who are saving hours/i)).toBeInTheDocument();
  });

  it('should display at least 3 testimonials', () => {
    render(<Testimonials />);
    const testimonialCards = screen.getAllByTestId('testimonial-card');
    expect(testimonialCards.length).toBeGreaterThanOrEqual(3);
  });

  it('should display testimonial author names', () => {
    render(<Testimonials />);
    expect(screen.getByText(/sarah johnson/i)).toBeInTheDocument();
    expect(screen.getByText(/michael chen/i)).toBeInTheDocument();
    expect(screen.getByText(/emma williams/i)).toBeInTheDocument();
  });

  it('should display testimonial roles', () => {
    render(<Testimonials />);
    expect(screen.getByText(/senior developer/i)).toBeInTheDocument();
    expect(screen.getByText(/product manager/i)).toBeInTheDocument();
    expect(screen.getByText(/indie developer/i)).toBeInTheDocument();
  });

  it('should display testimonial quotes', () => {
    render(<Testimonials />);
    const quotes = screen.getAllByRole('blockquote');
    expect(quotes.length).toBeGreaterThanOrEqual(3);
  });

  it('should not contain Shopify branding in testimonials', () => {
    render(<Testimonials />);
    const section = screen.getByRole('region', { name: /testimonials/i });
    expect(section.textContent).not.toMatch(/shopify/i);
  });

  it('should not contain unverifiable claims', () => {
    render(<Testimonials />);
    const section = screen.getByRole('region', { name: /testimonials/i });
    expect(section.textContent).not.toMatch(/\b(best|#1|number one|only)\b/i);
  });

  it('should have proper accessibility attributes', () => {
    render(<Testimonials />);
    const section = screen.getByRole('region', { name: /testimonials/i });
    expect(section).toHaveAttribute('aria-label');
  });
});
