
import { ReactNode, MouseEventHandler, memo } from 'react';

export interface ToastProps {
  title?: ReactNode;
  description?: ReactNode;
  bottomText?: ReactNode;
  onBottomText?: MouseEventHandler<HTMLButtonElement>;
}

export const Toast = memo(function Toast({ title, description, bottomText, onBottomText }: ToastProps) {
  return (
    <div className="toast-content-inner">
      {title && (
        <h3 className="toast-title" role="heading" aria-level={3}>
          {title}
        </h3>
      )}
      {description && (
        <p className="toast-description" role="status">
          {description}
        </p>
      )}
      {bottomText && (
        <button
          type="button"
          onClick={onBottomText}
          className="toast-action-button"
          aria-label={typeof bottomText === 'string' ? bottomText : 'Action'}
        >
          {bottomText}
        </button>
      )}
    </div>
  );
});
