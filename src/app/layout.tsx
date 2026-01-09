import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
