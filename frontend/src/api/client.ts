import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Handle 401 responses: clear session and redirect to login
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stored session
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      delete client.defaults.headers.common['Authorization'];
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
