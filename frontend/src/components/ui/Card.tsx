import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick, hoverable }) => (
  <div
    onClick={onClick}
    className={cn(
      'rounded-lg border border-neutral-200 bg-white shadow-sm',
      hoverable && 'cursor-pointer transition-shadow hover:shadow-md hover:border-neutral-300',
      className
    )}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className, actions }) => (
  <div
    className={cn(
      'flex items-center justify-between border-b border-neutral-200 px-5 py-4',
      className
    )}
  >
    <div className="flex items-center gap-2 min-w-0">{children}</div>
    {actions && <div className="flex items-center gap-2 ml-4 shrink-0">{actions}</div>}
  </div>
);

export const CardBody: React.FC<CardBodyProps> = ({ children, className }) => (
  <div className={cn('px-5 py-4', className)}>{children}</div>
);

export const CardFooter: React.FC<CardFooterProps> = ({ children, className }) => (
  <div
    className={cn(
      'flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3',
      className
    )}
  >
    {children}
  </div>
);
