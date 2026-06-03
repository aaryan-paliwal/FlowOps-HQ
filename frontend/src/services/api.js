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
        return response.data; // Immediately return the data payload
    },
    (error) => {
        const mockFallbackEnabled = import.meta.env.VITE_ENABLE_MOCK_FALLBACK === 'true';
        if (!mockFallbackEnabled) {
            if (error.response) {
                if (error.response.status === 401) {
                    console.error("Authentication expired or invalid. Please sign in again.");
                    localStorage.removeItem('flowops_access_token');
                }
                return Promise.reject(error.response.data);
            }
            return Promise.reject(error);
        }

        // Demo fallback data, enabled only through VITE_ENABLE_MOCK_FALLBACK=true.
        const url = error.config?.url;
        
        if (url === '/keys') {
            return Promise.resolve({ data: { keys: [{ id: 'key_1', name: 'Production Main', keyPrefix: 'sk_live_mock_key_prefix_only', revoked: false, createdAt: new Date() }] } });
        }
        
        if (url === '/apis') {
            return Promise.resolve({ data: { apis: [
                { id: 'api_1', name: 'OpenAI GPT-4 Gateway', provider: 'openai', status: 'active', requests: 12450 },
                { id: 'api_2', name: 'Anthropic Claude-3', provider: 'anthropic', status: 'active', requests: 8320 }
            ] } });
        }

        if (url === '/analytics/overview') {
            return Promise.resolve({ data: { totalRequests: 1245000, totalCost: 432.50, averageLatency: 45, errorRate: 0.12 } });
        }

        if (url && url.includes('/analytics/')) {
            const chartData = [
                { time: "12:00", value: 120 }, { time: "02:00", value: 250 }, { time: "04:00", value: 410 },
                { time: "06:00", value: 380 }, { time: "08:00", value: 890 }, { time: "10:00", value: 1100 },
                { time: "12:00", value: 1450 }, { time: "02:00", value: 1300 }, { time: "04:00", value: 1800 },
                { time: "06:00", value: 2100 }, { time: "08:00", value: 2450 }, { time: "10:00", value: 2800 },
                { time: "12:00", value: 3100 }
            ];
            return Promise.resolve({ data: chartData });
        }

        if (error.response) {
            if (error.response.status === 401) {
                console.error("Authentication expired or invalid. Please sign in again.");
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
    deleteApi: (id) => api.delete(`/apis/${id}`)
};

export const apiKeysService = {
    listKeys: (params) => api.get('/keys', { params }),
    createKey: (data) => api.post('/keys', data),
    revokeKey: (id) => api.delete(`/keys/${id}`)
};

export default api;
