'use client';

import { useRouter } from 'next/navigation';
import { clearAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function DashboardHeader() {
  const router = useRouter();

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md flex items-center justify-between py-5 mb-2">
      <div className="flex items-center gap-3">
        <img alt="Amboras Logo" loading="lazy" width="18" height="18" decoding="async" className="object-contain" src="/logo.svg" />
        <span className="text-sm font-semibold text-foreground tracking-tight">Amboras</span>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Logout
      </Button>
    </header>
  );
}
