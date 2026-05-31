import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Icon from '../ui/Icon';
import { Card } from '../ui/Card';
import { logsService } from '../services/api';
import toast from 'react-hot-toast';

export default function LiveLogsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [activeTab, setActiveTab] = useState('Logs'); // 'Logs' or 'Traces'
    const [timeRange, setTimeRange] = useState('15m'); // '15m', '1h', '24h', 'Yesterday', '3d', '7d', '14d', '30d', '90d', 'Custom'
    const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);
    const [isColumnSelectOpen, setIsColumnSelectOpen] = useState(false);
    const [isRefreshOpen, setIsRefreshOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLiveLogs, setIsLiveLogs] = useState(true);

    // Columns Checkbox State
    const [columns, setColumns] = useState({
        timestamp: true,
        workspace: false,
        model: true,
        path: true,
        user: true,
        tokens: true,
        status: true,
        score: true
    });
    
    // Column Search Query
    const [columnSearchQuery, setColumnSearchQuery] = useState('');

    const refreshDropdownRef = useRef(null);
    const datePickerRef = useRef(null);
    const columnSelectorRef = useRef(null);

    // Close dropdowns on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (refreshDropdownRef.current && !refreshDropdownRef.current.contains(event.target)) {
                setIsRefreshOpen(false);
            }
            if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
                setIsTimeRangeOpen(false);
            }
            if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
                setIsColumnSelectOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Calculate time frame parameters for request
    const getFromTimestamp = () => {
        const now = Date.now();
        if (timeRange === '15m') return new Date(now - 15 * 60 * 1000).toISOString();
        if (timeRange === '1h') return new Date(now - 60 * 60 * 1000).toISOString();
        if (timeRange === '24h') return new Date(now - 24 * 60 * 60 * 1000).toISOString();
        if (timeRange === 'Yesterday') return new Date(now - 48 * 60 * 60 * 1000).toISOString();
        if (timeRange === '3d') return new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
        if (timeRange === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        if (timeRange === '14d') return new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
        if (timeRange === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        if (timeRange === '90d') return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
        return undefined;
    };

    // Fetch live logs with real-time polling if active
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['liveLogs', timeRange],
        queryFn: () => logsService.getLogs({
            from: getFromTimestamp(),
            limit: 50
        }),
        refetchInterval: isLiveLogs ? 3000 : false
    });

    const getStatusStyle = (status) => {
        const statusStr = String(status);
        if (statusStr.startsWith('2')) return 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/10';
        if (statusStr.startsWith('4')) return 'bg-amber-950/30 text-amber-400 border border-amber-500/10';
        if (statusStr.startsWith('5')) return 'bg-red-950/30 text-red-400 border border-red-500/10';
        return 'bg-neutral-800 text-neutral-400 border border-neutral-700/30';
    };

    // Safe array extract
    const logsList = data?.data || [];

    // Client-side search matching columns
    const filteredLogs = logsList.filter(log => {
        const query = searchQuery.toLowerCase();
        return (
            (columns.path && log.endpoint?.toLowerCase().includes(query)) ||
            (columns.user && log.ip?.toLowerCase().includes(query)) ||
            (columns.status && String(log.statusCode).includes(query)) ||
            (columns.model && (log.model?.toLowerCase() || '').includes(query))
        );
    });

    // Handle Manual Refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refetch();
            toast.success('Logs updated successfully');
        } catch {
            toast.error('Failed to update logs');
        } finally {
            setTimeout(() => setIsRefreshing(false), 600);
        }
    };

    // Clear all filters
    const handleClearFilters = () => {
        setSearchQuery('');
        setTimeRange('15m');
        setColumns({
            timestamp: true,
            workspace: false,
            model: true,
            path: true,
            user: true,
            tokens: true,
            status: true,
            score: true
        });
        toast.success('Filters reset to default');
    };

    // Export Logs to JSON
    const handleExportLogs = () => {
        if (filteredLogs.length === 0) {
            toast.error('No logs available to export');
            return;
        }
        try {
            const dataStr = JSON.stringify(filteredLogs, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = `flowops-logs-${new Date().toISOString()}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            toast.success(`Successfully exported ${filteredLogs.length} logs`);
        } catch {
            toast.error('Failed to export logs');
        }
    };

    const getTimeRangeLabel = () => {
        if (timeRange === '15m') return 'Last 15 minutes';
        if (timeRange === '1h') return 'Last hour';
        if (timeRange === '24h') return 'Last 24 hours';
        if (timeRange === 'Yesterday') return 'Yesterday';
        if (timeRange === '3d') return 'Last 3 days';
        if (timeRange === '7d') return 'Last 7 days';
        if (timeRange === '14d') return 'Last 14 days';
        if (timeRange === '30d') return 'Last 30 days';
        if (timeRange === '90d') return 'Last 90 days';
        if (timeRange === 'Custom') return 'Custom';
        return 'Last 15 minutes';
    };

    // Column Config List mapping
    const columnOptions = [
        { key: 'timestamp', label: 'Timestamp' },
        { key: 'workspace', label: 'Workspace' },
        { key: 'model', label: 'Model' },
        { key: 'path', label: 'Path' },
        { key: 'user', label: 'User' },
        { key: 'tokens', label: 'Tokens (Cost)' },
        { key: 'status', label: 'Status' },
        { key: 'score', label: 'Score' }
    ];

    const filteredColumnOptions = columnOptions.filter(col => 
        col.label.toLowerCase().includes(columnSearchQuery.toLowerCase())
    );

    // Toggle single column
    const toggleColumn = (key) => {
        setColumns(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Select all columns
    const selectAllColumns = () => {
        setColumns({
            timestamp: true,
            workspace: true,
            model: true,
            path: true,
            user: true,
            tokens: true,
            status: true,
            score: true
        });
    };

    // Reset columns to default
    const resetColumns = () => {
        setColumns({
            timestamp: true,
            workspace: false,
            model: true,
            path: true,
            user: true,
            tokens: true,
            status: true,
            score: true
        });
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 relative select-none">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="font-sans">
                    <div className="flex items-center gap-3 mb-1">
                        <Icon name="list" className="w-7 h-7 text-white/40" />
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Logs
                        </h1>
                    </div>
                    <p className="text-[15px] text-neutral-450">
                        Real-time API gateway log ingestion and traces pipeline.
                    </p>
                </div>
                
                <button 
                    onClick={handleExportLogs}
                    className="bg-[#06B6D4] hover:bg-[#08C1E0] text-neutral-950 font-bold px-4 py-2 text-xs tracking-wide rounded-xl flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-[0.98]"
                >
                    <Icon name="download" className="w-3.5 h-3.5"  />
                    <span>Export Logs</span>
                </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-3 mb-6">
                {/* Refresh Trigger + "Switch on Live Logs" Dropdown */}
                <div className="relative" ref={refreshDropdownRef}>
                    <div className="flex items-center bg-[#111111]/40 border border-white/5 rounded-xl divide-x divide-white/5">
                        <button 
                            onClick={handleRefresh}
                            className="px-3 py-2 text-emerald-400 hover:bg-white/5 rounded-l-xl transition-all cursor-pointer flex items-center justify-center"
                            title="Refresh Logs"
                        >
                            <Icon name="refresh" className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}  />
                        </button>
                        <button 
                            onClick={() => setIsRefreshOpen(!isRefreshOpen)}
                            className="px-2 py-2 text-emerald-400/80 hover:bg-white/5 rounded-r-xl transition-all cursor-pointer flex items-center justify-center"
                        >
                            <Icon name="expand_more" className="w-3.5 h-3.5"  />
                        </button>
                    </div>

                    {isRefreshOpen && (
                        <div className="absolute left-0 mt-1.5 w-52 bg-[#18181B] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-all select-none">
                                <span className="text-xs font-semibold text-neutral-300 font-sans">Switch on Live Logs</span>
                                <button 
                                    onClick={() => {
                                        setIsLiveLogs(!isLiveLogs);
                                        toast.success(isLiveLogs ? 'Live streaming paused' : 'Live streaming enabled');
                                    }}
                                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${isLiveLogs ? 'bg-[#06B6D4]' : 'bg-neutral-700'}`}
                                >
                                    <div className={`w-3.5 h-3.5 rounded-full bg-neutral-950 transition-transform duration-200 ${isLiveLogs ? 'translate-x-3.5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Wide Search Input */}
                <div className="relative flex-1 w-full">
                    <Icon name="search" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500"  />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Filter" 
                        className="w-full pl-10 pr-4 py-2 bg-[#111111]/40 border border-white/5 rounded-xl text-[13px] font-sans text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 transition-all"
                    />
                </div>
                
                {/* Filters & Toggles */}
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    {/* Time Range Selector */}
                    <div className="relative font-sans" ref={datePickerRef}>
                        <button
                            onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
                            className={`flex items-center gap-2 bg-[#111111]/40 border px-4 py-2 rounded-xl text-white text-[13px] font-sans hover:bg-white/5 transition-all cursor-pointer select-none ${
                                isTimeRangeOpen ? 'border-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.15)]' : 'border-white/5'
                            }`}
                        >
                            <Icon name="calendar_today" className="w-4 h-4 text-neutral-400"  />
                            <span className="font-semibold text-neutral-200">{getTimeRangeLabel()}</span>
                            <Icon name="expand_more" className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${isTimeRangeOpen ? 'rotate-180' : ''}`}  />
                        </button>

                        {isTimeRangeOpen && (
                            <div className="absolute right-0 mt-1.5 w-52 bg-[#121214] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                {[
                                    { key: '15m', label: 'Last 15 minutes', pro: false },
                                    { key: '1h', label: 'Last hour', pro: false },
                                    { key: '24h', label: 'Last 24 hours', pro: false },
                                    { key: 'Yesterday', label: 'Yesterday', pro: false },
                                    { key: '3d', label: 'Last 3 days', pro: false },
                                    { key: '7d', label: 'Last 7 days', pro: true },
                                    { key: '14d', label: 'Last 14 days', pro: true },
                                    { key: '30d', label: 'Last 30 days', pro: true },
                                    { key: '90d', label: 'Last 90 days', pro: true },
                                    { key: 'Custom', label: 'Custom', pro: false }
                                ].map((item) => (
                                    <button
                                        key={item.key}
                                        onClick={() => {
                                            if (item.pro) {
                                                toast.error("Upgrade to Pro to access older log historical retention!");
                                                return;
                                            }
                                            setTimeRange(item.key);
                                            setIsTimeRangeOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold font-sans transition-colors cursor-pointer ${
                                            timeRange === item.key 
                                                ? 'bg-white/10 text-white' 
                                                : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <span>{item.label}</span>
                                        {item.pro && (
                                            <span className="text-[#FF8A00] border border-[#FF8A00]/30 bg-[#FF8A00]/10 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide flex items-center gap-0.5 shadow-sm">
                                                👑 Pro
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Logs & Traces Segment Toggle */}
                    <div className="flex items-center bg-[#111111]/40 border border-white/5 p-1 rounded-xl gap-1 select-none">
                        <button
                            onClick={() => setActiveTab('Logs')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'Logs'
                                    ? 'bg-white/10 text-white shadow-sm border border-white/5'
                                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Icon name="list" className="w-3.5 h-3.5"  />
                            <span>Logs</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('Traces')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'Traces'
                                    ? 'bg-white/10 text-white shadow-sm border border-white/5'
                                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Icon name="alt_route" className="w-3.5 h-3.5 rotate-90"  />
                            <span>Traces</span>
                        </button>
                    </div>

                    {/* Columns Selector Dropdown (Sliders Icon) */}
                    <div className="relative font-sans" ref={columnSelectorRef}>
                        <button
                            onClick={() => setIsColumnSelectOpen(!isColumnSelectOpen)}
                            className={`border p-2 rounded-xl text-white transition-all cursor-pointer ${
                                isColumnSelectOpen
                                    ? 'text-[#06B6D4] bg-white/5 border-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                                    : 'text-neutral-400 hover:text-white bg-[#111111]/40 border-white/5'
                            }`}
                        >
                            <Icon name="tune" className="w-4 h-4"  />
                        </button>

                        {isColumnSelectOpen && (
                            <div className="absolute right-0 mt-1.5 w-64 bg-[#18181B] border border-white/10 rounded-xl shadow-2xl p-3.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                {/* Search Columns Input */}
                                <div className="relative mb-3">
                                    <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500"  />
                                    <input 
                                        type="text"
                                        placeholder="Search columns..."
                                        value={columnSearchQuery}
                                        onChange={(e) => setColumnSearchQuery(e.target.value)}
                                        className="w-full bg-[#0E0E10] border border-[#06B6D4]/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#06B6D4] font-sans"
                                    />
                                </div>

                                {/* Select All / Reset Actions */}
                                <div className="flex items-center gap-3.5 mb-3 px-1 text-xs select-none">
                                    <button 
                                        onClick={selectAllColumns}
                                        className="text-[#06B6D4] hover:text-cyan-300 font-semibold cursor-pointer transition-colors"
                                    >
                                        Select All
                                    </button>
                                    <button 
                                        onClick={resetColumns}
                                        className="text-neutral-400 hover:text-white font-semibold cursor-pointer transition-colors"
                                    >
                                        Reset
                                    </button>
                                </div>

                                {/* Checkbox Options List */}
                                <div className="space-y-2">
                                    {filteredColumnOptions.length === 0 ? (
                                        <div className="text-[11px] text-neutral-500 text-center py-2">No matching columns found</div>
                                    ) : (
                                        filteredColumnOptions.map((col) => {
                                            const isChecked = columns[col.key];
                                            return (
                                                <div 
                                                    key={col.key}
                                                    onClick={() => toggleColumn(col.key)}
                                                    className="flex items-center gap-2.5 px-1 py-0.5 text-xs text-neutral-300 font-semibold select-none cursor-pointer group hover:text-white"
                                                >
                                                    {/* Custom High-Fidelity Checkbox */}
                                                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                                                        isChecked 
                                                            ? 'bg-[#06B6D4] border border-[#06B6D4]' 
                                                            : 'bg-[#0E0E10] border border-white/20 group-hover:border-white/40'
                                                    }`}>
                                                        {isChecked && (
                                                            <svg className="w-2.5 h-2.5 text-neutral-950 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <span className="font-sans">{col.label}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Empty State / Body Content */}
            {isLoading ? (
                <Card className="flex flex-col items-center justify-center py-20 rounded-xl">
                    <Icon name="refresh" className="w-8 h-8 text-neutral-500 animate-spin mb-4"  />
                    <span className="text-neutral-400 font-sans text-sm font-semibold">Syncing real-time telemetry stream...</span>
                </Card>
            ) : filteredLogs.length === 0 || activeTab === 'Traces' ? (
                /* High Fidelity Centered Empty State */
                <Card className="flex flex-col items-center justify-center py-20 px-6 rounded-xl border border-white/5 bg-[#111111]/40 backdrop-blur-md">
                    <div className="w-14 h-14 rounded-full bg-[#18181B] border border-white/5 shadow-inner flex items-center justify-center text-neutral-400 mb-5">
                        <Icon name="database" className="w-6 h-6 text-neutral-450"  />
                    </div>
                    
                    <h3 className="text-[16px] font-sans font-bold text-white mb-1.5 text-center tracking-tight">
                        {activeTab === 'Logs' ? 'No Logs Found for Selected Filters' : 'No Traces Found for Selected Filters'}
                    </h3>
                    <p className="text-[13px] font-sans text-neutral-400 text-center mb-6 max-w-sm leading-normal">
                        Try adjusting your time period or filters to view relevant logs.
                    </p>

                    <button
                        onClick={handleClearFilters}
                        className="bg-[#06B6D4] hover:bg-[#08C1E0] text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] active:scale-[0.98]"
                    >
                        <span>+ Clear Filters</span>
                    </button>
                </Card>
            ) : (
                /* Logs Table Display (when logs exist and no filters match empty) */
                <Card className="flex flex-col p-0 overflow-hidden rounded-xl border border-white/5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px] text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-400 uppercase tracking-wider w-24">Method</th>
                                    {columns.path && <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Gateway Endpoint</th>}
                                    {columns.model && <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Model Routed</th>}
                                    {columns.workspace && <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Workspace</th>}
                                    {columns.user && <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-400 uppercase tracking-wider">User (IP)</th>}
                                    {columns.tokens && <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-400 uppercase tracking-wider text-right">Tokens (Cost)</th>}
                                    {columns.status && <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-400 uppercase tracking-wider text-center w-24">Status</th>}
                                    {columns.score && <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-400 uppercase tracking-wider text-right w-24">Score</th>}
                                    {columns.timestamp && <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-400 uppercase tracking-wider text-right w-40">Timestamp</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLogs.map((log, i) => (
                                    <tr 
                                        key={i} 
                                        onClick={() => setSelectedLog(log)}
                                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-bold px-2 py-1 rounded border border-white/5 bg-white/5 text-neutral-300 tracking-wide">
                                                {log.method}
                                            </span>
                                        </td>
                                        {columns.path && (
                                            <td className="px-6 py-4 font-mono text-white font-medium">
                                                <div className="flex items-center gap-2">
                                                    {log.endpoint}
                                                    {log.cacheHit && (
                                                        <span className="inline-flex items-center bg-emerald-950/30 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border border-emerald-500/10">
                                                            CACHE HIT
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {columns.model && <td className="px-6 py-4 font-mono text-neutral-400">{log.model || 'none'}</td>}
                                        {columns.workspace && <td className="px-6 py-4 font-sans text-neutral-400">Shared Workspace</td>}
                                        {columns.user && <td className="px-6 py-4 font-mono text-neutral-400">{log.ip || '127.0.0.1'}</td>}
                                        {columns.tokens && (
                                            <td className="px-6 py-4 text-right font-mono text-neutral-400">
                                                <div>{log.tokensUsed || 0}</div>
                                                <div className="text-[10px] text-neutral-500">${((log.tokensUsed || 0) * 0.0000015).toFixed(5)}</div>
                                            </td>
                                        )}
                                        {columns.status && (
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wider ${getStatusStyle(log.statusCode)}`}>
                                                    {log.statusCode}
                                                </span>
                                            </td>
                                        )}
                                        {columns.score && (
                                            <td className="px-6 py-4 text-right font-mono text-emerald-400">
                                                {log.cacheHit ? '1.0' : '0.0'}
                                            </td>
                                        )}
                                        {columns.timestamp && (
                                            <td className="px-6 py-4 text-right font-mono text-neutral-400">
                                                {new Date(log.timestamp).toLocaleTimeString()}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-white/5 p-4 bg-white/[0.01] flex items-center justify-center text-neutral-400 text-[12px] font-mono gap-2 rounded-b-xl">
                        <Icon name="terminal" className="w-4 h-4 text-neutral-500"  />
                        Observability logs successfully synced to PostgreSQL
                    </div>
                </Card>
            )}

            {/* Premium Full-Width Bottom Documentation Card */}
            <div className="bg-[#111111]/40 border border-white/5 backdrop-blur-md hover:border-white/10 transition-all p-4 rounded-xl flex items-center gap-4 mt-6">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-neutral-400 flex items-center justify-center shrink-0">
                    <Icon name="book" className="w-5 h-5 text-neutral-300"  />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-white font-sans leading-normal">Documentation</h4>
                    <p className="text-[12px] text-neutral-400 font-sans leading-relaxed">
                        Learn how to integrate Portkey and start logging your AI requests.{' '}
                        <a 
                            href="https://portkey.ai/docs" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 transition-colors font-semibold inline-flex items-center gap-0.5 hover:underline cursor-pointer"
                        >
                            Learn More →
                        </a>
                    </p>
                </div>
            </div>

            {/* Sidebar Inspector Drawer */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end transition-all">
                    <div className="w-full max-w-[500px] bg-[#111111] border-l border-white/5 h-full shadow-2xl flex flex-col p-6 overflow-y-auto space-y-6">
                        
                        {/* Drawer Header */}
                        <div className="flex justify-between items-start border-b border-white/5 pb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-white/5 bg-white/5 text-neutral-300">
                                        {selectedLog.method}
                                    </span>
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${getStatusStyle(selectedLog.statusCode)}`}>
                                        {selectedLog.statusCode}
                                    </span>
                                </div>
                                <h3 className="text-[16px] font-mono font-bold text-white">{selectedLog.endpoint}</h3>
                            </div>
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="p-1.5 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                            >
                                <Icon name="close" className="w-5 h-5 text-neutral-400 hover:text-white"  />
                            </button>
                        </div>

                        {/* Metrics Panel */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="border border-white/5 bg-white/2 p-3 rounded-xl">
                                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide block mb-1">PROVIDER</span>
                                <span className="font-sans font-bold text-white text-sm capitalize">{selectedLog.provider || 'unknown'}</span>
                            </div>
                            <div className="border border-white/5 bg-white/2 p-3 rounded-xl">
                                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide block mb-1">MODEL ROUTED</span>
                                <span className="font-mono text-white text-xs">{selectedLog.model || 'none'}</span>
                            </div>
                            <div className="border border-white/5 bg-white/2 p-3 rounded-xl col-span-2">
                                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide block mb-1">LATENCY METRIC</span>
                                <span className="font-mono font-bold text-white text-sm">{selectedLog.latencyMs}ms</span>
                            </div>
                        </div>

                        {/* Token Consumption Detail */}
                        <div className="border border-white/5 bg-white/2 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-white font-sans font-bold text-[13px] border-b border-white/5 pb-2">
                                <Icon name="memory" className="w-4 h-4 text-neutral-400"  />
                                Token Consumption Breakdown
                            </div>
                            <div className="flex justify-between items-center text-xs text-neutral-400">
                                <span>Prompt Input Tokens</span>
                                <span className="font-mono text-white font-bold">{selectedLog.promptTokens || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-neutral-400">
                                <span>Completion Output Tokens</span>
                                <span className="font-mono text-white font-bold">{selectedLog.completionTokens || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2 font-bold text-white">
                                <span>Total Transaction Cost Volume</span>
                                <span className="font-mono text-white">{selectedLog.tokensUsed || 0} tokens</span>
                            </div>
                        </div>

                        {/* Caching Status Panel */}
                        <div className="border border-white/5 bg-white/2 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-white font-sans font-bold text-[13px] border-b border-white/5 pb-2">
                                <Icon name="database" className="w-4 h-4 text-emerald-450"  />
                                Edge Cache Status
                            </div>
                            <div className="flex justify-between items-center text-xs text-neutral-400">
                                <span>Served from Edge Cache</span>
                                <span className={`font-sans font-bold ${selectedLog.cacheHit ? 'text-emerald-400' : 'text-neutral-500'}`}>
                                    {selectedLog.cacheHit ? 'YES' : 'NO'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-neutral-450">
                                <span>Redis Response Time</span>
                                <span className="font-mono text-white font-bold">{selectedLog.cacheHit ? '< 10ms' : 'N/A'}</span>
                            </div>
                        </div>

                        {/* Detailed Metadata */}
                        <div className="space-y-2 text-[12px] text-neutral-400 font-sans border-t border-white/5 pt-4">
                            <div className="flex items-center gap-2">
                                <Icon name="calendar_today" className="w-3.5 h-3.5 text-neutral-500"  />
                                <span>Date: {new Date(selectedLog.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Icon name="schedule" className="w-3.5 h-3.5 text-neutral-500"  />
                                <span>Time: {new Date(selectedLog.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Icon name="network" className="w-3.5 h-3.5 text-neutral-500"  />
                                <span>Client IP Address: {selectedLog.ip || '127.0.0.1'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
