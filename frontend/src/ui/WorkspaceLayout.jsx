import { useEffect } from 'react';
import { useParams, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '../state/orgStore';
import { Sidebar } from './Sidebar';
import { ThemeSelectorButton } from './ThemeSelectorButton';
import { ThemeSwitcherModal } from './ThemeSwitcherModal';

export default function WorkspaceLayout() {
    const { orgSlug } = useParams();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { organisations, activeOrgId, setActiveOrgId } = useOrgStore();

    const activeOrg = organisations.find(o => o.slug === orgSlug) || organisations.find(o => o.id === activeOrgId);

    useEffect(() => {
        // If the slug in the URL is valid, ensure the store is synced
        if (activeOrg && activeOrg.id !== activeOrgId) {
            setActiveOrgId(activeOrg.id);
        }
        
        // Critial step: Clear React Query cache so data is forcefully refetched for the new workspace
        queryClient.invalidateQueries();
    }, [orgSlug, activeOrg, activeOrgId, setActiveOrgId, queryClient]);

    // If we have an invalid slug (doesn't exist in our orgs), redirect to the primary org
    if (!activeOrg || activeOrg.slug !== orgSlug) {
        // Find the fallback org slug (either current active, or the first one)
        const fallbackSlug = activeOrg?.slug || organisations[0]?.slug;
        if (!fallbackSlug) return null; // loading or edge case
        
        // Strip the invalid slug and replace it with the fallback
        // e.g. /ws/invalid/analytics -> /ws/valid/analytics
        const newPath = location.pathname.replace(`/ws/${orgSlug}`, `/ws/${fallbackSlug}`);
        return <Navigate to={newPath} replace />;
    }

    return (
        <div className="min-h-screen text-white flex">
            <Sidebar orgSlug={orgSlug} />
            <div className="flex-1 flex flex-col min-h-screen min-w-0">
                {/* Global Workspace Top Bar with Theme Selector */}
                <header className="h-14 border-b border-[rgba(153,27,27,0.18)] px-8 flex items-center justify-between bg-[#060507]/75 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                        <span className="text-[13px] font-bold text-white font-sans tracking-tight">
                            {activeOrg?.name}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
                            {activeOrg?.environment || 'Production'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeSelectorButton />
                    </div>
                </header>
                <main className="flex-1 p-8">
                    <Outlet key={activeOrg.id} context={{ orgSlug, activeOrg }} />
                </main>
                <ThemeSwitcherModal />
            </div>
        </div>
    );
}
