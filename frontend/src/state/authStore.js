import { create } from 'zustand';

// FlowOps HQ Developer Mockup User Data
const MOCK_USER = {
    id: "user_fop_1x9k2m",
    name: "FlowOps HQ Developer",
    email: "developer@flowops.dev",
    role: "admin",
    company: "FlowOps HQ",
    subscriptionTier: "PRO",
    location: "US" // Default location
};

export const useAuthStore = create((set) => ({
    token: localStorage.getItem('flowops_access_token'),
    user: (() => {
        const storedUser = localStorage.getItem('flowops_user');
        return storedUser ? JSON.parse(storedUser) : null;
    })(),
    isAuthenticated: !!localStorage.getItem('flowops_access_token'),
    
    setAuth: (token, user) => {
        localStorage.setItem('flowops_access_token', token);
        if (user) localStorage.setItem('flowops_user', JSON.stringify(user));
        set({ token, user: user || MOCK_USER, isAuthenticated: true });
    },
    
    updateUser: (updates) => set((state) => {
        const updatedUser = { ...state.user, ...updates };
        localStorage.setItem('flowops_user', JSON.stringify(updatedUser));
        return { user: updatedUser };
    }),
    
    logout: () => {
        localStorage.removeItem('flowops_access_token');
        localStorage.removeItem('flowops_user');
        set({ token: null, user: null, isAuthenticated: false });
    }
}));
