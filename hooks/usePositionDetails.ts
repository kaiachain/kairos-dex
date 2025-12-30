import { useState, useEffect } from 'react';
import { Position } from '@/types/position';

export function usePositionDetails(tokenId: string) {
  const [position, setPosition] = useState<Position | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In production, fetch position details from contract
    // For now, return null
    setIsLoading(false);
  }, [tokenId]);

  return { position, isLoading };
}

