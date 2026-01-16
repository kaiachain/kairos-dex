
import { useTokenList } from "@/shared/hooks/useTokenList";
import { useTokenBalance } from "@/shared/hooks/useTokenBalance";
import { useAccount, useBalance } from "wagmi";
import { formatBalance, formatAddress } from "@/lib/utils";
import { Token } from "@/shared/types/token";
import { CONTRACT_WRAPPED_NATIVE_TOKEN, NATIVE_CURRENCY_SYMBOL, NATIVE_CURRENCY_DECIMALS } from "@/config/env";
import { Wallet } from "lucide-react";

interface TokenBalanceCardProps {
  token: Token;
  balance: string | null;
  isLoading: boolean;
}

function TokenBalanceCard({ token, balance, isLoading }: TokenBalanceCardProps) {
  const displayBalance = balance && parseFloat(balance) > 0 ? formatBalance(parseFloat(balance), 6) : "0";
  
  return (
    <div className="bg-white dark:bg-card rounded-lg p-4 border border-border hover:border-[color:var(--border-hover)] transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0">
            {token.symbol[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm text-text-primary truncate">
              {token.symbol}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          {isLoading ? (
            <div className="text-text-secondary text-xs">...</div>
          ) : (
            <div className="font-semibold text-sm text-text-primary">
              {displayBalance}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TokenBalances() {
  const { tokens, isLoading: isLoadingTokens } = useTokenList();
  const { address, isConnected } = useAccount();
  const { data: nativeBalance, isLoading: isLoadingNative } = useBalance({
    address,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Create native token entry
  const nativeToken: Token = {
    address: "0x0000000000000000000000000000000000000000",
    symbol: NATIVE_CURRENCY_SYMBOL,
    name: NATIVE_CURRENCY_SYMBOL,
    decimals: NATIVE_CURRENCY_DECIMALS,
  };

  if (!isConnected) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-text-secondary" />
          <h2 className="text-lg font-semibold text-text-primary">Balances</h2>
        </div>
        <div className="py-8 text-center">
          <p className="text-sm text-text-secondary">Connect wallet to see your token balances</p>
        </div>
      </div>
    );
  }

  if (isLoadingTokens) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-text-secondary" />
          <h2 className="text-lg font-semibold text-text-primary">Balances</h2>
        </div>
        <div className="py-8 text-center text-text-secondary text-sm">
          Loading token balances...
        </div>
      </div>
    );
  }

  // Filter out wrapped native token from the list since we show native token separately
  const filteredTokens = tokens.filter(
    (token) => token.address.toLowerCase() !== CONTRACT_WRAPPED_NATIVE_TOKEN?.toLowerCase()
  );

  // Combine native token with other tokens
  const allTokens = [nativeToken, ...filteredTokens];

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-text-secondary" />
        <h2 className="text-lg font-semibold text-text-primary">Balances</h2>
      </div>
      
      {allTokens.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-text-secondary">No tokens found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {allTokens.map((token) => {
            // For native token, use native balance
            if (token.address === "0x0000000000000000000000000000000000000000") {
              const nativeBalanceValue = nativeBalance
                ? nativeBalance.formatted
                : "0";
              
              // Hide native token if balance is zero (but show while loading)
              if (!isLoadingNative && (!nativeBalanceValue || parseFloat(nativeBalanceValue) === 0)) {
                return null;
              }
              
              return (
                <TokenBalanceCard
                  key={token.address}
                  token={token}
                  balance={nativeBalanceValue}
                  isLoading={isLoadingNative}
                />
              );
            }
            
            // For ERC20 tokens, use useTokenBalance hook
            return (
              <TokenBalanceItem key={token.address} token={token} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function TokenBalanceItem({ token }: { token: Token }) {
  const { data: balance, isLoading } = useTokenBalance(token);
  
  // Don't render while loading to avoid flickering
  if (isLoading) {
    return (
      <TokenBalanceCard
        token={token}
        balance={balance}
        isLoading={isLoading}
      />
    );
  }
  
  // Hide tokens with zero balance
  if (!balance || parseFloat(balance) === 0) {
    return null;
  }
  
  return (
    <TokenBalanceCard
      token={token}
      balance={balance}
      isLoading={isLoading}
    />
  );
}
