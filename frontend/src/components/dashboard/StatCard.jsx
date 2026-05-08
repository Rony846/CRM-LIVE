import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue, 
  className,
  tvMode = false 
}) {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className={tvMode ? 'w-6 h-6' : 'w-4 h-4'} />;
    if (trend === 'down') return <TrendingDown className={tvMode ? 'w-6 h-6' : 'w-4 h-4'} />;
    return <Minus className={tvMode ? 'w-6 h-6' : 'w-4 h-4'} />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-slate-500';
  };

  if (tvMode) {
    return (
      <div className={cn(
        'bg-slate-800 border border-slate-700 rounded-lg p-6',
        className
      )}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-slate-400 text-lg uppercase tracking-wider">{title}</span>
          {Icon && <Icon className="w-8 h-8 text-blue-500" />}
        </div>
        <div className="text-6xl font-bold text-white font-['Barlow_Condensed']">
          {value}
        </div>
        {trendValue && (
          <div className={cn('flex items-center gap-1 mt-2 text-lg', getTrendColor())}>
            {getTrendIcon()}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      'bg-white border border-slate-200 rounded-lg p-5 shadow-sm card-hover',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        {Icon && (
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-slate-900 font-['Barlow_Condensed']">
        {value}
      </div>
      {trendValue && (
        <div className={cn('flex items-center gap-1 mt-2 text-sm', getTrendColor())}>
          {getTrendIcon()}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
