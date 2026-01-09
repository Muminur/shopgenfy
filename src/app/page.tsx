import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Download, ArrowRight, Globe, Zap, Shield } from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: 'AI Landing Page Analysis',
    description:
      'Paste your landing page URL and let Gemini AI automatically extract and generate Shopify-compliant content.',
  },
  {
    icon: Sparkles,
    title: 'Smart Image Generation',
    description:
      'Generate professional app icons and feature images that meet all Shopify App Store specifications.',
  },
  {
    icon: Shield,
    title: 'Compliance Validation',
    description:
      'Real-time validation ensures your submission meets all character limits and content guidelines.',
  },
  {
    icon: Download,
    title: 'One-Click Export',
    description:
      'Download all assets and content in a ready-to-submit package for the Shopify App Store.',
  },
];

const steps = [
  {
    number: '1',
    title: 'Enter Your URL',
    description: 'Paste your app landing page URL and let our AI analyze your content.',
  },
  {
    number: '2',
    title: 'Generate Content',
    description: 'AI creates Shopify-compliant descriptions, features, and images automatically.',
  },
  {
    number: '3',
    title: 'Export & Submit',
    description: 'Review, customize, and export your complete submission package.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main role="main" className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
          <div className="container max-w-6xl mx-auto px-4 py-16 md:py-24 lg:py-32">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary">
                <Sparkles className="h-4 w-4" />
                <span>AI-Powered Shopify Submissions</span>
              </div>

              <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Your <span className="text-primary">Shopgenfy</span> Shopify App Store Submission
                Assistant
              </h1>

              <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
                Transform your landing page into a complete Shopify App Store submission in minutes.
                AI-powered content generation, compliant images, and one-click export.
              </p>

              <div className="flex flex-col gap-4 sm:flex-row">
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
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Powerful Features for App Developers
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Everything you need to create a perfect Shopify App Store submission
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card key={feature.title} className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 md:py-24">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Three simple steps to your Shopify App Store submission
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="relative text-center">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                    {step.number}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 bg-primary">
          <div className="container max-w-4xl mx-auto px-4 text-center">
            <div className="flex flex-col items-center space-y-6">
              <Zap className="h-12 w-12 text-primary-foreground" />
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                Ready to Submit Your App?
              </h2>
              <p className="max-w-xl text-lg text-primary-foreground/80">
                Join developers who are saving hours on their Shopify App Store submissions with our
                AI-powered assistant.
              </p>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="gap-2 text-primary hover:text-primary"
              >
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
