
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (erro) => Promise.reject(erro)
);

api.interceptors.response.use(
  (response) => response,

  (erro) => {
    const url = erro.config?.url || '';
    const emLogin = url.includes('/auth/login');

    if (erro.response?.status === 401 && !emLogin) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }

    return Promise.reject(erro);
  }
);

export default api;
