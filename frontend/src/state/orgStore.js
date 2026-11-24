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
                if (user.id) {
                    const onboardingStr = localStorage.getItem(`flowops_onboarding_${user.id}`);
                    if (onboardingStr) {
                        const onboarding = JSON.parse(onboardingStr);
                        if (onboarding.orgName) return onboarding.orgName;
                    }
                }
            }
        } catch {
            // Ignore malformed or unavailable localStorage during boot.
        }
        return 'My Workspace';
    };

    const buildDefaultState = () => ({
        organisations: [
            {
                id: 1,
                name: getInitialWorkspaceName(),
                slug: 'workspace-1',
                useCase: 'Company',
                environment: 'Production',
            },
        ],
        activeOrgId: 1,
    });

    const savedState = (() => {
        try {
            const data = localStorage.getItem('flowops_org_state');
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.organisations && parsed.organisations.length > 0) {
                    if (parsed.organisations[0].id === 1) {
                        parsed.organisations[0].name = getInitialWorkspaceName();
                        parsed.organisations[0].slug = 'workspace-1';
                    }
                    parsed.organisations = parsed.organisations.map((org) => ({
                        ...org,
                        slug: org.slug || generateSlug(org.name, org.id),
                    }));
                }
                return parsed;
            }
        } catch {
            // Ignore malformed saved workspace state.
        }
        return null;
    })();

    const initialState = buildDefaultState();

    return {
        ...(savedState || initialState),

        syncPrimaryWorkspaceName: (name) => set((state) => {
            if (!name || !name.trim()) return state;
            const trimmed = name.trim();
            const newState = {
                ...state,
                organisations: state.organisations.map((org) =>
                    org.id === 1 ? { ...org, name: trimmed, slug: 'workspace-1' } : org
                ),
            };
            try { localStorage.setItem('flowops_org_state', JSON.stringify(newState)); } catch {
                // Ignore localStorage write failures.
            }
            return newState;
        }),

        resetOrganisations: () => {
            try { localStorage.removeItem('flowops_org_state'); } catch {
                // Ignore localStorage failures.
            }
            set({
                organisations: [
                    {
                        id: 1,
                        name: 'My Workspace',
                        slug: 'workspace-1',
                        useCase: 'Company',
                        environment: 'Production',
                    },
                ],
                activeOrgId: 1,
            });
        },

        addOrganisation: (org) => set((state) => {
            const newOrg = {
                ...org,
                slug: org.slug || generateSlug(org.name, org.id),
            };
            const newState = {
                organisations: [...state.organisations, newOrg],
                activeOrgId: newOrg.id,
            };
            try { localStorage.setItem('flowops_org_state', JSON.stringify(newState)); } catch {
                // Ignore localStorage write failures.
            }
            return newState;
        }),

        updateOrganisation: (id, updates) => set((state) => {
            const newState = {
                ...state,
                organisations: state.organisations.map((org) => {
                    if (org.id === id) {
                        const updatedOrg = { ...org, ...updates };
                        // Keep primary workspace slug anchored to 'workspace-1' for backend route parity
                        if (org.id !== 1 && updates.name && updates.name !== org.name) {
                            updatedOrg.slug = generateSlug(updates.name, id);
                        }
                        return updatedOrg;
                    }
                    return org;
                }),
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
        }),
    };
});
