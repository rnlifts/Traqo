import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// A plain axios instance with NO interceptors — used for public/shared endpoints
// that must work for anonymous visitors without risking accidental logout redirects
const publicClient = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default publicClient;
