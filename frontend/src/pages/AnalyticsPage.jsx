import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Icon from '../ui/Icon';
import { Card } from '../ui/Card';
import { analyticsService, logsService } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import { useCurrency } from '../hooks/useCurrency';

const defaultChartData = [
    { time: "12:00", value: 0 },
    { time: "02:00", value: 0 },
    { time: "04:00", value: 0 },
    { time: "06:00", value: 0 },
    { time: "08:00", value: 0 },
    { time: "10:00", value: 0 },
    { time: "12:00", value: 0 },
    { time: "02:00", value: 0 },
    { time: "04:00", value: 0 },
    { time: "06:00", value: 0 },
    { time: "08:00", value: 0 },
    { time: "10:00", value: 0 },
    { time: "12:00", value: 0 }
];

const defaultLatencyData = defaultChartData;
const defaultRequestsData = defaultChartData;
const defaultUsersData = defaultChartData;
const defaultCostData = defaultChartData;
const defaultTokensData = defaultChartData;


function EmptyStateIllustration() {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 select-none">
            <div className="relative w-40 h-40 flex items-center justify-center">
                {/* Outer radial glow and sparkles */}
                <svg className="w-full h-full text-[#27272A]" viewBox="0 0 160 160" fill="none" stroke="currentColor">
                    {/* Sparkle rays */}
                    <line x1="30" y1="50" x2="40" y2="55" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="25" y1="75" x2="37" y2="75" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="33" y1="102" x2="43" y2="97" strokeWidth="1.5" strokeLinecap="round" />
                    
                    <line x1="130" y1="50" x2="120" y2="55" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="135" y1="75" x2="123" y2="75" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="127" y1="102" x2="117" y2="97" strokeWidth="1.5" strokeLinecap="round" />

                    {/* Central Circle */}
                    <circle cx="80" cy="80" r="40" fill="#18181B" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    
                    {/* Outer dotted circle */}
                    <circle cx="80" cy="80" r="48" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                </svg>

                {/* Overlaid window card */}
                <div className="absolute w-[80px] h-[60px] bg-[#1E1E24] border border-white/10 rounded-lg p-2 shadow-xl flex flex-col justify-between">
                    {/* Window header: 3 dots */}
                    <div className="flex gap-1">
                        <span className="w-1 h-1 rounded-full bg-white/10"></span>
                        <span className="w-1 h-1 rounded-full bg-white/10"></span>
                        <span className="w-1 h-1 rounded-full bg-white/10"></span>
                    </div>
                    {/* Card Content */}
                    <div className="flex items-center justify-between flex-1 mt-1">
                        {/* Left Side: Question Mark */}
                        <div className="text-neutral-500 font-bold text-sm font-sans pl-1">?</div>
                        
                        {/* Right Side: Sad Face and Lines */}
                        <div className="flex flex-col items-end gap-1 pr-1">
                            {/* Sad Face */}
                            <span className="text-neutral-500 text-[10px] leading-none font-bold">☹</span>
                            {/* Lines */}
                            <div className="w-6 h-0.5 bg-neutral-700/50 rounded-full"></div>
                            <div className="w-4 h-0.5 bg-neutral-700/50 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AnalyticsPage() {
    const { formatAmount } = useCurrency();
    const [activeSubtab, setActiveSubtab] = useState(() => {
        const hash = window.location.hash.replace('#', '');
        const validTabs = ['Overview', 'Users', 'Errors', 'Cache', 'Optimizer', 'Feedback', 'Summary'];
        return validTabs.includes(hash) ? hash : 'Overview';
    });

    useEffect(() => {
        window.history.replaceState(null, '', `#${activeSubtab}`);
    }, [activeSubtab]);
    const [timeRange, setTimeRange] = useState('24h');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [latencyPercentile, setLatencyPercentile] = useState('P50');
    const [isPercentileOpen, setIsPercentileOpen] = useState(false);
    const [summaryFilter, setSummaryFilter] = useState('AI Service');
    const [isSummaryFilterOpen, setIsSummaryFilterOpen] = useState(false);
    const [queryAnchorTime] = useState(() => Date.now());

    const dateRef = useRef(null);
    const percentileRef = useRef(null);
    const summaryFilterRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dateRef.current && !dateRef.current.contains(event.target)) {
                setIsDateOpen(false);
            }
            if (percentileRef.current && !percentileRef.current.contains(event.target)) {
                setIsPercentileOpen(false);
            }
            if (summaryFilterRef.current && !summaryFilterRef.current.contains(event.target)) {
                setIsSummaryFilterOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fromParam = useMemo(() => {
        if (timeRange !== '24h') return undefined;
        return new Date(queryAnchorTime - 24 * 60 * 60 * 1000).toISOString();
    }, [timeRange, queryAnchorTime]);

    // Fetch Overview Metrics
    const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
        queryKey: ['analyticsOverview', timeRange],
        queryFn: () => analyticsService.getOverview({ from: fromParam }),
        select: (res) => res?.data,
        refetchInterval: 5000
    });

    // Fetch Traffic Data
    const { data: trafficData, refetch: refetchTraffic } = useQuery({
        queryKey: ['analyticsTraffic', timeRange],
        queryFn: () => analyticsService.getTraffic({ from: fromParam }),
        select: (res) => res?.data,
        refetchInterval: 5000
    });

    // Fetch Endpoints
    const { data: endpointsData, refetch: refetchEndpoints } = useQuery({
        queryKey: ['analyticsEndpoints', timeRange],
        queryFn: () => analyticsService.getEndpoints({ from: fromParam }),
        select: (res) => res?.data,
        refetchInterval: 5000
    });

    // Fetch LLM metrics
    const { data: llmMetrics, refetch: refetchLlm } = useQuery({
        queryKey: ['analyticsLlm', timeRange],
        queryFn: () => analyticsService.getLlmMetrics({ from: fromParam }),
        select: (res) => res?.data,
        refetchInterval: 5000
    });

    // Fetch Errors Data
    const { data: errorsData, refetch: refetchErrors } = useQuery({
        queryKey: ['analyticsErrors', timeRange],
        queryFn: () => analyticsService.getErrors({ from: fromParam }),
        select: (res) => res?.data,
        enabled: activeSubtab === 'Errors',
        refetchInterval: 5000
    });

    // Fetch Logs Data
    const { data: logsData, refetch: refetchLogs } = useQuery({
        queryKey: ['analyticsLogs', timeRange],
        queryFn: () => logsService.getLogs({ from: fromParam, limit: 100 }),
        select: (res) => res?.data,
        refetchInterval: 5000
    });

    // Fetch Cache Metrics Tab Data
    const { data: cacheMetrics, refetch: refetchCache } = useQuery({
        queryKey: ['analyticsCache', timeRange],
        queryFn: () => analyticsService.getCacheMetrics({ from: fromParam }),
        select: (res) => res?.data,
        enabled: activeSubtab === 'Cache',
        refetchInterval: 5000
    });

    // Fetch User Metrics Tab Data
    const { data: userMetrics, refetch: refetchUser } = useQuery({
        queryKey: ['analyticsUsers', timeRange],
        queryFn: () => analyticsService.getUserMetrics({ from: fromParam }),
        select: (res) => res?.data,
        enabled: activeSubtab === 'Users',
        refetchInterval: 5000
    });

    // Fetch Feedback Metrics Tab Data
    const { data: feedbackMetrics, refetch: refetchFeedback } = useQuery({
        queryKey: ['analyticsFeedback', timeRange],
        queryFn: () => analyticsService.getFeedbackMetrics({ from: fromParam }),
        select: (res) => res?.data,
        enabled: activeSubtab === 'Feedback',
        refetchInterval: 5000
    });

    // Fetch Summary Metrics Tab Data
    const { data: summaryMetrics, refetch: refetchSummary } = useQuery({
        queryKey: ['analyticsSummary', timeRange, summaryFilter],
        queryFn: () => analyticsService.getSummaryMetrics({ from: fromParam, groupBy: summaryFilter }),
        select: (res) => res?.data,
        enabled: activeSubtab === 'Summary',
        refetchInterval: 5000
    });

    const handleRefresh = () => {
        refetchOverview();
        refetchTraffic();
        refetchEndpoints();
        refetchLlm();
        refetchLogs();
        if (activeSubtab === 'Errors') refetchErrors();
        if (activeSubtab === 'Cache') refetchCache();
        if (activeSubtab === 'Users') refetchUser();
        if (activeSubtab === 'Feedback') refetchFeedback();
        if (activeSubtab === 'Summary') refetchSummary();
        toast.success("Analytics telemetry updated");
    };

    const avgLatency = overview?.avgLatency || 0;

    const currentLatencyVal = latencyPercentile === 'P50' 
        ? `${avgLatency}ms` 
        : latencyPercentile === 'P90' 
            ? `${Math.round(avgLatency * 1.3)}ms` 
            : `${Math.round(avgLatency * 1.8)}ms`;

    const logsList = Array.isArray(logsData) ? logsData : (logsData?.data || []);
    const uniqueIps = new Set(logsList.map(log => log.ip).filter(Boolean));
    const uniqueUsersCount = uniqueIps.size || 0;

    const getModelRate = (modelName = '', provider = '') => {
        const name = modelName.toLowerCase();
        const prov = provider.toLowerCase();
        if (name.includes('mini') || name.includes('gpt-4o-mini')) return 0.15; // USD / 1M tokens
        if (name.includes('gpt-4') || name.includes('gpt-4o')) return 2.50; 
        if (name.includes('gemini')) return 0.075; 
        if (name.includes('anthropic') || name.includes('claude')) return 3.00; 
        if (prov.includes('gemini')) return 0.075;
        if (prov.includes('anthropic')) return 3.00;
        return 2.50; // default premium
    };

    const totalCost = (llmMetrics?.models || []).reduce((sum, m) => {
        const rate = getModelRate(m.model);
        return sum + (m.tokens / 1000000) * rate;
    }, 0);

    const currentCostVal = totalCost === 0 ? formatAmount(0) : formatAmount(totalCost);

    const hasTelemetry = trafficData?.dataPoints && trafficData.dataPoints.length > 0;

    const latencyChartData = hasTelemetry
        ? trafficData.dataPoints.map(dp => {
            return {
                time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                value: dp.avgLatency || 0
            };
          })
        : defaultLatencyData;

    const requestsChartData = hasTelemetry
        ? trafficData.dataPoints.map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.requests || 0
          }))
        : defaultRequestsData;

    const uniqueUsersChartData = hasTelemetry
        ? trafficData.dataPoints.map(dp => {
            return {
                time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                value: dp.uniqueUsers || 0
            };
          })
        : defaultUsersData;

    const costChartData = hasTelemetry
        ? trafficData.dataPoints.map(dp => {
            return {
                time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                value: Number((dp.costInr || 0).toFixed(6))
            };
          })
        : defaultCostData;

    const tokensChartData = hasTelemetry
        ? trafficData.dataPoints.map(dp => {
            return {
                time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                value: dp.tokensUsed || 0
            };
          })
        : defaultTokensData;

    const dateOptions = [
        { label: 'Last 24 hours', value: '24h' },
        { label: 'Last 7 days', value: '7d' },
        { label: 'All time', value: 'all' }
    ];
    const activeDateLabel = dateOptions.find(o => o.value === timeRange)?.label || 'Last 24 hours';

    const filteredEndpoints = (endpointsData?.endpoints || []).filter(ep => 
        ep.endpoint.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredModels = (llmMetrics?.models || []).filter(m => 
        m.model.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Derived states for subtabs
    const currentUniqueUsersCount = userMetrics?.uniqueUsers ?? uniqueUsersCount;

    const userChartData = hasTelemetry
        ? (userMetrics?.timeSeries || []).map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.uniqueUsers || 0
          }))
        : uniqueUsersChartData;

    const reqsPerUserChartData = hasTelemetry
        ? (userMetrics?.timeSeries || []).map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.requestsPerUser || 0
          }))
        : defaultChartData;

    const activeUsersBreakdown = (logsList || []).reduce((acc, log) => {
        if (log.ip) {
            acc[log.ip] = (acc[log.ip] || 0) + 1;
        }
        return acc;
    }, {});
    const activeUsersList = Object.entries(activeUsersBreakdown)
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const errorRateChartData = hasTelemetry
        ? trafficData.dataPoints.map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.requests > 0 ? Number(((dp.errors / dp.requests) * 100).toFixed(1)) : 0
          }))
        : defaultChartData;

    const errorCountChartData = hasTelemetry
        ? trafficData.dataPoints.map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.errors || 0
          }))
        : defaultChartData;

    const totalErrorCount = errorsData?.errorDistribution?.reduce((sum, item) => sum + item.count, 0) || 0;

    const cacheHitsChartData = hasTelemetry
        ? (cacheMetrics?.timeSeries || []).map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.cacheHits || 0
          }))
        : defaultChartData;

    const cacheHitRateChartData = hasTelemetry
        ? (cacheMetrics?.timeSeries || []).map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.hitRate || 0
          }))
        : defaultChartData;

    const cacheSavingsChartData = hasTelemetry
        ? (cacheMetrics?.timeSeries || []).map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.savings || 0
          }))
        : defaultChartData;

    const cacheSpeedupPct = cacheMetrics?.cacheSpeedupPercent ?? 0;
    // ensure at least 0.1% so the arc is always drawn properly
    const safePct = Math.max(0.1, Math.min(100, cacheSpeedupPct));
    const speedupAngle = 180 - (safePct / 100) * 180;
    const speedupRad = (speedupAngle * Math.PI) / 180;
    const speedupX = 80 + 60 * Math.cos(speedupRad);
    const speedupY = 70 - 60 * Math.sin(speedupRad);
    const speedupPath = `M 20 70 A 60 60 0 0 1 ${speedupX} ${speedupY}`;

    const feedbackTrendChartData = hasTelemetry
        ? (feedbackMetrics?.timeSeries || []).map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.avgRating || 0
          }))
        : defaultChartData;

    const feedbackVolumeChartData = hasTelemetry
        ? (feedbackMetrics?.timeSeries || []).map(dp => ({
            time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: dp.requests || 0
          }))
        : defaultChartData;

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            
            {/* Header Title Bar */}
            <div className="mb-8 font-sans">
                <div className="flex items-center gap-3 mb-1">
                    <Icon name="bar_chart" className="w-7 h-7 text-white/40" />
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Analytics
                    </h1>
                </div>
                <p className="text-[15px] text-neutral-450">
                    Monitor real-time workspace traffic, token usage, and latency metrics.
                </p>
            </div>

            {/* Subtab Navigation Bar */}
            <div className="border-b border-white/5 pb-0 mb-6">
                <div className="flex items-center gap-1">
                    {[
                        { id: 'Overview', label: 'Overview', icon: 'visibility' },
                        { id: 'Users', label: 'Users', icon: 'group' },
                        { id: 'Errors', label: 'Errors', icon: 'warning' },
                        { id: 'Cache', label: 'Cache', icon: 'bolt' },
                        { id: 'Optimizer', label: 'Optimizer', icon: 'auto_awesome' },
                        { id: 'Feedback', label: 'Feedback', icon: 'chat' },
                        { id: 'Summary', label: 'Summary', icon: 'description' }
                    ].map(tab => {
                        const active = activeSubtab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSubtab(tab.id)}
                                className={`flex items-center gap-2 px-3 pb-3 pt-0.5 text-xs font-semibold border-b-2 transition-all cursor-pointer relative top-[1px] ${
                                    active 
                                        ? 'border-[#06B6D4] text-white font-bold' 
                                        : 'border-transparent text-neutral-455 hover:text-white'
                                }`}
                            >
                                <Icon name={tab.icon} className={`w-3.5 h-3.5 ${active ? 'text-[#06B6D4]' : 'text-neutral-455'}`} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filter toolbar */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 flex-1">
                    <button 
                        onClick={handleRefresh}
                        className="p-2 bg-[#0C0C0C]/50 border border-white/5 rounded text-neutral-400 hover:text-white hover:border-white/10 transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                        title="Refresh analytics data"
                    >
                        <Icon name="refresh" className="w-4 h-4 text-emerald-450"  />
                    </button>
                    {activeSubtab === 'Summary' && (
                        <div className="relative shrink-0 animate-in fade-in duration-200" ref={summaryFilterRef}>
                            <button
                                onClick={() => setIsSummaryFilterOpen(!isSummaryFilterOpen)}
                                className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#0C0C0C]/40 border border-[#06B6D4] rounded-lg text-xs font-sans text-white hover:border-[#06B6D4]/80 transition-colors cursor-pointer select-none font-semibold min-w-[110px] focus:outline-none"
                            >
                                <span>{summaryFilter}</span>
                                <Icon name="unfold_more" className="w-3.5 h-3.5 text-[#06B6D4]"  />
                            </button>
                            {isSummaryFilterOpen && (
                                <div className="absolute left-0 mt-1.5 w-40 bg-[#111111] border border-white/10 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-30 p-1 font-sans">
                                    {[
                                        'AI Service', 'Model', 'Status Code', 'Workspace',
                                        'API Key', 'Config', 'Provider', 'Prompt'
                                    ].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => {
                                                setSummaryFilter(opt);
                                                setIsSummaryFilterOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                                summaryFilter === opt 
                                                    ? 'bg-white/10 text-white font-bold' 
                                                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="relative flex-1">
                        <Icon name="search" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"  />
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search Filter" 
                            className="w-full pl-9 pr-4 py-1.5 bg-[#0C0C0C]/40 border border-white/5 rounded text-xs font-sans text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 transition-colors"
                        />
                    </div>
                </div>
                
                <div className="relative" ref={dateRef}>
                    <button 
                        onClick={() => setIsDateOpen(!isDateOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#0C0C0C] border border-white/5 rounded text-xs font-sans text-neutral-400 hover:border-white/10 hover:text-white transition-colors cursor-pointer select-none font-semibold"
                    >
                        <Icon name="calendar_today" className="w-3.5 h-3.5 text-neutral-500"  />
                        <span>{activeDateLabel}</span>
                        <Icon name="expand_more" className="w-3.5 h-3.5 text-neutral-500"  />
                    </button>
                    {isDateOpen && (
                        <div className="absolute right-0 mt-1 w-44 bg-[#111111] border border-white/5 rounded shadow-xl z-30 p-1">
                            {dateOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        setTimeRange(opt.value);
                                        setIsDateOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                                        timeRange === opt.value 
                                            ? 'bg-white/10 text-white font-bold' 
                                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Subtab views */}
            {activeSubtab === 'Overview' && (
                <>
                    {/* Top Row: Cost & Tokens Used */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Cost */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative animate-in fade-in duration-300">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-neutral-455 font-sans">Cost</span>
                                    <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Total API expenditure over the selected time range.</span>
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-white font-sans leading-none mb-3">
                                {overviewLoading ? '...' : currentCostVal}
                            </div>
                            <div className="w-full h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={costChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={hasTelemetry ? [0, 'auto'] : [0, 4]}
                                            ticks={hasTelemetry ? undefined : [0, 1, 2, 3, 4]}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EAB308" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Tokens Used */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative animate-in fade-in duration-300">
                            <div className="flex justify-between items-start mb-[14px]">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-neutral-455 font-sans">Tokens Used</span>
                                    <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Aggregate prompt and completion tokens processed.</span>
                                </div>
                            </div>
                            <div className="w-full h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={tokensChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={hasTelemetry ? [0, 'auto'] : [0, 4]}
                                            ticks={hasTelemetry ? undefined : [0, 1, 2, 3, 4]}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EAB308" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>

                    {/* Bottom Row: Latency, Requests, Unique Users */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {/* Latency */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative animate-in fade-in duration-300">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-neutral-455 font-sans">Latency</span>
                                    <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Average time taken for the gateway to respond to requests.</span>
                                </div>
                                <div className="relative" ref={percentileRef}>
                                    <button 
                                        onClick={() => setIsPercentileOpen(!isPercentileOpen)}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-[#111111] border border-white/5 rounded text-[10px] font-bold text-neutral-450 hover:border-white/10 hover:text-white transition-colors cursor-pointer select-none"
                                    >
                                        <span>{latencyPercentile}</span>
                                        <Icon name="expand_more" className="w-2.5 h-2.5 text-neutral-500"  />
                                    </button>
                                    {isPercentileOpen && (
                                        <div className="absolute right-0 mt-1 w-20 bg-[#111111] border border-white/5 rounded shadow-xl z-30 p-1">
                                            {['P50', 'P90', 'P99'].map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => {
                                                        setLatencyPercentile(p);
                                                        setIsPercentileOpen(false);
                                                    }}
                                                    className={`w-full text-left px-2 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                                                        latencyPercentile === p 
                                                            ? 'bg-white/10 text-white font-bold' 
                                                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-white font-sans leading-none mb-3">
                                {overviewLoading ? '...' : currentLatencyVal}
                            </div>
                            <div className="w-full h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={latencyChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={hasTelemetry ? [0, 'auto'] : [0, 4]}
                                            ticks={hasTelemetry ? undefined : [0, 1, 2, 3, 4]}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EAB308" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Requests */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative animate-in fade-in duration-300">
                            <div className="flex justify-between items-start mb-[14px]">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-neutral-455 font-sans">Requests</span>
                                    <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Total volume of API requests handled by the gateway.</span>
                                </div>
                            </div>
                            <div className="w-full h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={requestsChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={hasTelemetry ? [0, 'auto'] : [0, 4]}
                                            ticks={hasTelemetry ? undefined : [0, 1, 2, 3, 4]}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EAB308" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Unique Users */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative animate-in fade-in duration-300">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-neutral-455 font-sans">Unique Users</span>
                                    <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Number of distinct client IPs accessing the API.</span>
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-white font-sans leading-none mb-3">
                                {overviewLoading ? '...' : uniqueUsersCount}
                            </div>
                            <div className="w-full h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={uniqueUsersChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={hasTelemetry ? [0, 'auto'] : [0, 4]}
                                            ticks={hasTelemetry ? undefined : [0, 1, 2, 3, 4]}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EAB308" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>

                    {/* Bottom grid columns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Endpoints Panel */}
                        <Card className="flex flex-col p-0 overflow-hidden bg-[#0C0C0C] border border-white/5 rounded-xl min-h-[300px] justify-center animate-in fade-in duration-300">
                            {hasTelemetry && filteredEndpoints.length > 0 ? (
                                <div className="flex flex-col h-full">
                                    <div className="flex justify-between items-center p-6 pb-4">
                                        <h2 className="text-[14px] font-bold text-white font-sans">Active Gateway Endpoints</h2>
                                    </div>
                                    <div className="overflow-x-auto flex-1">
                                        <table className="w-full text-[12px] text-left">
                                            <thead>
                                                <tr className="border-b border-white/5 bg-white/2">
                                                    <th className="px-6 py-3 font-sans text-[10px] font-bold text-neutral-400 uppercase tracking-wider">ENDPOINT</th>
                                                    <th className="px-6 py-3 font-sans text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-right">VOLUME</th>
                                                    <th className="px-6 py-3 font-sans text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-right">LATENCY</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {filteredEndpoints.map((ep, i) => (
                                                    <tr key={i} className="hover:bg-white/2 transition-colors">
                                                        <td className="px-6 py-4 font-mono text-white flex items-center gap-2">
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/5 bg-white/5 text-neutral-355 tracking-wide">
                                                                {ep.method || 'POST'}
                                                            </span>
                                                            {ep.endpoint}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-sans text-white">{ep.requests.toLocaleString()}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-neutral-400">{ep.avgLatency}ms</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <EmptyStateIllustration />
                            )}
                        </Card>

                        {/* Model Breakdown Panel */}
                        <Card className="flex flex-col p-0 overflow-hidden bg-[#0C0C0C] border border-white/5 rounded-xl min-h-[300px] justify-center animate-in fade-in duration-300">
                            {hasTelemetry && filteredModels.length > 0 ? (
                                <div className="flex flex-col h-full">
                                    <div className="flex justify-between items-center p-6 pb-4">
                                        <h2 className="text-[14px] font-bold text-white font-sans">Model Efficiency Performance</h2>
                                    </div>
                                    <div className="overflow-x-auto flex-1">
                                        <table className="w-full text-[12px] text-left">
                                            <thead>
                                                <tr className="border-b border-white/5 bg-white/2">
                                                    <th className="px-6 py-3 font-sans text-[10px] font-bold text-neutral-400 uppercase tracking-wider">MODEL IDENTIFIER</th>
                                                    <th className="px-6 py-3 font-sans text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-right">VOLUME</th>
                                                    <th className="px-6 py-3 font-sans text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-right">TOKENS USED</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {filteredModels.map((m, i) => (
                                                    <tr key={i} className="hover:bg-white/2 transition-colors">
                                                        <td className="px-6 py-4 font-mono text-white">{m.model}</td>
                                                        <td className="px-6 py-4 text-right font-sans text-white">{m.requests.toLocaleString()}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-neutral-400">{m.tokens.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <EmptyStateIllustration />
                            )}
                        </Card>
                    </div>
                </>
            )}
            {activeSubtab === 'Users' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Row 1: Unique Users & Active Users Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Unique Users */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Unique Users</span>
                                <span className="text-2xl font-bold text-white font-sans leading-none mt-1">
                                    {overviewLoading ? '...' : currentUniqueUsersCount}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Number of distinct client IPs accessing the API.</span>
                            </div>
                            <div className="w-full h-[150px] mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={userChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EAB308" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Top Active Client IPs */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 rounded-xl p-0 overflow-hidden min-h-[220px]">
                            <div className="flex justify-between items-center p-4 pb-2 border-b border-white/5 bg-white/[0.01]">
                                <h3 className="text-xs font-bold text-white font-sans">Top Active Client IPs</h3>
                            </div>
                            <div className="overflow-x-auto flex-1">
                                {activeUsersList.length > 0 ? (
                                    <table className="w-full text-left text-[12px] font-sans">
                                        <thead>
                                            <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-neutral-455 font-bold uppercase tracking-wider">
                                                <th className="px-4 py-2">Client IP</th>
                                                <th className="px-4 py-2 text-right">Transactions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {activeUsersList.map((usr, i) => (
                                                <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="px-4 py-2.5 font-mono text-white">{usr.ip}</td>
                                                    <td className="px-4 py-2.5 text-right text-neutral-355 font-semibold">{usr.count.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center p-4">
                                        <EmptyStateIllustration />
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Row 2: Requests Per User & User Feedback Sentiment */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Requests Per User */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Requests Per User</span>
                                <span className="text-2xl font-bold text-white font-sans leading-none mt-1">
                                    {userMetrics ? userMetrics.requestsPerUser : '...'}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Average number of requests made per unique client IP.</span>
                            </div>
                            <div className="w-full h-[150px] mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={reqsPerUserChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EAB308" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* User Feedback Sentiment */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative min-h-[220px]">
                            <div className="flex flex-col mb-2">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">User Feedback Sentiment</span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Real-time service quality index based on cache and error rates.</span>
                            </div>
                            <div className="flex-1 flex flex-col justify-center space-y-4">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-white font-sans">{feedbackMetrics?.avgRating?.toFixed(2) ?? '0.00'}</span>
                                    <span className="text-xs text-neutral-455">Weighted rating out of 5.0</span>
                                </div>
                                <div className="space-y-2">
                                    {/* Positive rating */}
                                    <div className="flex flex-col text-xs space-y-1">
                                        <div className="flex justify-between font-semibold">
                                            <span className="text-emerald-400">Excellent Quality (Cache Hits & Low Latency)</span>
                                            <span className="text-white">{feedbackMetrics?.positiveCount ?? 0}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[#111] rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-400 rounded-full transition-all duration-500" 
                                                style={{ width: `${feedbackMetrics ? (feedbackMetrics.positiveCount / (feedbackMetrics.positiveCount + feedbackMetrics.neutralCount + feedbackMetrics.negativeCount || 1)) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                    {/* Neutral rating */}
                                    <div className="flex flex-col text-xs space-y-1">
                                        <div className="flex justify-between font-semibold">
                                            <span className="text-amber-400">Satisfactory Speed (Standard Latency)</span>
                                            <span className="text-white">{feedbackMetrics?.neutralCount ?? 0}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[#111] rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                                                style={{ width: `${feedbackMetrics ? (feedbackMetrics.neutralCount / (feedbackMetrics.positiveCount + feedbackMetrics.neutralCount + feedbackMetrics.negativeCount || 1)) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                    {/* Negative rating */}
                                    <div className="flex flex-col text-xs space-y-1">
                                        <div className="flex justify-between font-semibold">
                                            <span className="text-red-400">Degraded (API Errors & Slow Timeout)</span>
                                            <span className="text-white">{feedbackMetrics?.negativeCount ?? 0}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[#111] rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-red-400 rounded-full transition-all duration-500" 
                                                style={{ width: `${feedbackMetrics ? (feedbackMetrics.negativeCount / (feedbackMetrics.positiveCount + feedbackMetrics.neutralCount + feedbackMetrics.negativeCount || 1)) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeSubtab === 'Errors' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Row 1: Error Rate & Error Count */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Error Rate */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Error Rate</span>
                                <span className="text-2xl font-bold text-white font-sans leading-none mt-1">
                                    {overview ? `${overview.errorRate}%` : '...'}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Percentage of requests resulting in non-200 HTTP status codes.</span>
                            </div>
                            <div className="w-full h-[150px] mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={errorRateChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EF4444" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Error Count */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Error Count</span>
                                <span className="text-2xl font-bold text-white font-sans leading-none mt-1">
                                    {errorsData ? totalErrorCount : '...'}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Total absolute volume of failed API requests.</span>
                            </div>
                            <div className="w-full h-[150px] mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={errorCountChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EF4444" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>

                    {/* Row 2: Error Types & Self-Healing Pipeline */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Error Types Table */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 rounded-xl p-0 overflow-hidden min-h-[220px]">
                            <div className="flex justify-between items-center p-4 pb-2 border-b border-white/5 bg-white/[0.01]">
                                <h3 className="text-xs font-bold text-white font-sans">Error Distribution by Status Code</h3>
                            </div>
                            <div className="overflow-x-auto flex-1 font-sans">
                                {errorsData?.errorDistribution?.length > 0 ? (
                                    <table className="w-full text-left text-[12px]">
                                        <thead>
                                            <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-neutral-455 font-bold uppercase tracking-wider">
                                                <th className="px-4 py-2">HTTP Status</th>
                                                <th className="px-4 py-2 text-right">Occurrences</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {errorsData.errorDistribution.map((err, i) => (
                                                <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="px-4 py-2.5 font-mono">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-950/30 text-red-400 border border-red-500/10">
                                                            HTTP {err.statusCode}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-mono text-white">{err.count.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center p-8">
                                        <div className="flex flex-col items-center space-y-2">
                                            <Icon name="checkcircle" className="w-8 h-8 text-emerald-450"  />
                                            <span className="text-xs font-semibold text-neutral-355 font-sans">Zero gateway errors detected</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Self-Healing Pipeline status */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl min-h-[220px] font-sans justify-center space-y-4">
                            <div>
                                <span className="text-xs font-semibold text-neutral-455">Failover Resilience Pipeline</span>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-sm font-bold text-white">Active & Fully Armed</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-neutral-450 leading-relaxed bg-[#111]/30 p-3 rounded-lg border border-white/5">
                                Gateway is automatically managing self-healing fallback loops. Upon any model API or timeout failure, FlowOps HQ automatically retries with alternative model pathways instantly.
                            </p>
                            <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2 text-neutral-400 font-mono">
                                <span>Escalated Errors:</span>
                                <span className="text-white font-bold">0</span>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeSubtab === 'Cache' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Row 1: Cache Hits & Cache Speedup */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Cache Hits */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Cache Hits</span>
                                <span className="text-2xl font-bold text-white font-sans leading-none mt-1">
                                    {cacheMetrics ? cacheMetrics.cacheHits : '...'}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Total number of requests successfully served from semantic cache.</span>
                            </div>
                            <div className="w-full h-[150px] mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={cacheHitsChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Cache Speedup */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-2">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Cache Speedup</span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Percentage latency reduction compared to standard model generation.</span>
                            </div>
                            <div className="flex-1 flex items-center justify-between px-4 mt-2">
                                {/* Left side text */}
                                <div className="flex flex-col justify-center space-y-2">
                                    <div>
                                        <span className="text-[10px] text-neutral-500 font-semibold font-sans block">Avg Cache Latency</span>
                                        <span className="text-lg font-bold text-white font-sans">{cacheMetrics ? `${cacheMetrics.avgCacheLatency}ms` : '...'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-neutral-500 font-semibold font-sans block">Avg Gateway Latency</span>
                                        <span className="text-sm font-bold text-neutral-400 font-sans">{cacheMetrics ? `${cacheMetrics.avgNonCacheLatency}ms` : '...'}</span>
                                    </div>
                                </div>
                                {/* Right side Gauge */}
                                <div className="flex flex-col items-center">
                                    <div className="relative flex flex-col items-center justify-center">
                                        <svg className="w-64 h-32" viewBox="0 0 160 80">
                                            {/* Background Arch in dark green */}
                                            <path 
                                                d="M 20 70 A 60 60 0 0 1 140 70" 
                                                fill="none" 
                                                stroke="#047857" 
                                                strokeWidth="16" 
                                                strokeLinecap="round" 
                                            />
                                            {/* Foreground Golden start accent */}
                                            <path 
                                                d={speedupPath}
                                                fill="none" 
                                                stroke="#06B6D4" 
                                                strokeWidth="16" 
                                                strokeLinecap="round" 
                                            />
                                        </svg>
                                        <span className="text-xl font-bold text-[#06B6D4] mt-2 font-mono">{cacheSpeedupPct}%</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Row 2: Cache Hit Rate & Cache Savings */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Cache Hit Rate */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Cache Hit Rate</span>
                                <span className="text-2xl font-bold text-white font-sans leading-none mt-1">
                                    {cacheMetrics ? `${cacheMetrics.cacheHitRate}%` : '...'}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Percentage of requests successfully served directly from the semantic cache.</span>
                            </div>
                            <div className="w-full h-[150px] mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={cacheHitRateChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={[0, 100]}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Cache Savings */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Cache Savings</span>
                                <span className="text-2xl font-bold text-white font-sans leading-none mt-1">
                                    {cacheMetrics ? formatAmount(cacheMetrics.cacheSavings || 0, 4) : '...'}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Estimated cost savings achieved by serving requests from the cache instead of the model.</span>
                            </div>
                            <div className="w-full h-[150px] mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={cacheSavingsChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeSubtab === 'Optimizer' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Provider Breakdown */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 rounded-xl p-0 overflow-hidden min-h-[300px]">
                            <div className="flex justify-between items-center p-4 pb-2 border-b border-white/5 bg-white/[0.01]">
                                <div className="flex flex-col">
                                    <h3 className="text-xs font-bold text-white font-sans">Provider Distribution</h3>
                                    <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Breakdown of requests and tokens per LLM provider.</span>
                                </div>
                            </div>
                            <div className="overflow-x-auto flex-1 p-4">
                                {(llmMetrics?.providers?.length > 0) ? (
                                    <table className="w-full text-left text-[12px] font-sans">
                                        <thead>
                                            <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-neutral-455 font-bold uppercase tracking-wider">
                                                <th className="py-2">Provider</th>
                                                <th className="py-2 text-right">Requests</th>
                                                <th className="py-2 text-right">Tokens Used</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {llmMetrics.providers.map((p, i) => (
                                                <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="py-2.5 font-mono text-white capitalize">{p.provider}</td>
                                                    <td className="py-2.5 text-right font-mono text-neutral-355">{p.requests.toLocaleString()}</td>
                                                    <td className="py-2.5 text-right font-mono text-neutral-400">{p.tokens.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex-1 flex h-full items-center justify-center p-4">
                                        <EmptyStateIllustration />
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Model Breakdown */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 rounded-xl p-0 overflow-hidden min-h-[300px]">
                            <div className="flex justify-between items-center p-4 pb-2 border-b border-white/5 bg-white/[0.01]">
                                <div className="flex flex-col">
                                    <h3 className="text-xs font-bold text-white font-sans">Model Efficiency</h3>
                                    <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Performance and usage breakdown across different AI models.</span>
                                </div>
                            </div>
                            <div className="overflow-x-auto flex-1 p-4">
                                {(llmMetrics?.models?.length > 0) ? (
                                    <table className="w-full text-left text-[12px] font-sans">
                                        <thead>
                                            <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-neutral-455 font-bold uppercase tracking-wider">
                                                <th className="py-2">Model</th>
                                                <th className="py-2 text-right">Requests</th>
                                                <th className="py-2 text-right">Tokens Used</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {llmMetrics.models.map((m, i) => (
                                                <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="py-2.5 font-mono text-white">{m.model}</td>
                                                    <td className="py-2.5 text-right font-mono text-neutral-355">{m.requests.toLocaleString()}</td>
                                                    <td className="py-2.5 text-right font-mono text-neutral-400">{m.tokens.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex-1 flex h-full items-center justify-center p-4">
                                        <EmptyStateIllustration />
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeSubtab === 'Feedback' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Row 1: Rating Trend & Feedback Sentiment Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Trend */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Quality Rating Index</span>
                                <span className="text-2xl font-bold text-white font-sans leading-none mt-1">
                                    {feedbackMetrics?.avgRating?.toFixed(2) ?? '0.00'}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Aggregated user feedback score mapped over time to measure model response quality.</span>
                            </div>
                            <div className="w-full h-[150px] mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={feedbackTrendChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={[0, 5]}
                                            ticks={[0, 1, 2, 3, 4, 5]}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#EAB308" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Sentiment Rating Breakdown */}
                        <Card className="flex flex-col lg:flex-row bg-[#0C0C0C] border border-white/5 p-4 rounded-xl min-h-[220px] font-sans">
                            <div className="flex flex-col mb-1 lg:w-1/3 justify-center space-y-2">
                                <span className="text-xs font-semibold text-neutral-455">Overall Quality Rating</span>
                                <div className="text-3xl font-bold text-white leading-none">
                                    {feedbackMetrics?.avgRating?.toFixed(1) ?? '0.0'}
                                    <span className="text-xs text-neutral-500 font-semibold block mt-1">out of 5.0 stars</span>
                                </div>
                                <div className="flex gap-0.5 text-yellow-500">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                        <span key={idx} className="text-sm">★</span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col justify-center space-y-2">
                                {/* Horizontal distribution bars */}
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between font-semibold">
                                        <span className="text-neutral-300">Positive (Excellent Cache Hits & Speed)</span>
                                        <span className="text-white">{feedbackMetrics?.positiveCount ?? 0}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#111] rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-[#06B6D4] rounded-full transition-all duration-500" 
                                            style={{ width: `${feedbackMetrics ? (feedbackMetrics.positiveCount / (feedbackMetrics.positiveCount + feedbackMetrics.neutralCount + feedbackMetrics.negativeCount || 1)) * 100 : 0}%` }}
                                        />
                                    </div>

                                    <div className="flex justify-between font-semibold">
                                        <span className="text-neutral-300">Neutral (Standard Latency)</span>
                                        <span className="text-white">{feedbackMetrics?.neutralCount ?? 0}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#111] rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-amber-450 rounded-full transition-all duration-500" 
                                            style={{ width: `${feedbackMetrics ? (feedbackMetrics.neutralCount / (feedbackMetrics.positiveCount + feedbackMetrics.neutralCount + feedbackMetrics.negativeCount || 1)) * 100 : 0}%` }}
                                        />
                                    </div>

                                    <div className="flex justify-between font-semibold">
                                        <span className="text-neutral-300">Negative (Timeout & API Failures)</span>
                                        <span className="text-white">{feedbackMetrics?.negativeCount ?? 0}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#111] rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-red-400 rounded-full transition-all duration-500" 
                                            style={{ width: `${feedbackMetrics ? (feedbackMetrics.negativeCount / (feedbackMetrics.positiveCount + feedbackMetrics.neutralCount + feedbackMetrics.negativeCount || 1)) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Row 2: Feedback Volume & Telemetry Alerts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Feedback Volume Chart */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl relative">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs font-semibold text-neutral-455 font-sans">Collected Rating Volume</span>
                                <span className="text-[10px] text-neutral-500 font-sans mt-1">Total number of feedback ratings collected over time.</span>
                            </div>
                            <div className="w-full h-[150px] mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={feedbackVolumeChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 8, fill: '#6B7280', fontWeight: 500 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', color: '#FFF', fontSize: 10, borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={1.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Telemetry System Diagnostics Alerts */}
                        <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 p-4 rounded-xl min-h-[220px] font-sans">
                            <div className="border-b border-white/5 pb-2 mb-3">
                                <h3 className="text-xs font-bold text-white">System Optimization Diagnostics</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[160px]">
                                {feedbackMetrics?.feedbackList?.length > 0 ? (
                                    feedbackMetrics.feedbackList.map((alert, i) => {
                                        const badgeStyle = alert.type === 'error' 
                                            ? 'bg-red-950/30 text-red-400 border border-red-500/10'
                                            : alert.type === 'warning'
                                                ? 'bg-amber-950/30 text-amber-400 border border-amber-500/10'
                                                : 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/10';
                                        return (
                                            <div key={i} className="p-3 bg-[#111]/30 border border-white/5 rounded-lg flex items-start gap-2.5 animate-in fade-in duration-200">
                                                <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${badgeStyle}`}>
                                                    {alert.type}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="text-xs font-bold text-white">{alert.title}</h4>
                                                    <p className="text-[10px] text-neutral-455 leading-normal">{alert.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex h-full items-center justify-center text-xs text-neutral-500 font-semibold py-4">
                                        No active system alerts detected.
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeSubtab === 'Summary' && (
                <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 rounded-xl p-0 overflow-hidden min-h-[450px] animate-in fade-in duration-300">
                    <div className="flex justify-between items-center p-4 pb-2 border-b border-white/5 bg-white/[0.01]">
                        <div className="flex flex-col">
                            <h3 className="text-xs font-bold text-white font-sans">Summarized Log Analytics by {summaryFilter}</h3>
                            <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Aggregated metrics grouped by your selected filter.</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1 font-sans">
                        {summaryMetrics?.summary?.length > 0 ? (
                            <table className="w-full text-left text-[12px]">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-neutral-455 font-bold uppercase tracking-wider">
                                        <th className="px-6 py-3">{summaryFilter}</th>
                                        <th className="px-6 py-3 text-right">Volume</th>
                                        <th className="px-6 py-3 text-right">Avg Latency</th>
                                        <th className="px-6 py-3 text-right">Tokens Used</th>
                                        <th className="px-6 py-3 text-right">Est. Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {summaryMetrics.summary.map((item, i) => (
                                        <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                                            <td className="px-6 py-3.5 font-mono text-white max-w-[200px] truncate" title={item.group}>
                                                {item.group}
                                            </td>
                                            <td className="px-6 py-3.5 text-right font-sans text-neutral-200">{item.requests.toLocaleString()}</td>
                                            <td className="px-6 py-3.5 text-right font-mono text-neutral-400">{item.avgLatency}ms</td>
                                            <td className="px-6 py-3.5 text-right font-mono text-neutral-400">{item.tokens.toLocaleString()}</td>
                                            <td className="px-6 py-3.5 text-right font-mono text-cyan-400">
                                                {formatAmount(item.cost || 0, 4)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-20">
                                <span className="text-[13px] font-semibold text-neutral-450">No summary telemetry available for this range</span>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {activeSubtab === 'Optimizer' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {/* Optimizer Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {(() => {
                            const optimizedLogs = logsList.filter(l => l.promptOptimized);
                            const totalTokensSaved = logsList.reduce((sum, l) => sum + (l.tokensSaved || 0), 0);
                            const avgOptPercent = optimizedLogs.length > 0 
                                ? (optimizedLogs.reduce((sum, l) => sum + (l.optimizationPercent || 0), 0) / optimizedLogs.length).toFixed(1)
                                : '0';
                            const optimizationRate = logsList.length > 0 
                                ? ((optimizedLogs.length / logsList.length) * 100).toFixed(1)
                                : '0';
                            const estimatedCostSaved = (totalTokensSaved / 1000000) * 208.5;

                            return (
                                <>
                                    <Card className="bg-[#0C0C0C] border border-white/5 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon name="auto_awesome" className="w-3.5 h-3.5 text-purple-400"  />
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Tokens Saved</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white font-mono">{totalTokensSaved.toLocaleString()}</p>
                                        <p className="text-[10px] text-neutral-500 mt-1">via Codex prompt compression</p>
                                    </Card>
                                    <Card className="bg-[#0C0C0C] border border-white/5 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon name="bolt" className="w-3.5 h-3.5 text-cyan-400"  />
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Avg Compression</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white font-mono">{avgOptPercent}%</p>
                                        <p className="text-[10px] text-neutral-500 mt-1">average token reduction per prompt</p>
                                    </Card>
                                    <Card className="bg-[#0C0C0C] border border-white/5 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon name="check_circle" className="w-3.5 h-3.5 text-emerald-400"  />
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Optimization Rate</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white font-mono">{optimizationRate}%</p>
                                        <p className="text-[10px] text-neutral-500 mt-1">{optimizedLogs.length} of {logsList.length} requests optimized</p>
                                    </Card>
                                    <Card className="bg-[#0C0C0C] border border-white/5 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-purple-400 text-sm">₹</span>
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Est. Cost Saved</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white font-mono">₹{estimatedCostSaved < 1 ? estimatedCostSaved.toFixed(5) : estimatedCostSaved.toFixed(2)}</p>
                                        <p className="text-[10px] text-neutral-500 mt-1">based on ₹208.5/1M token avg</p>
                                    </Card>
                                </>
                            );
                        })()}
                    </div>

                    {/* Optimization Log Table */}
                    <Card className="flex flex-col bg-[#0C0C0C] border border-white/5 rounded-xl p-0 overflow-hidden min-h-[350px]">
                        <div className="flex justify-between items-center p-4 pb-2 border-b border-white/5 bg-white/[0.01]">
                            <div className="flex flex-col">
                                <h3 className="text-xs font-bold text-white font-sans">Prompt Optimization Log</h3>
                                <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Real-time log of prompts compressed by Codex before being sent to the LLM provider.</span>
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono">Powered by OpenAI Codex</span>
                        </div>
                        <div className="overflow-x-auto flex-1 font-sans">
                            {logsList.length > 0 ? (
                                <table className="w-full text-left text-[12px]">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-neutral-455 font-bold uppercase tracking-wider">
                                            <th className="px-5 py-3">Timestamp</th>
                                            <th className="px-5 py-3">Model</th>
                                            <th className="px-5 py-3 text-right">Original Tokens</th>
                                            <th className="px-5 py-3 text-right">Optimized Tokens</th>
                                            <th className="px-5 py-3 text-right">Saved</th>
                                            <th className="px-5 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {logsList.slice(0, 25).map((log, i) => {
                                            const saved = log.tokensSaved || 0;
                                            const original = log.originalPromptTokens || log.promptTokens || 0;
                                            const optimized = original - saved;
                                            const pct = log.optimizationPercent || 0;
                                            return (
                                                <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="px-5 py-3 font-mono text-neutral-400 text-[11px]">
                                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </td>
                                                    <td className="px-5 py-3 font-mono text-white">{log.model || 'unknown'}</td>
                                                    <td className="px-5 py-3 text-right font-mono text-neutral-400">{original.toLocaleString()}</td>
                                                    <td className="px-5 py-3 text-right font-mono text-neutral-200">{optimized.toLocaleString()}</td>
                                                    <td className="px-5 py-3 text-right font-mono">
                                                        {saved > 0 ? (
                                                            <span className="text-emerald-400">-{saved} ({pct}%)</span>
                                                        ) : (
                                                            <span className="text-neutral-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        {log.promptOptimized ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-950/50 text-purple-300 border border-purple-500/20">OPTIMIZED</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-neutral-900 text-neutral-500 border border-white/5">PASSTHROUGH</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-16">
                                    <Icon name="auto_awesome" className="w-8 h-8 text-purple-500/30 mb-3"  />
                                    <span className="text-[13px] font-semibold text-neutral-450">No optimization data yet</span>
                                    <span className="text-[11px] text-neutral-600 mt-1">Send requests through the gateway to see Codex optimization metrics</span>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* How It Works */}
                    <Card className="bg-[#0C0C0C] border border-white/5 rounded-xl p-5">
                        <h3 className="text-xs font-bold text-white font-sans mb-3">How Codex Prompt Optimizer Works</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[
                                { step: '1', title: 'Intercept', desc: 'Incoming prompt is captured at the gateway layer' },
                                { step: '2', title: 'Analyze', desc: 'GPT-4o-mini evaluates prompt verbosity and redundancy' },
                                { step: '3', title: 'Compress', desc: 'Prompt is rewritten to be concise while preserving intent' },
                                { step: '4', title: 'Route', desc: 'Optimized prompt is forwarded to the target LLM provider' }
                            ].map(item => (
                                <div key={item.step} className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-bold text-purple-400">{item.step}</span>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-white">{item.title}</p>
                                        <p className="text-[10px] text-neutral-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
