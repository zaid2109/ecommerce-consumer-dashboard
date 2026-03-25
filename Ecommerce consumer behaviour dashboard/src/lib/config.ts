/**
 * Centralized configuration for the frontend application.
 */

export const APP_CONFIG = {
  // API Configuration
  API: {
    BASE_URL: process.env.NEXT_PUBLIC_BACKEND_URL || '',
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
  },

  // Upload Configuration
  UPLOAD: {
    MAX_FILE_SIZE_MB: 50,
    MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
    SUPPORTED_FORMATS: ['.csv', '.xlsx', '.xls'],
    CHUNK_SIZE: 4 * 1024 * 1024, // 4MB chunks
  },

  // Cache Configuration
  CACHE: {
    DATASET_TTL: 5 * 60 * 1000, // 5 minutes
    ANALYTICS_TTL: 10 * 60 * 1000, // 10 minutes
    METADATA_TTL: 2 * 60 * 1000, // 2 minutes
  },

  // UI Configuration
  UI: {
    PAGINATION: {
      DEFAULT_PAGE_SIZE: 20,
      MAX_PAGE_SIZE: 100,
    },
    DATATABLE: {
      DEFAULT_ROWS_PER_PAGE: 10,
      MAX_ROWS_PER_PAGE: 50,
    },
    CHARTS: {
      ANIMATION_DURATION: 0, // Disabled for performance
      RESPONSIVE_BREAKPOINTS: {
        SM: 640,
        MD: 768,
        LG: 1024,
        XL: 1280,
      },
    },
  },

  // Analytics Configuration
  ANALYTICS: {
    POLLING_INTERVAL: 2000, // 2 seconds
    MAX_POLLING_TIME: 5 * 60 * 1000, // 5 minutes
    SAMPLE_SIZE: 20000,
    MAX_CLV_ROWS: 10000,
    DEFAULT_TIMEOUT: 25000, // 25 seconds
  },

  // Job Configuration
  JOBS: {
    POLLING_INTERVAL: 1000, // 1 second
    MAX_JOB_AGE: 3600 * 1000, // 1 hour
    CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutes
  },

  // Error Handling
  ERRORS: {
    MAX_RETRIES: 3,
    RETRY_DELAY_BASE: 1000,
    RETRY_DELAY_MAX: 10000,
    BACKOFF_MULTIPLIER: 2,
  },

  // Feature Flags
  FEATURES: {
    ENABLE_ANALYTICS: true,
    ENABLE_ML_PREDICTIONS: true,
    ENABLE_REAL_TIME_UPDATES: true,
    ENABLE_ADVANCED_FILTERS: true,
    ENABLE_EXPORT: true,
    ENABLE_VERSIONING: true,
  },

  // Performance
  PERFORMANCE: {
    DEBOUNCE_DELAY: 300,
    THROTTLE_DELAY: 100,
    LAZY_LOAD_THRESHOLD: 200,
    VIRTUAL_SCROLL_THRESHOLD: 1000,
  },

  // Security
  SECURITY: {
    TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  },

  // Monitoring
  MONITORING: {
    ERROR_REPORTING: true,
    PERFORMANCE_TRACKING: true,
    USER_ANALYTICS: true,
    LOG_LEVEL: 'info' as 'debug' | 'info' | 'warn' | 'error',
  },
};

// Environment-specific overrides
export const ENV_CONFIG = {
  development: {
    ...APP_CONFIG,
    API: {
      ...APP_CONFIG.API,
      BASE_URL: 'http://localhost:8000',
    },
    MONITORING: {
      ...APP_CONFIG.MONITORING,
      LOG_LEVEL: 'debug' as const,
    },
  },
  production: {
    ...APP_CONFIG,
    MONITORING: {
      ...APP_CONFIG.MONITORING,
      LOG_LEVEL: 'warn' as const,
    },
  },
  test: {
    ...APP_CONFIG,
    API: {
      ...APP_CONFIG.API,
      TIMEOUT: 5000,
    },
    FEATURES: {
      ...APP_CONFIG.FEATURES,
      ENABLE_ANALYTICS: false,
      ENABLE_ML_PREDICTIONS: false,
    },
  },
};

// Get current environment config
export function getConfig() {
  const env = process.env.NODE_ENV || 'development';
  return ENV_CONFIG[env as keyof typeof ENV_CONFIG] || ENV_CONFIG.development;
}

// Helper functions
export function getApiUrl(path: string): string {
  const config = getConfig();
  const baseUrl = config.API.BASE_URL;
  return `${baseUrl}${path}`;
}

export function isFeatureEnabled(feature: keyof typeof APP_CONFIG.FEATURES): boolean {
  const config = getConfig();
  return config.FEATURES[feature];
}

export function getCacheTTL(type: keyof typeof APP_CONFIG.CACHE): number {
  const config = getConfig();
  return config.CACHE[type];
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function validateFileSize(file: File): { valid: boolean; error?: string } {
  const config = getConfig();
  if (file.size > config.UPLOAD.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds ${config.UPLOAD.MAX_FILE_SIZE_MB}MB limit`,
    };
  }
  return { valid: true };
}

export function validateFileType(file: File): { valid: boolean; error?: string } {
  const config = getConfig();
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!config.UPLOAD.SUPPORTED_FORMATS.includes(fileExtension)) {
    return {
      valid: false,
      error: `Unsupported file type. Supported formats: ${config.UPLOAD.SUPPORTED_FORMATS.join(', ')}`,
    };
  }
  return { valid: true };
}
