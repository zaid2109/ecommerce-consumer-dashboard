/**
 * Centralized error mapping for user-friendly messages.
 */

export type ErrorCategory = 'network' | 'validation' | 'auth' | 'processing' | 'upload' | 'analytics' | 'general';

export interface MappedError {
  userMessage: string;
  category: ErrorCategory;
  actionable: boolean;
  suggestions?: string[];
}

const errorMappings: Record<string, MappedError> = {
  // Network errors
  'Failed to fetch': {
    userMessage: 'Unable to connect to the server. Please check your internet connection.',
    category: 'network',
    actionable: true,
    suggestions: ['Check your internet connection', 'Try refreshing the page', 'Contact support if the issue persists']
  },
  'Request failed: 401': {
    userMessage: 'Your session has expired. Please log in again.',
    category: 'auth',
    actionable: true,
    suggestions: ['Log in again to continue']
  },
  'Request failed: 403': {
    userMessage: 'You don\'t have permission to access this resource.',
    category: 'auth',
    actionable: true,
    suggestions: ['Contact your administrator for access']
  },
  'Request failed: 404': {
    userMessage: 'The requested resource was not found.',
    category: 'general',
    actionable: false
  },
  'Request failed: 413': {
    userMessage: 'The file is too large. Please upload a smaller file.',
    category: 'upload',
    actionable: true,
    suggestions: ['Compress your file', 'Split into smaller files', 'Maximum file size is 50MB']
  },
  'Request failed: 429': {
    userMessage: 'Too many requests. Please wait a moment and try again.',
    category: 'network',
    actionable: true,
    suggestions: ['Wait a few seconds before trying again']
  },
  'Request failed: 500': {
    userMessage: 'Server error occurred. Our team has been notified.',
    category: 'general',
    actionable: false,
    suggestions: ['Try again later', 'Contact support if the issue persists']
  },

  // Upload errors
  'File exceeds 50MB': {
    userMessage: 'File size exceeds the 50MB limit.',
    category: 'upload',
    actionable: true,
    suggestions: ['Compress your file', 'Split into smaller files']
  },
  'Could not parse CSV': {
    userMessage: 'Unable to read the CSV file. Please check the file format.',
    category: 'validation',
    actionable: true,
    suggestions: ['Ensure file is a valid CSV', 'Check for special characters', 'Try exporting as UTF-8']
  },
  'No usable columns found': {
    userMessage: 'No valid columns were found in the file.',
    category: 'validation',
    actionable: true,
    suggestions: ['Check column headers', 'Ensure data is properly formatted', 'Remove empty columns']
  },
  'CSV has no rows': {
    userMessage: 'The CSV file appears to be empty.',
    category: 'validation',
    actionable: true,
    suggestions: ['Check if the file contains data', 'Verify the file format']
  },

  // Analytics errors
  'Customer and revenue columns required': {
    userMessage: 'Customer ID and Revenue columns are required for this analysis.',
    category: 'analytics',
    actionable: true,
    suggestions: ['Ensure your data has customer and revenue columns', 'Check column mapping in settings']
  },
  'Dataset not found': {
    userMessage: 'The selected dataset is not available.',
    category: 'analytics',
    actionable: true,
    suggestions: ['Refresh the datasets list', 'Select a different dataset']
  },
  'Clean table not found': {
    userMessage: 'Dataset processing incomplete. Please wait and try again.',
    category: 'processing',
    actionable: true,
    suggestions: ['Wait for processing to complete', 'Refresh the page']
  },

  // Processing errors
  'Segmentation failed': {
    userMessage: 'Customer segmentation analysis failed.',
    category: 'processing',
    actionable: false,
    suggestions: ['Try again later', 'Contact support if the issue persists']
  },
  'CLV computation failed': {
    userMessage: 'Customer lifetime value calculation failed.',
    category: 'processing',
    actionable: false,
    suggestions: ['Try again later', 'Contact support if the issue persists']
  },
  'Anomalies failed': {
    userMessage: 'Anomaly detection analysis failed.',
    category: 'processing',
    actionable: false,
    suggestions: ['Try again later', 'Contact support if the issue persists']
  }
};

export function mapError(error: Error | string): MappedError {
  const errorMessage = error instanceof Error ? error.message : error;
  
  // Try exact match first
  if (errorMappings[errorMessage]) {
    return errorMappings[errorMessage];
  }
  
  // Try partial matches
  for (const [key, mapping] of Object.entries(errorMappings)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(errorMessage.toLowerCase())) {
      return mapping;
    }
  }
  
  // Check for common patterns
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return {
      userMessage: 'Network connection issue. Please check your internet connection.',
      category: 'network',
      actionable: true,
      suggestions: ['Check your internet connection', 'Try refreshing the page']
    };
  }
  
  if (errorMessage.includes('timeout')) {
    return {
      userMessage: 'Request timed out. Please try again.',
      category: 'network',
      actionable: true,
      suggestions: ['Try again', 'Check your internet connection']
    };
  }
  
  if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
    return {
      userMessage: 'You don\'t have permission to perform this action.',
      category: 'auth',
      actionable: true,
      suggestions: ['Contact your administrator']
    };
  }
  
  // Default fallback
  return {
    userMessage: 'An unexpected error occurred. Please try again.',
    category: 'general',
    actionable: false,
    suggestions: ['Try refreshing the page', 'Contact support if the issue persists']
  };
}

export function getErrorIcon(category: ErrorCategory): string {
  switch (category) {
    case 'network': return '🌐';
    case 'validation': return '⚠️';
    case 'auth': return '🔒';
    case 'processing': return '⚙️';
    case 'upload': return '📁';
    case 'analytics': return '📊';
    default: return '❌';
  }
}

export function getErrorColor(category: ErrorCategory): string {
  switch (category) {
    case 'network': return 'text-blue-600';
    case 'validation': return 'text-yellow-600';
    case 'auth': return 'text-red-600';
    case 'processing': return 'text-orange-600';
    case 'upload': return 'text-purple-600';
    case 'analytics': return 'text-indigo-600';
    default: return 'text-gray-600';
  }
}
