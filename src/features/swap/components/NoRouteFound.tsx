/**
 * No Route Found Component
 * Displays diagnostic information when a swap route cannot be found
 */

import { AlertCircle, Info, X } from 'lucide-react';
import { Token } from '@/shared/types/token';
import { RouteDiagnostic } from '../services/routeDiagnostics';
import { useState } from 'react';

interface NoRouteFoundProps {
  tokenIn: Token;
  tokenOut: Token;
  diagnostic?: RouteDiagnostic | null;
  onRetry?: () => void;
}

export function NoRouteFound({ tokenIn, tokenOut, diagnostic, onRetry }: NoRouteFoundProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!diagnostic) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 bg-warning/20 rounded-xl border border-warning/40">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-text-primary mb-1">No Route Found</h3>
            <p className="text-sm text-text-secondary">
              Unable to find a trading route between {tokenIn.symbol} and {tokenOut.symbol}.
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full py-3 bg-primary text-bg rounded-xl font-semibold hover:opacity-90 transition-all"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Error Card */}
      <div className="flex items-start gap-3 p-4 bg-error/20 rounded-xl border border-error/40">
        <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-text-primary mb-1">No Route Found</h3>
          <p className="text-sm text-text-secondary mb-2">{diagnostic.reason}</p>
          
          {/* Quick Stats */}
          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-text-secondary">Direct Pool:</span>
              <span className={diagnostic.hasDirectPool ? 'text-success font-semibold' : 'text-error font-semibold'}>
                {diagnostic.hasDirectPool ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-secondary">{tokenIn.symbol} Pools:</span>
              <span className="font-semibold text-text-primary">{diagnostic.poolsWithTokenIn}</span>
              {diagnostic.poolsWithTokenInNoLiquidity > 0 && (
                <span className="text-warning" title={`${diagnostic.poolsWithTokenInNoLiquidity} pool(s) exist but have no liquidity`}>
                  {' '}(+{diagnostic.poolsWithTokenInNoLiquidity} no liquidity)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-secondary">{tokenOut.symbol} Pools:</span>
              <span className="font-semibold text-text-primary">{diagnostic.poolsWithTokenOut}</span>
              {diagnostic.poolsWithTokenOutNoLiquidity > 0 && (
                <span className="text-warning" title={`${diagnostic.poolsWithTokenOutNoLiquidity} pool(s) exist but have no liquidity`}>
                  {' '}(+{diagnostic.poolsWithTokenOutNoLiquidity} no liquidity)
                </span>
              )}
            </div>
            {diagnostic.intermediateTokens.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-text-secondary">Possible Paths:</span>
                <span className="font-semibold text-text-primary">{diagnostic.intermediateTokens.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-text-secondary" />
            <span className="text-sm font-medium text-text-primary">View Details</span>
          </div>
          <X
            className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-45' : ''}`}
          />
        </button>

        {isExpanded && (
          <div className="p-4 space-y-4 bg-secondary/30 border-t border-border">
            {/* Intermediate Tokens */}
            {diagnostic.intermediateTokens.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-2">
                  Possible Intermediate Tokens ({diagnostic.intermediateTokens.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {diagnostic.intermediateTokens.slice(0, 10).map((token, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-primary/20 text-primary rounded-md text-xs font-medium"
                    >
                      {token}
                    </span>
                  ))}
                  {diagnostic.intermediateTokens.length > 10 && (
                    <span className="px-2 py-1 text-text-secondary text-xs">
                      +{diagnostic.intermediateTokens.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Possible Paths */}
            {diagnostic.possiblePaths.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-2">
                  Example Paths
                </h4>
                <div className="space-y-2">
                  {diagnostic.possiblePaths.slice(0, 3).map((path, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span className="font-medium">{path.join(' → ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {diagnostic.suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-2">
                  Suggestions
                </h4>
                <ul className="space-y-1.5">
                  {diagnostic.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="text-primary mt-1">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Button */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full py-3 bg-primary text-bg rounded-xl font-semibold hover:opacity-90 transition-all"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
