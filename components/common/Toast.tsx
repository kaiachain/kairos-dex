'use client';

import { ReactNode, MouseEventHandler } from 'react';

export interface ToastProps {
  title?: ReactNode;
  description?: ReactNode;
  bottomText?: ReactNode;
  onBottomText?: MouseEventHandler<HTMLDivElement>;
}

export function Toast({ title, description, bottomText, onBottomText }: ToastProps) {
  return (
    <div className="flex flex-col gap-1">
      {title && (
        <div className="font-semibold text-base text-text-primary">{title}</div>
      )}
      {description && (
        <div className="font-normal text-base text-text-secondary max-h-[200px] overflow-y-auto">
          {description}
        </div>
      )}
      {bottomText && (
        <div
          onClick={onBottomText}
          className="mt-2 underline cursor-pointer text-text-primary hover:opacity-80 transition-opacity"
        >
          {bottomText}
        </div>
      )}
    </div>
  );
}
