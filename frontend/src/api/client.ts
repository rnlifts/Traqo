import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default client;
