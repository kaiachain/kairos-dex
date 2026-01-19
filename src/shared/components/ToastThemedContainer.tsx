
import { useEffect, useState, useMemo } from 'react';
import { ToastContainer, cssTransition } from 'react-toastify';
import { X } from 'lucide-react';
import { useResponsive } from '@/shared/hooks/useResponsive';

interface ToastThemedContainerProps {
  containerId?: string;
}

// Custom close button component
function CustomCloseButton({ closeToast }: { closeToast: () => void }) {
  return (
    <button
      onClick={closeToast}
      className="toast-close-button"
      aria-label="Close notification"
      type="button"
    >
      <X className="toast-close-icon" aria-hidden="true" />
    </button>
  );
}

// Custom transition for smoother animations
// Enable collapse with smooth duration to allow other toasts to move up smoothly
const toastTransition = cssTransition({
  enter: 'toast-enter',
  exit: 'toast-exit',
  appendPosition: false,
  collapse: true, // Enable collapse so other toasts smoothly move up
});

// Container position configuration
interface ContainerPosition {
  position: 'top-center' | 'bottom-center';
  top?: string;
  bottom?: string;
}

function getContainerPosition(
  containerId: string | undefined,
  isMobile: boolean,
  isTablet: boolean
): ContainerPosition {
  const defaultPosition: ContainerPosition = {
    position: 'top-center',
    top: '12px',
  };

  if (!containerId) {
    return isMobile
      ? { position: 'bottom-center', bottom: '12px' }
      : defaultPosition;
  }

  switch (containerId) {
    case 'scanner':
      return isMobile
        ? { position: 'top-center', top: '96px' }
        : defaultPosition;

    case 'claim':
      return {
        position: 'bottom-center',
        bottom: isMobile ? '152px' : isTablet ? '160px' : '122px',
      };

    default:
      return isMobile
        ? { position: 'bottom-center', bottom: '12px' }
        : defaultPosition;
  }
}

// Get toast type class name
function getToastTypeClass(type?: string): string {
  const baseClass = 'toast-base';
  if (!type) return baseClass;

  const typeMap: Record<string, string> = {
    success: 'toast-success',
    error: 'toast-error',
    warning: 'toast-warning',
    info: 'toast-info',
  };

  const typeClass = typeMap[type];
  return typeClass ? `${baseClass} ${typeClass}` : baseClass;
}

export function ToastThemedContainer({ containerId }: ToastThemedContainerProps) {
  const [mounted, setMounted] = useState(false);
  const { isMobile, isTablet } = useResponsive();

  useEffect(() => {
    setMounted(true);
  }, []);

  const positionConfig = useMemo(
    () => getContainerPosition(containerId, isMobile, isTablet),
    [containerId, isMobile, isTablet]
  );

  if (!mounted) return null;

  return (
    <div
      className="toast-container-wrapper"
      style={{
        top: positionConfig.top,
        bottom: positionConfig.bottom,
      }}
    >
      <div className="toast-container-inner">
        <ToastContainer
          autoClose={false}
          closeButton={CustomCloseButton}
          draggable={false}
          hideProgressBar
          icon={false}
          limit={3}
          position={positionConfig.position}
          theme="light"
          transition={toastTransition}
          containerId={containerId}
          className="toast-container"
          toastClassName={(context) => getToastTypeClass(context?.type)}
        />
      </div>
    </div>
  );
}
