'use client';

import { useProtocolStats } from '@/hooks/useProtocolStats';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';

export function AnalyticsDashboard() {
  const { stats, isLoading } = useProtocolStats();

  if (isLoading) {
    return <div className="text-center py-12 text-text-secondary">Loading analytics...</div>;
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

      <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
        <h2 className="text-xl font-bold mb-4 text-text-primary">Protocol Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-text-secondary mb-1">7d Volume</div>
            <div className="font-semibold text-text-primary">{formatCurrency(stats.volume7d)}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">30d Volume</div>
            <div className="font-semibold text-text-primary">{formatCurrency(stats.volume30d)}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">Total Positions</div>
            <div className="font-semibold text-text-primary">{stats.totalPositions}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">Total Fees</div>
            <div className="font-semibold text-text-primary">{formatCurrency(stats.totalFees)}</div>
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
    <div className="bg-white dark:bg-card rounded-xl p-6 border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-primary/20 rounded-lg">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {change !== undefined && (
          <span
            className={`text-sm font-medium ${
              change >= 0 ? 'text-success' : 'text-error'
            }`}
          >
            {change >= 0 ? '+' : ''}
            {formatNumber(change, 2)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mb-1 text-text-primary">{value}</div>
      <div className="text-sm text-text-secondary">{title}</div>
    </div>
  );
}

