import { create } from 'zustand';
import { useOrgStore } from './orgStore';

export const useAuthStore = create((set) => ({
    token: localStorage.getItem('flowops_access_token'),
    user: (() => {
        try {
            const storedUser = localStorage.getItem('flowops_user');
            return storedUser ? JSON.parse(storedUser) : null;
        } catch {
            return null;
        }
    })(),
    isAuthenticated: !!localStorage.getItem('flowops_access_token'),

    setAuth: (token, user) => {
        localStorage.setItem('flowops_access_token', token);
        if (user) {
            localStorage.setItem('flowops_user', JSON.stringify(user));
            if (user.company) {
                useOrgStore.getState().syncPrimaryWorkspaceName(user.company);
            }
        }
        set({ token, user: user || null, isAuthenticated: true });
    },

    updateUser: (updates) => set((state) => {
        const updatedUser = { ...state.user, ...updates };
        localStorage.setItem('flowops_user', JSON.stringify(updatedUser));
        if (updates.company) {
            useOrgStore.getState().syncPrimaryWorkspaceName(updates.company);
        }
        return { user: updatedUser };
    }),

    logout: () => {
        localStorage.removeItem('flowops_access_token');
        localStorage.removeItem('flowops_user');
        useOrgStore.getState().resetOrganisations();
        set({ token: null, user: null, isAuthenticated: false });
    },
}));
