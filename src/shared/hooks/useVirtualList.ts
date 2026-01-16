/**
 * Simple virtualization hook for large lists
 * For production use with 1000+ items, consider installing @tanstack/react-virtual or react-window
 * 
 * Usage:
 *   const { visibleItems, containerRef } = useVirtualList(items, { itemHeight: 200, overscan: 5 });
 */

import { useState, useEffect, useRef, useMemo } from 'react';

interface UseVirtualListOptions {
  itemHeight: number;
  overscan?: number; // Number of items to render outside visible area
  containerHeight?: number; // Auto-detect if not provided
}

export function useVirtualList<T>(
  items: T[],
  options: UseVirtualListOptions
) {
  const { itemHeight, overscan = 5, containerHeight: providedHeight } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(providedHeight || 600);

  // Update container height on resize
  useEffect(() => {
    if (providedHeight) return;

    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [providedHeight]);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate visible range
  const { startIndex, endIndex, visibleItems, totalHeight, offsetY } = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index,
    }));

    const offsetY = startIndex * itemHeight;

    return {
      startIndex,
      endIndex,
      visibleItems,
      totalHeight,
      offsetY,
    };
  }, [items, scrollTop, containerHeight, itemHeight, overscan]);

  return {
    visibleItems,
    containerRef,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
  };
}
