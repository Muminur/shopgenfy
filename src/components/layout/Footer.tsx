'use client';

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer role="contentinfo" className="border-t bg-background">
      <div className="flex flex-col items-center gap-4 px-4 py-6 md:flex-row md:justify-between md:px-6">
        <div className="text-sm text-muted-foreground">
          &copy; {currentYear} Shopgenfy. All rights reserved.
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
