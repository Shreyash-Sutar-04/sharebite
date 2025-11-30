import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  // Always get fresh token from localStorage
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Remove authorization header if no token
    delete config.headers.Authorization;
  }
  
  // For FormData (multipart/form-data), don't set Content-Type manually
  // Let the browser set it with the proper boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  
  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      hasToken: !!token,
      hasAuthHeader: !!config.headers.Authorization
    });
  }
  
  // Store the original URL for error handling
  config.metadata = { startTime: new Date(), url: config.url };
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/login') || 
                          requestUrl.includes('/auth/register');
    const status = error.response?.status;
    const errorData = error.response?.data;
    const errorType = errorData?.error;
    
    // Don't clear auth for database errors - these are temporary issues
    const isDatabaseError = status === 503 || errorType === 'DATABASE_ERROR';
    const isServerError = status >= 500;
    const isOnAuthPage = window.location.pathname.includes('/login') || 
                         window.location.pathname.includes('/register');
    
    // Handle 401 Unauthorized and 403 Forbidden - token expired, invalid, or missing
    if ((status === 401 || status === 403) && !isAuthEndpoint && !isDatabaseError && !isServerError) {
      const token = localStorage.getItem('token');
      
      // Only logout if:
      // 1. We have a token (means it was sent but rejected)
      // 2. We're not on auth pages
      // 3. The error message clearly indicates authentication failure
      if (token && !isOnAuthPage) {
        const errorMessage = errorData?.message?.toLowerCase() || '';
        const isAuthError = errorType === 'UNAUTHORIZED' || 
                           errorType === 'FORBIDDEN' ||
                           errorMessage.includes('token') ||
                           errorMessage.includes('authentication') ||
                           errorMessage.includes('unauthorized') ||
                           errorMessage.includes('forbidden') ||
                           errorMessage.includes('login');
        
        if (isAuthError) {
          console.warn('Authentication failed, clearing session:', {
            status: status,
            url: requestUrl,
            message: errorData?.message,
            errorType: errorType
          });
          
          // Clear auth data
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('userType');
          localStorage.removeItem('userId');
          
          // Redirect to login
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        } else {
          // 401/403 but not clearly an auth error - might be permission issue
          console.warn('Got 401/403 but not clearing session - might be permission issue:', {
            status: status,
            url: requestUrl,
            message: errorData?.message
          });
        }
      }
    }
    
    // Log database errors for debugging
    if (isDatabaseError) {
      console.error('Database connection error:', {
        url: requestUrl,
        message: errorData?.message
      });
    }
    
    return Promise.reject(error);
  }
);

export default api;

