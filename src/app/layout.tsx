import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Shopgenfy - Shopify App Store Submission Assistant',
    template: '%s | Shopgenfy',
  },
  description:
    'AI-powered assistant to prepare and submit your apps to the Shopify App Store. Generate compliant content, images, and export packages.',
  keywords: [
    'Shopify',
    'App Store',
    'submission',
    'AI',
    'app listing',
    'image generation',
    'Gemini',
  ],
  authors: [{ name: 'Shopgenfy' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Shopgenfy',
    title: 'Shopgenfy - Shopify App Store Submission Assistant',
    description: 'AI-powered assistant to prepare and submit your apps to the Shopify App Store.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shopgenfy - Shopify App Store Submission Assistant',
    description: 'AI-powered assistant to prepare and submit your apps to the Shopify App Store.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shopgenfy.com';

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Shopgenfy',
    url: appUrl,
    description: 'AI-powered assistant to prepare and submit your apps to the Shopify App Store.',
  };

  const webApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Shopgenfy',
    url: appUrl,
    description:
      'AI-powered assistant to prepare and submit your apps to the Shopify App Store. Generate compliant content, images, and export packages.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="organization-jsonld" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(organizationSchema)}
        </Script>
        <Script id="webapp-jsonld" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(webApplicationSchema)}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
