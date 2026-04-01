'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      setAuth(data.access_token, data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-14">
          <img alt="Amboras Logo" loading="lazy" width="24" height="24" decoding="async" className="object-contain" src="/logo.svg" />
          <span className="font-semibold text-foreground text-lg tracking-tight">Amboras</span>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Sign in to your analytics dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground/70 mb-1.5">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@techgear.com"
              className="h-11"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground/70 mb-1.5">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11"
              required
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-destructive/10 rounded-xl">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 text-sm mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <Card className="mt-10">
          <CardContent className="pt-1">
            <p className="text-xs font-semibold text-muted-foreground mb-2.5 uppercase tracking-wide">Demo credentials</p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-mono">admin@techgear.com / password123</p>
              <p className="text-xs text-muted-foreground font-mono">admin@fashionhub.com / password123</p>
              <p className="text-xs text-muted-foreground font-mono">admin@homeessentials.com / password123</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
