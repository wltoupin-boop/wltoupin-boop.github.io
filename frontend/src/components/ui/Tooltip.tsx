import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  className,
}) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const offset = 8;
    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = rect.top - offset + window.scrollY;
        left = rect.left + rect.width / 2 + window.scrollX;
        break;
      case 'bottom':
        top = rect.bottom + offset + window.scrollY;
        left = rect.left + rect.width / 2 + window.scrollX;
        break;
      case 'left':
        top = rect.top + rect.height / 2 + window.scrollY;
        left = rect.left - offset + window.scrollX;
        break;
      case 'right':
        top = rect.top + rect.height / 2 + window.scrollY;
        left = rect.right + offset + window.scrollX;
        break;
    }

    setPosition({ top, left });
    setVisible(true);
  };

  const translateClass: Record<typeof placement, string> = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setVisible(false)}
        onFocus={showTooltip}
        onBlur={() => setVisible(false)}
        className="inline-flex"
      >
        {children}
      </div>
      {visible &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: position.top, left: position.left }}
            className={cn(
              'pointer-events-none absolute z-[9999] max-w-xs rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white shadow-lg',
              translateClass[placement],
              className
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};
