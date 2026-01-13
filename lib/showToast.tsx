'use client';

import { ReactNode, FunctionComponent, SVGProps, MouseEventHandler, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Toast } from '@/components/common/Toast';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

// Constants
const MIN_AUTO_CLOSE_MS = 3000;
const DURATION_PER_CHAR_MS = 66;
const MAX_AUTO_CLOSE_MS = 10000;

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ShowToastProps {
  type: ToastType | 'confirm'; // 'confirm' is an alias for 'success'
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
  onBottomText?: MouseEventHandler<HTMLButtonElement>;
  containerId?: string;
}

// Icon mapping
const DEFAULT_ICONS: Record<ToastType, FunctionComponent<SVGProps<SVGSVGElement>>> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

// Icon color classes mapping
const ICON_COLOR_CLASSES: Record<ToastType, string> = {
  success: 'toast-icon-success',
  error: 'toast-icon-error',
  warning: 'toast-icon-warning',
  info: 'toast-icon-info',
};

/**
 * Normalizes toast type (converts 'confirm' to 'success')
 */
function normalizeToastType(type: ShowToastProps['type']): ToastType {
  return type === 'confirm' ? 'success' : type;
}

/**
 * Gets the appropriate icon for the toast type
 */
function getToastIcon(
  type: ShowToastProps['type'],
  customIcon?: FunctionComponent<SVGProps<SVGSVGElement>>
): FunctionComponent<SVGProps<SVGSVGElement>> {
  if (customIcon) return customIcon;
  const normalizedType = normalizeToastType(type);
  return DEFAULT_ICONS[normalizedType];
}

/**
 * Calculates auto-close duration based on content length
 */
function calculateAutoCloseDuration(content: string): number {
  const calculated = Math.max(MIN_AUTO_CLOSE_MS, content.length * DURATION_PER_CHAR_MS);
  return Math.min(calculated, MAX_AUTO_CLOSE_MS);
}

/**
 * Extracts text content from React nodes for length calculation
 */
function extractTextContent(...nodes: (ReactNode | undefined)[]): string {
  return nodes
    .filter(Boolean)
    .map((node) => {
      if (typeof node === 'string') return node;
      if (typeof node === 'number') return String(node);
      // For React elements, try to extract text (simplified)
      return '';
    })
    .join(' ');
}

/**
 * Determines the container ID based on props
 */
function getContainerId(
  containerId?: string,
  isClaim?: boolean,
  isScannerDetail?: boolean
): string | undefined {
  if (containerId) return containerId;
  if (isClaim) return 'claim';
  if (isScannerDetail) return 'scanner';
  return undefined;
}

/**
 * Calculates the auto-close value
 */
function getAutoCloseValue(
  autoClose: boolean | number | undefined,
  contentLength: number
): number | false {
  if (autoClose === false) return false;
  if (typeof autoClose === 'number') return autoClose;
  return calculateAutoCloseDuration('x'.repeat(contentLength));
}

/**
 * Main function to show a toast notification
 */
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

  // Early return if no content
  if (!title && !description) {
    return undefined;
  }

  // Normalize type and get icon
  const normalizedType = normalizeToastType(type);
  const ToastIcon = getToastIcon(type, Icon);
  const iconColorClass = ICON_COLOR_CLASSES[normalizedType];

  // Calculate content length for auto-close
  const textContent = extractTextContent(title, description, bottomText);
  const autoCloseValue = getAutoCloseValue(autoClose, textContent.length);

  // Determine container ID
  const finalContainerId = getContainerId(containerId, isClaim, isScannerDetail);

  // Render toast content with new design
  const toastContent = (
    <div className="toast-layout" data-size={size} data-type={normalizedType}>
      <div className="toast-icon-container">
        <div className="toast-icon-badge">
          <ToastIcon className={`toast-icon ${iconColorClass}`} aria-hidden="true" />
        </div>
      </div>
      <div className="toast-text-container">
        <Toast
          title={title}
          description={description}
          bottomText={bottomText}
          onBottomText={onBottomText}
        />
      </div>
      <div className="toast-accent-bar" data-type={normalizedType}></div>
    </div>
  );

  // Show toast
  const toastId = toast[normalizedType](toastContent, {
    autoClose: autoCloseValue,
    closeButton: isClosable,
    containerId: finalContainerId,
    onClose,
    icon: false,
  });

  // Add size class to toast element after DOM insertion
  // Using a small delay ensures the toast is in the DOM
  if (toastId && typeof toastId === 'string') {
    // Try immediate application first
    const applySizeClass = () => {
      const toastElement = document.querySelector(`[id="${toastId}"]`);
      if (toastElement) {
        toastElement.classList.add(`toast-size-${size}`);
        return true;
      }
      return false;
    };

    // Try immediately, fallback to next frame, then small timeout
    if (!applySizeClass()) {
      requestAnimationFrame(() => {
        if (!applySizeClass()) {
          setTimeout(applySizeClass, 50);
        }
      });
    }
  }

  return typeof toastId === 'string' ? toastId : undefined;
}
