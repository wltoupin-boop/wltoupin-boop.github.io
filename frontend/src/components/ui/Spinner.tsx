import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, label }) => (
  <div className="flex flex-col items-center justify-center gap-2">
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      className={cn(
        'animate-spin rounded-full border-neutral-200 border-t-primary-600',
        sizeClasses[size],
        className
      )}
    />
    {label && <p className="text-sm text-neutral-500">{label}</p>}
  </div>
);

export const FullPageSpinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex h-screen items-center justify-center">
    <Spinner size="lg" label={label ?? 'Loading...'} />
  </div>
);
