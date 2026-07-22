'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Settings, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMenuClick?: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header
      role="banner"
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex h-14 items-center px-4 md:px-6">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden mr-2"
          onClick={onMenuClick}
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">
            S
          </span>
          <span className="font-bold text-lg tracking-tight">Shopgenfy</span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-1 ml-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-3 -bottom-[calc(0.5rem+1px)] h-0.5 rounded-full bg-primary transition-all duration-200" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side - could add user menu, theme toggle, etc. */}
        <div className="flex items-center ml-auto space-x-4">
          {/* Placeholder for future user menu */}
        </div>
      </div>
    </header>
  );
}
