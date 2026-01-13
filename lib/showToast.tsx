'use client';

import { ReactNode, FunctionComponent, SVGProps, MouseEventHandler } from 'react';
import { toast, Id } from 'react-toastify';
import { Toast } from '@/components/common/Toast';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const MIN_AUTO_CLOSE = 3000; // 3 seconds
const DURATION_PER_CHAR = 66; // milliseconds per character

export type ShowToastProps = {
  type: 'confirm' | 'error' | 'info' | 'warning';
  Icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  isClosable?: boolean;
  onClose?: () => void;
  size?: 'small' | 'medium' | 'large';
  autoClose?: boolean | number;
  isClaim?: boolean;
  isScannerDetail?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  bottomText?: ReactNode;
  onBottomText?: MouseEventHandler<HTMLDivElement>;
  containerId?: string;
};

// Default icons based on type
const getDefaultIcon = (type: ShowToastProps['type']) => {
  switch (type) {
    case 'confirm':
      return CheckCircle2;
    case 'error':
    case 'warning':
      return AlertCircle;
    case 'info':
      return Info;
    default:
      return Info;
  }
};

// Calculate auto-close duration based on text length
function calcAutoClose(textLength: number): number {
  return Math.max(MIN_AUTO_CLOSE, textLength * DURATION_PER_CHAR);
}

export function showToast(props: ShowToastProps): string | undefined {
  const {
    type,
    Icon,
    isClosable = true,
    onClose,
    size = 'medium',
    autoClose = true,
    isClaim = false,
    isScannerDetail = false,
    title,
    description,
    bottomText,
    onBottomText,
    containerId,
  } = props;

  // Return early if both title and description are empty
  if (!title && !description) {
    return undefined;
  }

  // Get icon
  const ToastIcon = Icon || getDefaultIcon(type);

  // Map confirm to success for react-toastify
  const toastType = type === 'confirm' ? 'success' : type;

  // Calculate text length for auto-close
  const textContent = [title, description, bottomText]
    .filter(Boolean)
    .map((text) => (typeof text === 'string' ? text : ''))
    .join(' ');
  const textLength = textContent.length;

  // Determine container ID
  let finalContainerId = containerId;
  if (isClaim) {
    finalContainerId = 'claim';
  } else if (isScannerDetail) {
    finalContainerId = 'scanner';
  }

  // Get icon color based on type
  const getIconColor = () => {
    switch (type) {
      case 'confirm':
        return 'var(--success)';
      case 'error':
        return 'var(--error)';
      case 'warning':
        return 'var(--secondary)';
      case 'info':
        return 'var(--success)'; // Info uses success color in this design
      default:
        return 'var(--text-primary)';
    }
  };

  // Render toast content - aligned with codebase design
  const toastContent = (
    <div className="flex items-start gap-2" data-size={size}>
      <div className="flex-shrink-0 mt-0.5">
        <ToastIcon className="w-5 h-5" style={{ color: getIconColor() }} />
      </div>
      <div className="flex-1">
        <Toast
          title={title}
          description={description}
          bottomText={bottomText}
          onBottomText={onBottomText}
        />
      </div>
    </div>
  );

  // Calculate auto-close duration upfront
  let initialAutoClose: number | false = false;
  if (autoClose !== false) {
    initialAutoClose = autoClose === true ? calcAutoClose(textLength) : autoClose;
  }

  // Show toast with auto-close
  const toastId = toast[toastType](toastContent, {
    autoClose: initialAutoClose || false, // Explicitly set autoClose
    closeButton: isClosable,
    containerId: finalContainerId,
    onClose,
    icon: false, // We're using custom icon in content
  });

  // Update toast with size attribute and ensure auto-close after render
  if (toastId) {
    setTimeout(() => {
      // Set size attribute
      const toastElement = document.querySelector(`[id="${toastId}"]`);
      if (toastElement) {
        toastElement.setAttribute('data-size', size);
      }

      // Ensure auto-close is set correctly (update if needed)
      if (initialAutoClose && initialAutoClose !== false) {
        toast.update(toastId, {
          autoClose: initialAutoClose,
        });
      }
    }, 100); // Small delay to ensure toast is rendered
  }

  return typeof toastId === 'string' ? toastId : undefined;
}
