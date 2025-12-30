"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatAddress } from "@/lib/utils";
import { ExternalLink, CheckCircle, XCircle, Clock } from "lucide-react";
import { BLOCK_EXPLORER_URL } from "@/config/env";

interface Transaction {
  hash: string;
  type: "swap" | "addLiquidity" | "removeLiquidity" | "collectFees";
  status: "pending" | "success" | "failed";
  timestamp: number;
  token0?: string;
  token1?: string;
  amount?: string;
}

export function TransactionHistory() {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    // Load transactions from localStorage
    const saved = localStorage.getItem(`transactions_${address}`);
    if (saved) {
      try {
        setTransactions(JSON.parse(saved));
      } catch (error) {
        console.error("Error loading transactions:", error);
      }
    }
  }, [address]);

  const explorerUrl = (hash: string) => `${BLOCK_EXPLORER_URL}/tx/${hash}`;

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">No transactions yet</div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.hash}
          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
        >
          <div className="flex items-center space-x-3">
            {tx.status === "success" && (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
            {tx.status === "failed" && (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            {tx.status === "pending" && (
              <Clock className="w-5 h-5 text-yellow-600 animate-spin" />
            )}
            <div>
              <div className="font-medium capitalize">{tx.type}</div>
              <div className="text-sm text-gray-500 font-mono">
                {formatAddress(tx.hash)}
              </div>
            </div>
          </div>
          <a
            href={explorerUrl(tx.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      ))}
    </div>
  );
}
