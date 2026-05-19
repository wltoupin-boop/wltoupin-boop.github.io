import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: { value: number; label?: string };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
  onClick?: () => void;
}

const variantClasses = {
  default: { card: 'bg-white', icon: 'bg-neutral-100 text-neutral-600', value: 'text-neutral-900' },
  primary: { card: 'bg-primary-50', icon: 'bg-primary-100 text-primary-700', value: 'text-primary-900' },
  success: { card: 'bg-accent-50', icon: 'bg-accent-100 text-accent-700', value: 'text-accent-900' },
  warning: { card: 'bg-warning-50', icon: 'bg-warning-100 text-warning-700', value: 'text-warning-900' },
  danger: { card: 'bg-red-50', icon: 'bg-red-100 text-red-700', value: 'text-red-900' },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  variant = 'default',
  className,
  onClick,
}) => {
  const classes = variantClasses[variant];
  const trendPositive = trend && trend.value > 0;
  const trendNeutral = trend && trend.value === 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-neutral-200 p-5',
        classes.card,
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-500">{label}</p>
          <p className={cn('mt-1 text-3xl font-bold tabular-nums', classes.value)}>
            {value}
          </p>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trendNeutral ? (
                <Minus className="h-3.5 w-3.5 text-neutral-400" />
              ) : trendPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-accent-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              )}
              <span
                className={cn(
                  'font-medium',
                  trendNeutral ? 'text-neutral-500' : trendPositive ? 'text-accent-700' : 'text-red-600'
                )}
              >
                {trend.value > 0 ? '+' : ''}{trend.value}
              </span>
              {trend.label && <span className="text-neutral-400">{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn('ml-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', classes.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
