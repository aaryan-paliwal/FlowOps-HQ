import { Card } from './Card';

export function MetricCard({ title, value, icon: Icon, trend, change }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-neutral-500">
        <span className="text-xs font-mono uppercase tracking-wider font-semibold">{title}</span>
        {Icon && <Icon className="w-4 h-4" />}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans">{value}</span>
        {change && (
          <span className={`text-xs font-bold px-2 py-1 rounded ${trend === 'up' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' : 'text-red-600 bg-red-50 dark:bg-red-950/50'}`}>
            {change}
          </span>
        )}
      </div>
    </Card>
  );
}
