'use client';

import { useProtocolStats } from '@/hooks/useProtocolStats';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';

export function AnalyticsDashboard() {
  const { stats, isLoading } = useProtocolStats();

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total TVL"
          value={formatCurrency(stats.totalTVL)}
          icon={DollarSign}
          change={stats.tvlChange24h}
        />
        <StatCard
          title="24h Volume"
          value={formatCurrency(stats.volume24h)}
          icon={TrendingUp}
          change={stats.volumeChange24h}
        />
        <StatCard
          title="Total Pools"
          value={stats.totalPools.toString()}
          icon={BarChart3}
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers.toString()}
          icon={Users}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4">Protocol Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">7d Volume</div>
            <div className="font-semibold">{formatCurrency(stats.volume7d)}</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">30d Volume</div>
            <div className="font-semibold">{formatCurrency(stats.volume30d)}</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">Total Positions</div>
            <div className="font-semibold">{stats.totalPositions}</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">Total Fees</div>
            <div className="font-semibold">{formatCurrency(stats.totalFees)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  change,
}: {
  title: string;
  value: string;
  icon: any;
  change?: number;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
          <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        {change !== undefined && (
          <span
            className={`text-sm font-medium ${
              change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {change >= 0 ? '+' : ''}
            {formatNumber(change, 2)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{title}</div>
    </div>
  );
}

