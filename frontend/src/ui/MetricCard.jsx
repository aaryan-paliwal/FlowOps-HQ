import { Card } from './Card';

export function MetricCard({ title, value, icon: Icon, trend, change }) {
  return (
    <Card className="flex flex-col gap-4 border border-[rgba(153,27,27,0.25)] hover:border-red-500/40 transition-all">
      <div className="flex items-center justify-between text-neutral-400">
        <span className="text-xs font-mono uppercase tracking-wider font-semibold text-neutral-400">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-[#CBFF2E] drop-shadow-[0_0_6px_rgba(203,255,46,0.4)]" />}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold tracking-tight text-white font-sans">{value}</span>
        {change && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${trend === 'up' ? 'text-[#CBFF2E] bg-[#CBFF2E]/10 border-[#CBFF2E]/30 shadow-[0_0_8px_rgba(203,255,46,0.2)]' : 'text-red-400 bg-red-950/40 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]'}`}>
            {change}
          </span>
        )}
      </div>
    </Card>
  );
}
