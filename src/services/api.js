import axios from 'axios';

// Next.js only exposes NEXT_PUBLIC_* to the browser bundle; react-scripts (CRA)
// only exposes REACT_APP_*. Support both so the same .env works under either
// toolchain, then fall back to the local backend.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token refresh or logout on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // A 401 from the login/register endpoints themselves just means "wrong
    // credentials" — that's handled inline by the login form, not a session
    // expiry, so it must not trigger the hard-redirect below.
    const isAuthEndpoint = /\/auth\/(login|register)$/.test(originalRequest?.url || '');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      // Try to refresh token or redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  // Register user
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Login user
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user || response.data));
    }
    return response.data;
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Logout
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
  },
};

export const voucherAPI = {
  create: async (payload) => {
    const response = await api.post('/vouchers/', payload);
    return response.data;
  },

  list: async (params = {}) => {
    const response = await api.get('/vouchers/', { params });
    return response.data;
  },

  update: async (voucherId, payload) => {
    const response = await api.patch(`/vouchers/${voucherId}`, payload);
    return response.data;
  },
};

export const assetAPI = {
  create: async (payload) => (await api.post('/assets/', payload)).data,
  list: async () => (await api.get('/assets/')).data,
  update: async (assetId, payload) => (await api.patch(`/assets/${assetId}`, payload)).data,
  remove: async (assetId) => api.delete(`/assets/${assetId}`),
};

export const assetVoucherAPI = {
  create: async (payload) => (await api.post('/asset-vouchers/', payload)).data,
  list: async () => (await api.get('/asset-vouchers/')).data,
  returnAsset: async (voucherId) => (await api.patch(`/asset-vouchers/${voucherId}/return`)).data,
};

export const reportAPI = {
  getOverview: async () => {
    const response = await api.get('/reports/overview');
    return response.data;
  },

  getSlaConfig: async () => {
    const response = await api.get('/reports/sla-config');
    return response.data;
  },

  updateSlaConfig: async (payload) => {
    const response = await api.put('/reports/sla-config', payload);
    return response.data;
  },

  checkSla: async () => {
    const response = await api.post('/reports/check-sla');
    return response.data;
  },

  getNotifications: async (params = {}) => {
    const response = await api.get('/reports/notifications', { params });
    return response.data;
  },

  markNotificationRead: async (notificationId) => {
    const response = await api.patch(`/reports/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllNotificationsRead: async ({ voucherId = null, targetEmail = null } = {}) => {
    const response = await api.post('/reports/notifications/read-all', {
      voucher_id: voucherId,
      target_email: targetEmail,
    });
    return response.data;
  },
};

export const usersAPI = {
  createUser: async (payload) => {
    const response = await api.post('/users/create-user', payload);
    return response.data;
  },

  listUsers: async () => {
    const response = await api.get('/users/');
    return response.data;
  },

  resetUserPassword: async (userId, newPassword) => {
    const response = await api.patch(`/users/${userId}/reset-password`, { new_password: newPassword });
    return response.data;
  },

  updateUserStatus: async (userId, isActive) => {
    const response = await api.patch(`/users/${userId}/status`, { is_active: isActive });
    return response.data;
  },

  updateUser: async (userId, payload) => {
    const response = await api.patch(`/users/${userId}`, payload);
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },

  listITPersonnel: async () => {
    const response = await api.get('/users/it-personnel');
    return response.data;
  },
};

export const departmentAPI = {
  list: async () => (await api.get('/departments/')).data,
  create: async (name) => (await api.post('/departments/', { name })).data,
  update: async (id, name) => (await api.patch(`/departments/${id}`, { name })).data,
  remove: async (id) => api.delete(`/departments/${id}`),
};

export const stationAPI = {
  list: async () => (await api.get('/stations/')).data,
  create: async (name) => (await api.post('/stations/', { name })).data,
  update: async (id, name) => (await api.patch(`/stations/${id}`, { name })).data,
  remove: async (id) => api.delete(`/stations/${id}`),
};

export const documentAPI = {
  create: async (payload) => {
    const response = await api.post('/documents/', payload);
    return response.data;
  },

  list: async () => {
    const response = await api.get('/documents/');
    return response.data;
  },

  linkToVoucher: async (documentId, voucherId) => {
    const response = await api.patch(`/documents/${documentId}/link`, { voucher_id: voucherId });
    return response.data;
  },

  approve: async (documentId, payload) => {
    const response = await api.patch(`/documents/${documentId}/approve`, payload);
    return response.data;
  },

  sign: async (documentId, payload) => {
    const response = await api.patch(`/documents/${documentId}/sign`, payload);
    return response.data;
  },
};

export const disposalAPI = {
  create: async (payload) => {
    const response = await api.post('/disposal/', payload);
    return response.data;
  },

  list: async () => {
    const response = await api.get('/disposal/');
    return response.data;
  },
};

export const chatbotAPI = {
  ask: async (message, options = {}) => {
    const response = await api.post('/chatbot/ask', { message }, {
      timeout: options.timeoutMs || 25000,
    });
    return response.data;
  },
};

export default api;