import { create } from 'zustand';

// Helper to generate URL-friendly slugs from workspace names
export const generateSlug = (name, id) => {
    const baseSlug = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    return baseSlug ? `${baseSlug}-${id}` : `workspace-${id}`;
};

export const useOrgStore = create((set) => {
    const getInitialWorkspaceName = () => {
        try {
            const userStr = localStorage.getItem('flowops_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.company) return user.company;
            }
            const onboardingStr = localStorage.getItem('flowops_onboarding_default') || localStorage.getItem('flowops_onboarding_user_fop_1x9k2m');
            if (onboardingStr) {
                const onboarding = JSON.parse(onboardingStr);
                if (onboarding.orgName) return onboarding.orgName;
            }
        } catch {
            // Ignore malformed or unavailable localStorage during boot.
        }
        return "My Workspace";
    };

    // Try to load from localStorage first
    const savedState = (() => {
        try {
            const data = localStorage.getItem('flowops_org_state');
            if (data) {
                const parsed = JSON.parse(data);
                // Force sync the primary workspace (id: 1) with the current auth/onboarding name
                if (parsed.organisations && parsed.organisations.length > 0) {
                    if (parsed.organisations[0].id === 1) {
                        parsed.organisations[0].name = getInitialWorkspaceName();
                    }
                    // Ensure all saved orgs have slugs (backwards compatibility)
                    parsed.organisations = parsed.organisations.map(org => ({
                        ...org,
                        slug: org.slug || generateSlug(org.name, org.id)
                    }));
                }
                return parsed;
            }
        } catch {
            // Ignore malformed saved workspace state.
        }
        return null;
    })();

    // Force override for testing
    const initialState = {
        organisations: [
            { 
                id: 1, 
                name: "Workspace A", 
                slug: "workspace-a",
                useCase: "Company", 
                environment: "Production" 
            }
        ],
        activeOrgId: 1
    };

    return {
        ...(savedState || initialState),
        
        addOrganisation: (org) => set((state) => {
            const newOrg = {
                ...org,
                slug: org.slug || generateSlug(org.name, org.id)
            };
            const newState = {
                organisations: [...state.organisations, newOrg],
                activeOrgId: newOrg.id
            };
            try { localStorage.setItem('flowops_org_state', JSON.stringify(newState)); } catch {
                // Ignore localStorage write failures.
            }
            return newState;
        }),
        
        updateOrganisation: (id, updates) => set((state) => {
            const newState = {
                ...state,
                organisations: state.organisations.map(org => {
                    if (org.id === id) {
                        const updatedOrg = { ...org, ...updates };
                        // If name was updated, regenerate slug
                        if (updates.name && updates.name !== org.name) {
                            updatedOrg.slug = generateSlug(updates.name, id);
                        }
                        return updatedOrg;
                    }
                    return org;
                })
            };
            try { localStorage.setItem('flowops_org_state', JSON.stringify(newState)); } catch {
                // Ignore localStorage write failures.
            }
            return newState;
        }),
        
        setActiveOrgId: (id) => set((state) => {
            const newState = { ...state, activeOrgId: id };
            try { localStorage.setItem('flowops_org_state', JSON.stringify(newState)); } catch {
                // Ignore localStorage write failures.
            }
            return newState;
        })
    };
});
