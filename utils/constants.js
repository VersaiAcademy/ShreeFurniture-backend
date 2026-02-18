// API Configuration Constants
// This file contains all API-related constants to prevent undefined variable errors

export const API_CONFIG = {
  // Base URLs with priority order
  // Base URLs with priority order
  BASE_URL: (() => {
    // If we're on the live site, ALWAYS use production backend
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname.includes('srifurniturevillage.com') || hostname.includes('srifurniturevillage.com') || hostname.includes('vercel.app')) {
        return 'https://shreefurniture-backend-production.up.railway.app';
      }
    }

    // Fallback logic
    if (import.meta.env.PROD) {
      const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
      if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        return envUrl;
      }
      return 'https://shreefurniture-backend-production.up.railway.app';
    }

    // Development mode
    return import.meta.env.VITE_API_BASE_URL
      || import.meta.env.VITE_API_URL
      || 'http://localhost:5000';
  })(),

  // Development fallback
  DEV_FALLBACK_URL: 'http://localhost:5000',

  // Timeouts
  DEFAULT_TIMEOUT: 30000,
  HEALTH_CHECK_TIMEOUT: 5000,

  // Headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  },
};

// Environment helpers
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// API Endpoints (centralized to avoid typos)
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  SIGNUP: '/api/auth/signup',
  ADMIN_LOGIN: '/api/auth/admin/login',
  LOGOUT: '/api/auth/logout',
  ME: '/api/auth/me',

  // Products
  PRODUCTS: '/api/products',
  PRODUCT_BY_ID: (id) => `/api/products/${id}`,

  // Cart
  CART: '/api/cart',
  CART_ITEM: (id) => `/api/cart/${id}`,

  // Orders
  ORDERS: '/api/orders',
  ORDER_BY_ID: (id) => `/api/orders/${id}`,

  // Address
  ADDRESS: '/api/address',

  // Categories
  CATEGORIES: '/api/categories',

  // Banners
  BANNERS: '/api/banners',

  // Health check
  HEALTH: '/api/health',
};

// Local storage keys (to prevent typos)
export const STORAGE_KEYS = {
  TOKEN: 'token',
  ADMIN_TOKEN: 'adminToken',
  USER_ID: 'id',
  USERNAME: 'username',
  FIRST_NAME: 'first_name',
  EMAIL: 'email',
  AFTER_LOGIN_REDIRECT: 'afterLoginRedirect',
  CART: 'cart',
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Please login to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful!',
  LOGOUT_SUCCESS: 'Logged out successfully.',
  CART_UPDATED: 'Cart updated successfully.',
  ORDER_PLACED: 'Order placed successfully!',
};