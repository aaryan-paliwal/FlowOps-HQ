import { useEffect } from 'react';
import { useParams, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '../state/orgStore';
import { Sidebar } from './Sidebar';

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
                <main className="flex-1 p-10">
                    <Outlet key={activeOrg.id} context={{ orgSlug, activeOrg }} />
                </main>
            </div>
        </div>
    );
}
