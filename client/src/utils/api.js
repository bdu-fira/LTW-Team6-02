import axios from 'axios';

/**
 * Centralized API Client
 * - Tự động lấy baseURL từ biến môi trường (VITE_API_URL)
 * - Tự động gắn Authorization header nếu có token trong localStorage
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Tự động gắn token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: Xử lý lỗi toàn cục
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Session expired or unauthorized. Clearing auth state.');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('token');
      localStorage.removeItem('lastActivity');
      window.dispatchEvent(new Event('userUpdated'));
      
      // Dispatch an event so components like Header can show the login modal
      window.dispatchEvent(new CustomEvent('openLoginModal', {
        detail: { message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }
      }));
    }
    return Promise.reject(error);
  }
);

export default api;
