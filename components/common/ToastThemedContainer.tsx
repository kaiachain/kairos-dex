'use client';

import { useEffect, useState } from 'react';
import { ToastContainer, cssTransition } from 'react-toastify';
import { X } from 'lucide-react';

interface ToastThemedContainerProps {
  containerId?: string;
}

// Custom close button component - aligned with codebase design
function CustomCloseButton({ closeToast }: { closeToast: () => void }) {
  return (
    <button
      onClick={closeToast}
      className="ml-4 cursor-pointer flex-shrink-0 p-1 hover:opacity-70 transition-opacity"
      aria-label="Close"
    >
      <X className="w-4 h-4 text-text-secondary" />
    </button>
  );
}

// Custom transition
const customTransition = cssTransition({
  enter: 'Toastify--animate Toastify--animate--enter',
  exit: 'Toastify--animate Toastify--animate--exit',
});

// Hook for responsive behavior
function useResponsive() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };

    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  return { isMobile, isTablet };
}

export function ToastThemedContainer({ containerId }: ToastThemedContainerProps) {
  const [mounted, setMounted] = useState(false);
  const { isMobile, isTablet } = useResponsive();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Determine positioning based on container ID
  let position: 'top-center' | 'bottom-center' = 'top-center';
  let top = '12px';
  let bottom = 'auto';

  if (containerId === 'scanner') {
    if (isMobile) {
      top = '96px';
      position = 'top-center';
    }
  } else if (containerId === 'claim') {
    position = 'bottom-center';
    if (isMobile) {
      bottom = '152px';
    } else if (isTablet) {
      bottom = '160px';
    } else {
      bottom = '122px';
    }
  } else if (isMobile) {
    position = 'bottom-center';
    bottom = '12px';
  }

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        top: position === 'top-center' ? top : 'auto',
        bottom: position === 'bottom-center' ? bottom : 'auto',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '100vw',
        padding: '0 20px',
      }}
    >
      <div className="pointer-events-auto">
        <ToastContainer
          autoClose={false}
          closeButton={CustomCloseButton}
          draggable={false}
          hideProgressBar={true}
          icon={false}
          limit={3}
          position={position}
          theme="light"
          transition={customTransition}
          containerId={containerId}
          className="!w-full"
          toastClassName={(context) => {
            const baseClasses = '!rounded-2xl !border !p-4 !mb-3 !shadow-lg !min-w-0';
            // Add type-specific classes
            if (context?.type === 'success') {
              return `${baseClasses} toast-success`;
            } else if (context?.type === 'error') {
              return `${baseClasses} toast-error`;
            } else if (context?.type === 'warning') {
              return `${baseClasses} toast-warning`;
            } else if (context?.type === 'info') {
              return `${baseClasses} toast-info`;
            }
            return baseClasses;
          }}
          bodyClassName={() => '!p-0 !flex !items-start'}
          style={{
            width: '100%',
          }}
        />
      </div>
    </div>
  );
}
