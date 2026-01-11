import { Card, CardContent } from '@/components/ui/card';
import { Quote } from 'lucide-react';

interface Testimonial {
  id: string;
  author: string;
  role: string;
  company: string;
  quote: string;
}

const testimonials: Testimonial[] = [
  {
    id: '1',
    author: 'Sarah Johnson',
    role: 'Senior Developer',
    company: 'TechCraft Apps',
    quote:
      'This tool saved me hours of work. The AI analysis is incredibly accurate, and the generated images met all requirements on the first try.',
  },
  {
    id: '2',
    author: 'Michael Chen',
    role: 'Product Manager',
    company: 'Commerce Solutions',
    quote:
      'The auto-fill feature is a game-changer. What used to take a full day now takes less than an hour. The validation ensures we never miss a requirement.',
  },
  {
    id: '3',
    author: 'Emma Williams',
    role: 'Indie Developer',
    company: 'Solo Ventures',
    quote:
      'As a solo developer, having this assistant handle the tedious submission process lets me focus on building great apps. Highly recommended!',
  },
];

export function Testimonials() {
  return (
    <section
      className="py-16 md:py-24 bg-muted/30"
      aria-label="Testimonials from developers"
      role="region"
    >
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            What Developers Are Saying
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join developers who are saving hours on their app submissions
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              data-testid="testimonial-card"
              className="border-0 shadow-sm"
            >
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-primary/20 mb-4" aria-hidden="true" />
                <blockquote className="mb-4 text-muted-foreground">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {testimonial.author
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">
                      {testimonial.role} at {testimonial.company}
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
