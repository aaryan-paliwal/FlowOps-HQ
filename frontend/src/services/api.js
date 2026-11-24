import axios from 'axios';

// Initialize the core Axios instance for backend synchronization
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 10000 // Standard 10s timeout for gateway reliability
});

// Request Interceptor: Automatically inject Auth Tokens and Workspace Context
api.interceptors.request.use(
    (config) => {
        // Read the token from local storage
        const token = localStorage.getItem('flowops_access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Extract workspace slug from URL for bulletproof multi-tab isolation
        const pathParts = window.location.pathname.split('/');
        if (pathParts[1] === 'ws' && pathParts[2]) {
            config.headers['X-Workspace-Slug'] = pathParts[2];
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Global Error Handling
api.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        if (error.response) {
            if (error.response.status === 401) {
                localStorage.removeItem('flowops_access_token');
            }
            return Promise.reject(error.response.data);
        }
        return Promise.reject(error);
    }
);

// Export standard API service modules
export const authService = {
    login: (credentials) => api.post('/auth/login', credentials),
    register: (data) => api.post('/auth/register', data),
    getProfile: () => api.get('/users/me'),
    updateProfile: (data) => api.put('/users/me', data)
};

export const analyticsService = {
    getOverview: (params) => api.get('/analytics/overview', { params }),
    getTraffic: (params) => api.get('/analytics/traffic', { params }),
    getEndpoints: (params) => api.get('/analytics/endpoints', { params }),
    getErrors: (params) => api.get('/analytics/errors', { params }),
    getLlmMetrics: (params) => api.get('/analytics/llm-metrics', { params }),
    getCacheMetrics: (params) => api.get('/analytics/cache', { params }),
    getCacheEntries: (params) => api.get('/analytics/cache/entries', { params }),
    clearCache: (params) => api.delete('/analytics/cache', { params }),
    getUserMetrics: (params) => api.get('/analytics/users', { params }),
    getFeedbackMetrics: (params) => api.get('/analytics/feedback', { params }),
    getSummaryMetrics: (params) => api.get('/analytics/summary', { params })
};

export const logsService = {
    getLogs: (params) => api.get('/logs', { params })
};

export const apisService = {
    listApis: () => api.get('/apis'),
    createApi: (data) => api.post('/apis', data),
    updateApi: (id, data) => api.put(`/apis/${id}`, data),
    testAlert: (id, data = {}) => api.post(`/apis/${id}/test-alert`, data),
    deleteApi: (id) => api.delete(`/apis/${id}`)
};

export const apiKeysService = {
    listKeys: (params) => api.get('/keys', { params }),
    createKey: (data) => api.post('/keys', data),
    revokeKey: (id) => api.delete(`/keys/${id}`)
};

export default api;
