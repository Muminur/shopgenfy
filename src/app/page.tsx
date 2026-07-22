import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Testimonials } from '@/components/landing/Testimonials';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Download,
  ArrowRight,
  Globe,
  Github,
  FolderUp,
  Shield,
  Check,
} from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: 'Three ways in',
    description:
      'Point it at a website URL, a GitHub repo, or a local codebase. Shopgenfy reads whichever one you have and works from there.',
    flagship: true,
  },
  {
    icon: Sparkles,
    title: 'Compliant images, generated',
    description: 'Icons and feature images at the exact Shopify spec — no resizing afterward.',
  },
  {
    icon: Shield,
    title: 'Guideline checks built in',
    description:
      'Character limits and content rules are enforced as you type, not after rejection.',
  },
  {
    icon: Download,
    title: 'One export, ready to submit',
    description: 'Every asset and every field, packaged for the App Store in a single download.',
  },
];

const pipeline = [
  {
    number: '1',
    title: 'Enter Your URL',
    description:
      'A landing page URL, a GitHub link, or a zipped source folder — pick whichever fits.',
  },
  {
    number: '2',
    title: 'Generate Content',
    description:
      'Gemini reads what you gave it and drafts Shopify-compliant copy, features, and images.',
  },
  {
    number: '3',
    title: 'Export & Submit',
    description: 'Review the draft, adjust anything, and export a package ready for the App Store.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main role="main" className="flex-1">
        {/* Hero — asymmetric: copy left, live product glimpse right. */}
        <section className="border-b bg-background">
          <div className="container mx-auto grid max-w-6xl gap-12 px-4 py-20 md:py-28 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:ease-out">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-3 py-1 text-xs font-medium tracking-wide text-accent-foreground uppercase">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                AI-powered Shopify submissions
              </div>

              <h1 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl md:text-6xl">
                Your <span className="text-primary">Shopgenfy</span> Shopify App Store Submission
                Assistant
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Turn a website, a GitHub repo, or your own source code into a complete Shopify App
                Store submission — compliant copy, compliant images, exported in one package.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/dashboard">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="#how-it-works">Learn More</Link>
                </Button>
              </div>
            </div>

            {/* Product glimpse: a real (miniature) rendering of the dashboard's
                input control and generated-image output, not a stock photo or
                an abstract gradient. */}
            <div
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:delay-100 motion-safe:ease-out"
              aria-hidden="true"
            >
              <div className="rounded-xl border bg-card p-4 shadow-lg">
                <div className="mb-4 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                  <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                  <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                  <span className="ml-3 font-mono text-xs text-muted-foreground">
                    shopgenfy.app/dashboard
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-xs">
                  <div className="rounded-md bg-background py-1.5 text-center font-medium shadow-sm">
                    Website URL
                  </div>
                  <div className="flex items-center justify-center gap-1 py-1.5 text-center text-muted-foreground">
                    <Github className="h-3 w-3" />
                    GitHub Repo
                  </div>
                  <div className="flex items-center justify-center gap-1 py-1.5 text-center text-muted-foreground">
                    <FolderUp className="h-3 w-3" />
                    Local Source
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
                  <span className="font-medium">appName:</span>{' '}
                  <span className="font-mono">&quot;OrderFlow&quot;</span>
                  {/* accent-foreground, not primary — primary-on-accent only
                      hits 4.22:1 here, below the 4.5:1 floor (verified). */}
                  <div className="mt-1 flex items-center gap-1.5 text-accent-foreground">
                    <Check className="h-3 w-3" />
                    Within 30-character limit
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  <div className="col-span-1 aspect-square rounded-md bg-gradient-to-br from-primary/25 to-primary/10" />
                  <div className="col-span-3 aspect-[16/9] rounded-md bg-gradient-to-br from-accent to-primary/10" />
                </div>
                <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
                  1200×1200 icon · 1600×900 feature — exact spec, every time
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features — one flagship capability given real weight, three
            supporting ones alongside it (bento with variety, not four
            identical icon-title-blurb tiles). */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Powerful Features for App Developers
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                Everything you need to create a perfect Shopify App Store submission.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {features
                .filter((f) => f.flagship)
                .map((feature) => (
                  <div
                    key={feature.title}
                    className="group rounded-xl border bg-card p-8 shadow-md transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-lg lg:col-span-2 lg:row-span-2"
                  >
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-2 max-w-md text-muted-foreground">{feature.description}</p>
                  </div>
                ))}

              <div className="grid gap-4 lg:row-span-2">
                {features
                  .filter((f) => !f.flagship)
                  .map((feature) => (
                    <div
                      key={feature.title}
                      className="group rounded-xl border bg-card p-6 shadow-md transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <feature.icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="font-semibold">{feature.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works — a left-aligned technical pipeline (analyze → generate
            → export is literally what the product does), not centered numbered
            circles. */}
        <section id="how-it-works" className="border-y bg-muted/40 py-16 md:py-24">
          <div className="container mx-auto max-w-4xl px-4">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
              <p className="mt-3 text-lg text-muted-foreground">
                Three steps from source to a submission-ready package.
              </p>
            </div>

            <ol className="mt-12 space-y-0">
              {pipeline.map((step, index) => (
                <li key={step.number} className="relative flex gap-6 pb-12 last:pb-0">
                  {index < pipeline.length - 1 && (
                    <span
                      className="absolute top-10 left-[19px] h-full w-px bg-border"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card font-mono text-sm font-medium text-primary shadow-sm">
                    {step.number}
                  </span>
                  <div className="pt-1.5">
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1 text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Testimonials Section */}
        <Testimonials />

        {/* CTA — an inset panel rather than a full-bleed solid-primary strip,
            asymmetric layout instead of centered stack. */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto max-w-5xl px-4">
            <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-primary/20 bg-primary px-8 py-10 shadow-lg md:flex-row md:items-center md:px-12 md:py-12">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">
                  Ready to Submit Your App?
                </h2>
                {/* Full-opacity primary-foreground, not a partial-alpha
                    variant — alpha blending would soften contrast below the
                    verified 4.87:1 ratio (see globals.css) in a way that's
                    hard to re-verify precisely. */}
                <p className="mt-3 text-primary-foreground">
                  Join developers who are saving hours on their Shopify App Store submissions with
                  our AI-powered assistant.
                </p>
              </div>
              <Button asChild size="lg" variant="secondary" className="shrink-0 gap-2">
                <Link href="/dashboard">
                  Start Your Submission
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
