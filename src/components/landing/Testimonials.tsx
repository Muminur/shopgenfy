import { Card, CardContent } from '@/components/ui/card';
import { Quote } from 'lucide-react';

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company?: string;
}

const testimonials: Testimonial[] = [
  {
    id: '1',
    quote:
      'This tool saved me hours of work preparing my Shopify app submission. The AI analysis was spot-on and the generated images were perfect on the first try.',
    author: 'Sarah Chen',
    role: 'Lead Developer',
    company: 'TechFlow Apps',
  },
  {
    id: '2',
    quote:
      'The compliance validation caught several issues I would have missed. Got approved on my first submission thanks to this assistant!',
    author: 'Marcus Rodriguez',
    role: 'Solo Developer',
  },
  {
    id: '3',
    quote:
      'As someone who has struggled with writing compelling app descriptions, the AI-generated content was a game changer. Highly recommended!',
    author: 'Emily Watson',
    role: 'Product Manager',
    company: 'ShopBoost Solutions',
  },
  {
    id: '4',
    quote:
      'The export package feature is brilliant. Everything organized and ready to submit. This is now an essential tool in my workflow.',
    author: 'David Kim',
    role: 'Shopify Developer',
  },
];

export function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      role="region"
      aria-label="Testimonials"
      className="py-16 md:py-24 bg-muted/30"
    >
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 id="testimonials-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            What Developers Say
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Trusted by developers shipping apps to the Shopify App Store
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2" data-testid="testimonials-grid">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              className="border-0 shadow-sm"
              data-testid="testimonial-card"
              role="figure"
              aria-label={`Testimonial from ${testimonial.author}`}
            >
              <CardContent className="pt-6">
                <div className="mb-4">
                  <Quote className="h-8 w-8 text-primary/20" aria-hidden="true" />
                </div>

                <blockquote>
                  <p className="text-muted-foreground mb-4 italic" data-testid="testimonial-quote">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                </blockquote>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {testimonial.author
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </span>
                  </div>

                  <div>
                    <p className="font-semibold" data-testid="testimonial-author">
                      {testimonial.author}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="testimonial-role">
                      {testimonial.role}
                      {testimonial.company && ` at ${testimonial.company}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
