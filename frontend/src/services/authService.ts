import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const isMobileDevice = (): boolean => {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const isInstagramBrowser = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('instagram') || ua.includes('fban') || ua.includes('fbav');
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  let token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

  if (!token && isInstagramBrowser()) {
    token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Client-Type'] = isInstagramBrowser()
    ? 'instagram'
    : isMobileDevice()
    ? 'mobile'
    : 'desktop';
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (email: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, refreshToken } = response.data;

      if (!token) throw new Error('No token received');

      try {
        localStorage.setItem('authToken', token);
      } catch {
        sessionStorage.setItem('authToken', token);
      }

      if (refreshToken) {
        try {
          localStorage.setItem('refreshToken', refreshToken);
        } catch {
          sessionStorage.setItem('refreshToken', refreshToken);
        }
      }

      return response.data;
    } catch (error: any) {
      console.error('[Login] Error:', error.message);
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('[Logout] Error:', error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
    }
  },

  getToken: (): string | null => {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  },

  isAuthenticated: (): boolean => {
    return !!authService.getToken();
  },
};

export default apiClient;
