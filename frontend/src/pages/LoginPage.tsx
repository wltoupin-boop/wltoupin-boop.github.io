import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FlaskConical, Mail, Lock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { signIn, signInWithGoogle } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof schema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setError(friendlyError(msg));
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(friendlyError(msg));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800">
      {/* Left: branding */}
      <div className="hidden lg:flex flex-col justify-center items-start px-16 w-1/2 text-white">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <FlaskConical className="h-9 w-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">CellGene Tracker</h1>
              <p className="text-primary-300 text-sm">Cell & Gene Therapy Intelligence Platform</p>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                The most comprehensive cell & gene therapy pipeline tracker
              </h2>
              <p className="text-primary-200 leading-relaxed">
                Track FDA approval timelines, clinical milestones, and operational readiness
                across your institution's therapy portfolio.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { n: '500+', label: 'Therapies Tracked' },
                { n: '90+', label: 'Upcoming Milestones' },
                { n: '50+', label: 'Institutions' },
                { n: 'AI', label: 'Powered Insights' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/10 backdrop-blur p-4">
                  <p className="text-2xl font-bold text-white">{stat.n}</p>
                  <p className="text-primary-300 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl bg-white shadow-2xl p-8">
            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-8 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-800">
                <FlaskConical className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary-900">CellGene Tracker</h1>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900">Sign in</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Access your therapy intelligence dashboard
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                placeholder="you@institution.edu"
                leftIcon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                error={errors.password?.message}
                {...register('password')}
              />

              <Button
                type="submit"
                loading={isSubmitting}
                className="w-full"
                size="lg"
              >
                Sign in
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <hr className="flex-1 border-neutral-200" />
              <span className="text-xs text-neutral-400">or</span>
              <hr className="flex-1 border-neutral-200" />
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              loading={googleLoading}
              onClick={handleGoogle}
              leftIcon={
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              }
            >
              Continue with Google
            </Button>

            <p className="mt-6 text-center text-sm text-neutral-500">
              Need institutional access?{' '}
              <a href="mailto:access@cellgenetracker.com" className="text-primary-600 hover:underline font-medium">
                Request access
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

function friendlyError(msg: string): string {
  if (msg.includes('user-not-found') || msg.includes('wrong-password')) {
    return 'Invalid email or password. Please try again.';
  }
  if (msg.includes('too-many-requests')) {
    return 'Too many attempts. Please try again later.';
  }
  if (msg.includes('network')) {
    return 'Network error. Check your connection.';
  }
  return msg;
}
