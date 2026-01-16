
import { useState, useEffect } from 'react';
import { usePositionDetails } from '@/hooks/usePositionDetails';
import { formatCurrency, formatNumber, formatBalance } from '@/lib/utils';
import { useWriteContract, useAccount, useReadContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { PositionManager_ABI } from '@/abis/PositionManager';
import { Plus, Minus, Coins, ExternalLink, Calendar, Zap, Trash2, Info, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { parseUnits, formatUnits } from 'viem';
import { BLOCK_EXPLORER_URL } from '@/config/env';

interface PositionDetailsProps {
  tokenId: string;
}

const FULL_RANGE_THRESHOLD = 1e40;
// Maximum uint128 value for collecting all fees
const MAX_UINT128 = BigInt(2 ** 128 - 1);

export function PositionDetails({ tokenId }: PositionDetailsProps) {
  const navigate = useNavigate();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { position, isLoading, refetch: refetchPosition } = usePositionDetails(tokenId);
  const [removeAmount, setRemoveAmount] = useState('');
  const [resolvedNftTokenId, setResolvedNftTokenId] = useState<bigint | null>(null);
  const [isResolvingTokenId, setIsResolvingTokenId] = useState(false);
  
  // Parse tokenId - handle both numeric string and position key format
  // Position key format: owner-pool-tickLower-tickUpper
  // For collect, we need the actual NFT tokenId (uint256)
  const numericTokenId = tokenId.includes('-') 
    ? null // If it's a position key, we'll try to resolve it
    : BigInt(tokenId);

  // Try to resolve NFT tokenId from position key format
  useEffect(() => {
    const resolveNftTokenId = async () => {
      if (numericTokenId !== null || !address || !position || !publicClient) {
        return;
      }

      // If we already resolved it, don't resolve again
      if (resolvedNftTokenId !== null) {
        return;
      }

      setIsResolvingTokenId(true);
      try {
        // Parse position key: owner-pool-tickLower-tickUpper
        const parts = tokenId.split('-');
        if (parts.length < 4) {
          setIsResolvingTokenId(false);
          return;
        }

        const poolAddress = parts[1]?.toLowerCase();
        const tickLower = parseInt(parts[2] || parts[3] || '0', 10);
        const tickUpper = parseInt(parts[parts.length - 1] || '0', 10);

        // Get user's NFT balance
        const balance = await publicClient.readContract({
          address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
          abi: PositionManager_ABI,
          functionName: 'balanceOf',
          args: [address],
        });

        if (balance === 0n) {
          setIsResolvingTokenId(false);
          return;
        }

        // Try to find matching NFT tokenId by checking each NFT
        for (let i = 0; i < Number(balance); i++) {
          try {
            const nftTokenId = await publicClient.readContract({
              address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
              abi: PositionManager_ABI,
              functionName: 'tokenOfOwnerByIndex',
              args: [address, BigInt(i)],
            });

            // Read position data for this NFT
            const posData = await publicClient.readContract({
              address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
              abi: PositionManager_ABI,
              functionName: 'positions',
              args: [nftTokenId],
            });

            // Check if this position matches: pool, tickLower, tickUpper
            const posPool = (posData[2] as string).toLowerCase(); // token0 address (we'll check pool differently)
            const posTickLower = Number(posData[5]); // tickLower
            const posTickUpper = Number(posData[6]); // tickUpper

            // Match by ticks (pool matching is complex, so we rely on ticks + owner)
            if (posTickLower === tickLower && posTickUpper === tickUpper) {
              setResolvedNftTokenId(nftTokenId);
              setIsResolvingTokenId(false);
              return;
            }
          } catch (err) {
            // Continue to next NFT if this one fails
            continue;
          }
        }
      } catch (error) {
        console.error('Error resolving NFT tokenId:', error);
      } finally {
        setIsResolvingTokenId(false);
      }
    };

    resolveNftTokenId();
  }, [tokenId, address, position, numericTokenId, resolvedNftTokenId, publicClient]);

  // Use resolved NFT tokenId if available, otherwise use numericTokenId
  const effectiveTokenId = numericTokenId !== null ? numericTokenId : resolvedNftTokenId;

  // Read uncollected fees directly from PositionManager contract
  const { data: positionData, refetch: refetchPositionData } = useReadContract({
    address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
    abi: PositionManager_ABI,
    functionName: 'positions',
    args: effectiveTokenId !== null ? [effectiveTokenId] : undefined,
    query: {
      enabled: effectiveTokenId !== null && !!position,
    },
  });

  // Extract tokensOwed from contract data
  // PositionManager.positions() returns:
  // [0] nonce, [1] operator, [2] token0, [3] token1, [4] fee, [5] tickLower, 
  // [6] tickUpper, [7] liquidity, [8] feeGrowthInside0LastX128, [9] feeGrowthInside1LastX128,
  // [10] tokensOwed0, [11] tokensOwed1
  const tokensOwed0 = positionData?.[10] as bigint | undefined; // tokensOwed0 is at index 10
  const tokensOwed1 = positionData?.[11] as bigint | undefined; // tokensOwed1 is at index 11

  // Calculate uncollected fees in human-readable format
  const uncollectedFees0 = tokensOwed0 
    ? parseFloat(formatUnits(tokensOwed0, position?.token0.decimals || 18))
    : 0;
  const uncollectedFees1 = tokensOwed1
    ? parseFloat(formatUnits(tokensOwed1, position?.token1.decimals || 18))
    : 0;
  
  // Calculate USD value of uncollected fees
  const uncollectedFeesUSD = position
    ? uncollectedFees0 * position.currentPrice + uncollectedFees1
    : 0;

  // Determine if there are fees available to collect
  // Fees are available if either tokensOwed0 > 0 OR tokensOwed1 > 0
  // We check the raw BigInt values to avoid precision issues with small amounts
  const hasFeesToCollect = tokensOwed0 !== undefined && tokensOwed1 !== undefined
    ? (tokensOwed0 > 0n || tokensOwed1 > 0n)
    : false;

  // Use contract data if available, otherwise fall back to position data
  const displayUncollectedFees = uncollectedFeesUSD > 0 
    ? uncollectedFeesUSD 
    : (position?.uncollectedFees || 0);

  // Collect fees transaction
  const { 
    writeContract: collectFees, 
    data: collectHash, 
    error: collectError,
    isPending: isCollectPending 
  } = useWriteContract();

  const { 
    isLoading: isConfirming, 
    isSuccess: isCollectSuccess,
    isError: isCollectTxError 
  } = useWaitForTransactionReceipt({
    hash: collectHash,
  });

  // Extract pool address from tokenId (format: owner-pool-tickLower-tickUpper)
  const poolAddress = tokenId.split('-').length >= 2 ? tokenId.split('-')[1] : null;

  const handleCollectFees = () => {
    if (!position || !address) return;
    
    // Validate tokenId format
    if (effectiveTokenId === null) {
      console.error('Invalid tokenId format for collect. Expected numeric tokenId.');
      return;
    }

    try {
      collectFees({
        address: CONTRACTS.NonfungiblePositionManager as `0x${string}`,
        abi: PositionManager_ABI,
        functionName: 'collect',
        args: [
          {
            tokenId: effectiveTokenId,
            recipient: address,
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128,
          },
        ],
      });
    } catch (error) {
      console.error('Error calling collect:', error);
    }
  };

  // Refetch position data after successful collect
  useEffect(() => {
    if (isCollectSuccess) {
      refetchPositionData();
      refetchPosition?.();
    }
  }, [isCollectSuccess, refetchPositionData, refetchPosition]);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-text-secondary">
        Loading position details...
      </div>
    );
  }

  if (!position) {
    return (
      <div className="py-12 text-center text-text-secondary">
        Position not found
      </div>
    );
  }

  // Check if position is full range (covers all prices)
  const isFullRange = position.priceMin === 0 && position.priceMax >= FULL_RANGE_THRESHOLD;
  
  // Determine if position is in range
  // For full range positions, always consider them in range
  // For regular positions, use price-based comparison as primary (more intuitive for users)
  // Tick-based comparison is used as secondary validation
  let isInRange: boolean;
  if (isFullRange) {
    isInRange = true;
  } else {
    // Primary check: price-based comparison (what users see and understand)
    const priceInRange =
      position.currentPrice >= position.priceMin &&
      position.currentPrice <= position.priceMax;
    
    // Secondary check: tick-based comparison (more accurate for Uniswap V3 mechanics)
    let tickInRange: boolean | null = null;
    if (
      position.tickLower !== undefined &&
      position.tickUpper !== undefined &&
      position.currentTick !== undefined
    ) {
      tickInRange =
        position.currentTick >= position.tickLower &&
        position.currentTick <= position.tickUpper;
      
      // Log warning if there's a mismatch (indicates potential data/calculation issue)
      if (tickInRange !== priceInRange) {
        console.warn('Tick and price range mismatch:', {
          tickInRange,
          priceInRange,
          currentPrice: position.currentPrice,
          priceMin: position.priceMin,
          priceMax: position.priceMax,
          currentTick: position.currentTick,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
        });
      }
    }
    
    // Use price-based result as primary (what's displayed to users)
    // This ensures the UI matches what users see in the price range visualization
    isInRange = priceInRange;
  }

  // Get all events sorted by timestamp (newest first)
  const allEvents = [
    ...(position.mints || []).map((mint) => ({
      type: 'mint' as const,
      data: mint,
      timestamp: parseInt(mint.timestamp, 10),
    })),
    ...(position.burns || []).map((burn) => ({
      type: 'burn' as const,
      data: burn,
      timestamp: parseInt(burn.timestamp, 10),
    })),
    ...(position.collects || []).map((collect) => ({
      type: 'collect' as const,
      data: collect,
      timestamp: parseInt(collect.timestamp, 10),
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/positions')}
        className="mb-4 text-primary hover:opacity-80 hover:underline"
      >
        ← Back to Positions
      </button>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-text-primary">
            {position.token0.symbol} / {position.token1.symbol}
          </h1>
          <div className="flex gap-3 items-center">
            <div
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                isInRange
                  ? 'bg-success/20 text-success'
                  : 'bg-secondary/20 text-secondary'
              }`}
            >
              {isInRange ? 'In Range' : 'Out of Range'}
            </div>
            <span className="text-sm text-text-secondary">
              {position.feeTier}% fee tier
            </span>
          </div>
        </div>
        {poolAddress && (
          <Link
            to={`/pools/${poolAddress}`}
            className="flex items-center gap-2 px-4 py-2 border-2 border-border text-text-primary rounded-lg hover:bg-gray-50 dark:hover:bg-input-bg hover:border-[color:var(--border-hover)] transition-all font-medium"
          >
            <span>View Pool</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="p-6 bg-white rounded-xl border dark:bg-card border-border">
          <div className="mb-1 text-sm text-text-secondary">Position Value</div>
          <div className="text-2xl font-bold text-text-primary">
            {formatCurrency(position.value)}
          </div>
          {position.token0Amount !== undefined &&
            position.token1Amount !== undefined && (
              <div className="mt-2 text-xs text-text-secondary">
                {formatBalance(position.token0Amount, 4)} {position.token0.symbol} +{' '}
                {formatBalance(position.token1Amount, 4)} {position.token1.symbol}
              </div>
            )}
        </div>

        <div className="p-6 bg-white rounded-xl border dark:bg-card border-border">
          <div className="mb-1 text-sm text-text-secondary">Uncollected Fees</div>
          <div className={`text-2xl font-bold ${hasFeesToCollect ? 'text-success' : 'text-text-secondary'}`}>
            {hasFeesToCollect 
              ? formatCurrency(displayUncollectedFees)
              : displayUncollectedFees > 0 
                ? formatCurrency(displayUncollectedFees)
                : '$0.00'}
          </div>
          {hasFeesToCollect && tokensOwed0 !== undefined && tokensOwed1 !== undefined && (
            <div className="mt-2 text-xs text-text-secondary">
              {uncollectedFees0 > 0 && (
                <span>{formatBalance(uncollectedFees0.toString(), 4)} {position.token0.symbol}</span>
              )}
              {uncollectedFees0 > 0 && uncollectedFees1 > 0 && <span> + </span>}
              {uncollectedFees1 > 0 && (
                <span>{formatBalance(uncollectedFees1.toString(), 4)} {position.token1.symbol}</span>
              )}
            </div>
          )}
          {!hasFeesToCollect && tokensOwed0 !== undefined && tokensOwed1 !== undefined && (
            <div className="mt-2 text-xs text-text-secondary">
              No fees available to collect
            </div>
          )}
          {position.feesEarned > 0 && (
            <div className="mt-2 text-xs text-text-secondary">
              Total earned: {formatCurrency(position.feesEarned)}
            </div>
          )}
        </div>

        <div className="p-6 bg-white rounded-xl border dark:bg-card border-border">
          <div className="mb-1 text-sm text-text-secondary">Current Price</div>
          <div className="text-2xl font-bold text-text-primary">
            {formatNumber(position.currentPrice, 6)}
          </div>
          <div className="mt-2 text-xs text-text-secondary">
            {position.token1.symbol} per {position.token0.symbol}
          </div>
        </div>
      </div>

      {/* Price Range */}
      <div className="p-6 bg-white rounded-xl border dark:bg-card border-border">
        <h2 className="mb-4 text-xl font-bold text-text-primary">Price Range</h2>
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <div className="mb-1 text-text-secondary">Min Price</div>
            <div className="font-semibold text-text-primary">
              {position.priceMin === 0 ? (
                <span className="text-text-secondary">0 (Full Range)</span>
              ) : (
                `${formatNumber(position.priceMin, 6)} ${position.token1.symbol}`
              )}
            </div>
          </div>
          <div>
            <div className="mb-1 text-text-secondary">Max Price</div>
            <div className="font-semibold text-text-primary">
              {position.priceMax >= FULL_RANGE_THRESHOLD ? (
                <span className="text-text-secondary">∞ (Full Range)</span>
              ) : (
                `${formatNumber(position.priceMax, 6)} ${position.token1.symbol}`
              )}
            </div>
          </div>
        </div>
        {isFullRange ? (
          <div className="p-3 mt-4 rounded-lg border bg-primary/10 border-primary/20">
            <p className="text-sm text-text-primary">
              This is a full-range position covering all possible prices (like Uniswap V2)
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {/* Progress Bar Container */}
            <div className="overflow-hidden relative w-full h-4 bg-gray-200 rounded-full dark:bg-bg">
              {(() => {
                // Calculate a reasonable scale for visualization
                const priceRange = position.priceMax - position.priceMin;
                
                // Determine how much to extend the range based on current price position
                // If current price is outside range, extend more to show it
                const currentBelowMin = position.currentPrice < position.priceMin;
                const currentAboveMax = position.currentPrice > position.priceMax;
                
                // Extend range to include current price with context
                let extendedMin = Math.max(0, position.priceMin - priceRange * 0.2);
                let extendedMax = position.priceMax + priceRange * 0.2;
                
                // If current price is outside range, extend further to show it
                if (currentBelowMin) {
                  extendedMin = Math.max(0, position.currentPrice - priceRange * 0.1);
                }
                if (currentAboveMax) {
                  extendedMax = position.currentPrice + priceRange * 0.1;
                }
                
                const extendedRange = extendedMax - extendedMin;
                
                // Calculate positions as percentages
                const minPercent = ((position.priceMin - extendedMin) / extendedRange) * 100;
                const maxPercent = ((position.priceMax - extendedMin) / extendedRange) * 100;
                const currentPercent = ((position.currentPrice - extendedMin) / extendedRange) * 100;
                
                // Clamp values to 0-100
                const clampedMin = Math.max(0, Math.min(100, minPercent));
                const clampedMax = Math.max(0, Math.min(100, maxPercent));
                const clampedCurrent = Math.max(0, Math.min(100, currentPercent));
                const rangeWidth = clampedMax - clampedMin;
                
                return (
                  <>
                    {/* Position range bar (colored section from min to max) */}
                    <div
                      className={`absolute h-4 rounded-full transition-colors ${
                        isInRange ? 'bg-success' : 'bg-secondary'
                      }`}
                      style={{
                        left: `${clampedMin}%`,
                        width: `${rangeWidth}%`,
                      }}
                    />
                    {/* Current price marker - make it more visible */}
                    <div
                      className={`absolute top-0 h-4 w-1.5 rounded-full z-10 shadow-lg ${
                        isInRange ? 'bg-primary' : 'bg-error'
                      }`}
                      style={{
                        left: `${clampedCurrent}%`,
                        transform: 'translateX(-50%)',
                      }}
                    />
                    {/* Current price indicator dot */}
                    <div
                      className={`absolute top-1/2 h-2 w-2 rounded-full z-20 border-2 border-white dark:border-card ${
                        isInRange ? 'bg-primary' : 'bg-error'
                      }`}
                      style={{
                        left: `${clampedCurrent}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </>
                );
              })()}
            </div>
            {/* Price labels below the bar */}
            <div className="flex justify-between px-1 text-xs text-text-secondary">
              <span>{formatNumber(position.priceMin, 4)}</span>
              <span className={`font-semibold ${isInRange ? 'text-text-primary' : 'text-error'}`}>
                Current: {formatNumber(position.currentPrice, 4)}
                {!isInRange && (
                  <span className="ml-1">
                    {position.currentPrice < position.priceMin ? '(Below)' : '(Above)'}
                  </span>
                )}
              </span>
              <span>{formatNumber(position.priceMax, 4)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Event History */}
      {allEvents.length > 0 && (
        <div className="p-6 bg-white rounded-xl border dark:bg-card border-border">
          <h2 className="mb-4 text-xl font-bold text-text-primary">Event History</h2>
          <div className="space-y-3">
            {allEvents.map((event, index) => {
              const isMint = event.type === 'mint';
              const isBurn = event.type === 'burn';
              const isCollect = event.type === 'collect';
              const eventData = event.data;

              return (
                <div
                  key={`${event.type}-${eventData.id}-${index}`}
                  className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg border dark:bg-input-bg border-border"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isMint
                        ? 'bg-success/20 text-success'
                        : isBurn
                        ? 'bg-error/20 text-error'
                        : 'bg-primary/20 text-primary'
                    }`}
                  >
                    {isMint ? (
                      <Plus className="w-5 h-5" />
                    ) : isBurn ? (
                      <Minus className="w-5 h-5" />
                    ) : (
                      <Coins className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold capitalize text-text-primary">{event.type}</span>
                      <span className="flex gap-1 items-center text-xs text-text-secondary">
                        <Calendar className="w-3 h-3" />
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-text-secondary">
                      {isMint && (
                        <>
                          <div>
                            Added: {formatBalance(eventData.amount0 || '0', 4)}{' '}
                            {position.token0.symbol} +{' '}
                            {formatBalance(eventData.amount1 || '0', 4)}{' '}
                            {position.token1.symbol}
                          </div>
                          {eventData.amountUSD &&
                            parseFloat(eventData.amountUSD) > 0 && (
                              <div className="text-xs">
                                Value: {formatCurrency(parseFloat(eventData.amountUSD))}
                              </div>
                            )}
                        </>
                      )}
                      {isBurn && (
                        <>
                          <div>
                            Removed: {formatBalance(eventData.amount0 || '0', 4)}{' '}
                            {position.token0.symbol} +{' '}
                            {formatBalance(eventData.amount1 || '0', 4)}{' '}
                            {position.token1.symbol}
                          </div>
                          {eventData.amountUSD &&
                            parseFloat(eventData.amountUSD) > 0 && (
                              <div className="text-xs">
                                Value: {formatCurrency(parseFloat(eventData.amountUSD))}
                              </div>
                            )}
                        </>
                      )}
                      {isCollect && (
                        <>
                          <div>
                            Collected: {formatBalance(eventData.amount0 || '0', 4)}{' '}
                            {position.token0.symbol} +{' '}
                            {formatBalance(eventData.amount1 || '0', 4)}{' '}
                            {position.token1.symbol}
                          </div>
                          {eventData.amountUSD &&
                            parseFloat(eventData.amountUSD) > 0 && (
                              <div className="text-xs">
                                Value: {formatCurrency(parseFloat(eventData.amountUSD))}
                              </div>
                            )}
                        </>
                      )}
                      <div className="mt-1 text-xs">
                        <a
                          href={`${BLOCK_EXPLORER_URL}/tx/${eventData.transaction.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex gap-1 items-center text-primary hover:opacity-80 hover:underline"
                        >
                          View Transaction <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-text-primary">Actions</h2>
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Collect Fees Card */}
          <div className="p-6 bg-white rounded-xl border shadow-sm dark:bg-card border-border">
            <div className="flex gap-3 items-center mb-4">
              <div className="flex justify-center items-center w-10 h-10 rounded-full bg-primary/20">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Collect Fees</h3>
                <p className="text-xs text-text-secondary">
                  {hasFeesToCollect 
                    ? `${formatCurrency(displayUncollectedFees)} available to collect`
                    : 'No fees available'}
                </p>
              </div>
            </div>

            <button
              onClick={handleCollectFees}
              disabled={
                !hasFeesToCollect || 
                isCollectPending || 
                isConfirming ||
                effectiveTokenId === null ||
                isResolvingTokenId
              }
              className="flex gap-2 justify-center items-center py-4 w-full font-semibold rounded-xl shadow-md transition-all bg-primary text-bg hover:opacity-90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isResolvingTokenId ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resolving position...
                </>
              ) : isCollectPending || isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : hasFeesToCollect ? (
                <>
                  <Zap className="w-5 h-5" />
                  Collect Fees
                </>
              ) : (
                <>
                  <Coins className="w-5 h-5" />
                  No Fees to Collect
                </>
              )}
            </button>
            
            {/* Transaction Status Messages */}
            {collectError && (
              <div className="flex gap-3 items-start p-4 mt-4 rounded-lg border bg-error/10 border-error/30">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="mb-1 text-sm font-semibold text-error">
                    Transaction Failed
                  </p>
                  <p className="text-xs text-error">
                    {collectError.message || 'Unknown error occurred'}
                  </p>
                </div>
              </div>
            )}
            
            {isCollectTxError && (
              <div className="flex gap-3 items-start p-4 mt-4 rounded-lg border bg-error/10 border-error/30">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="mb-1 text-sm font-semibold text-error">
                    Transaction Reverted
                  </p>
                  <p className="text-xs text-error">
                    The transaction was reverted. Please try again.
                  </p>
                </div>
              </div>
            )}
            
            {isCollectSuccess && (
              <div className="flex gap-3 items-start p-4 mt-4 rounded-lg border bg-success/10 border-success/30">
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="mb-1 text-sm font-semibold text-success">
                    Fees Collected Successfully!
                  </p>
                  {collectHash && (
                    <a
                      href={`${BLOCK_EXPLORER_URL}/tx/${collectHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-1 items-center mt-1 text-xs text-success hover:opacity-80 hover:underline"
                    >
                      View Transaction <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Info Note */}
            <div className="flex gap-3 items-start p-4 mt-4 rounded-lg border bg-primary/5 border-primary/20">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-text-secondary">
                <strong className="text-text-primary">How fees work:</strong> Fees accumulate automatically when swaps occur within your position's price range. 
                {hasFeesToCollect 
                  ? ' You have uncollected fees available to collect.'
                  : ' No fees are currently available. Fees will appear here once swaps happen in your position\'s range.'}
              </p>
            </div>
            
            {numericTokenId === null && isResolvingTokenId && (
              <div className="flex gap-3 items-start p-4 mt-4 rounded-lg border bg-primary/10 border-primary/20">
                <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary">
                  <strong className="text-text-primary">Resolving position...</strong> Finding the NFT tokenId for this position.
                </p>
              </div>
            )}

            {numericTokenId === null && !isResolvingTokenId && effectiveTokenId === null && (
              <div className="flex gap-3 items-start p-4 mt-4 rounded-lg border bg-secondary/10 border-secondary/30">
                <AlertCircle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-secondary">
                  <strong>Warning:</strong> Could not find the NFT tokenId for this position. 
                  Collect fees may not be available. Please ensure you own this position.
                </p>
              </div>
            )}
          </div>

          {/* Remove Liquidity Card */}
          <div className="p-6 bg-white rounded-xl border shadow-sm dark:bg-card border-border">
            <div className="flex gap-3 items-center mb-4">
              <div className="flex justify-center items-center w-10 h-10 rounded-full bg-error/20">
                <Trash2 className="w-5 h-5 text-error" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Remove Liquidity</h3>
                <p className="text-xs text-text-secondary">
                  Withdraw tokens from this position
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block mb-2 text-sm font-medium text-text-primary">
                  Amount to Remove (%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={removeAmount}
                    onChange={(e) => setRemoveAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="100"
                    className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border transition-all outline-none dark:bg-input-bg border-border focus:border-error focus:ring-2 focus:ring-error/20 text-text-primary"
                  />
                  <button
                    onClick={() => setRemoveAmount('100')}
                    className="px-6 py-3 font-medium bg-gray-100 rounded-xl border transition-colors dark:bg-bg hover:bg-gray-200 dark:hover:bg-card text-text-primary border-border"
                  >
                    Max
                  </button>
                </div>
              </div>
              
              <button
                onClick={() => {
                  if (!position || !address || !removeAmount) return;
                  const percentage = parseFloat(removeAmount);
                  if (percentage <= 0 || percentage > 100) return;
                  // TODO: Implement remove liquidity functionality
                  console.log('Remove liquidity:', percentage);
                }}
                disabled={!removeAmount || parseFloat(removeAmount) <= 0}
                className="flex gap-2 justify-center items-center py-4 w-full font-semibold rounded-xl shadow-md transition-all bg-error text-bg hover:opacity-90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Trash2 className="w-5 h-5" />
                Remove Liquidity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

