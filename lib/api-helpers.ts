import { ApiQueryParams, ValidationResult, ApiError } from '../types/api';

/**
 * Generate a secure API key
 */
export async function generateApiKey(): Promise<string> {
  const { nanoid } = await import('nanoid');
  return `csv_live_${nanoid(32)}`;
}

/**
 * Hash an API key for secure storage
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate API query parameters
 */
export function validateQueryParams(params: URLSearchParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate pagination
  const page = params.get('page');
  if (page && (isNaN(Number(page)) || Number(page) < 1)) {
    errors.push('Page must be a positive integer');
  }

  const limit = params.get('limit');
  if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 1000)) {
    errors.push('Limit must be between 1 and 1000');
  }

  // Validate sort order
  const order = params.get('order');
  if (order && !['asc', 'desc'].includes(order.toLowerCase())) {
    errors.push('Order must be "asc" or "desc"');
  }

  // Validate field selection
  const fields = params.get('fields');
  if (fields) {
    const fieldList = fields.split(',').map(f => f.trim());
    if (fieldList.length > 50) {
      warnings.push('Field selection limited to 50 fields');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitize search query to prevent injection
 */
export function sanitizeSearchQuery(query: string): string {
  // Remove potentially dangerous characters
  return query.replace(/[<>'"&]/g, '').trim();
}

/**
 * Create standardized API error response
 */
export function createApiError(
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): ApiError & { statusCode: number } {
  return {
    code,
    message,
    details,
    statusCode
  };
}

/**
 * Format response data with consistent structure
 */
export function formatApiResponse<T>(
  data: T,
  meta?: {
    columns?: string[];
    types?: Record<string, string>;
    queryTime?: number;
  }
) {
  return {
    success: true,
    data,
    ...(meta && { meta })
  };
}

/**
 * Parse and validate range filters (e.g., price_min=10&price_max=100)
 */
export function parseRangeFilters(params: URLSearchParams): Record<string, { min?: string; max?: string }> {
  const ranges: Record<string, { min?: string; max?: string }> = {};

  params.forEach((value, key) => {
    if (key.endsWith('_min')) {
      const field = key.replace(/_min$/, '');
      if (!ranges[field]) ranges[field] = {};
      ranges[field].min = value;
    } else if (key.endsWith('_max')) {
      const field = key.replace(/_max$/, '');
      if (!ranges[field]) ranges[field] = {};
      ranges[field].max = value;
    }
  });

  return ranges;
}

/**
 * Build Supabase query filters from API parameters
 */
export function buildQueryFilters(params: ApiQueryParams, schema: Record<string, string>) {
  const filters: Record<string, any> = {};

  // Extract regular filters (exclude reserved parameters)
  Object.entries(params).forEach(([key, value]) => {
    const reserved = ['page', 'limit', 'sort', 'order', 'q', 'fields'];
    if (!reserved.includes(key) && value !== undefined && value !== null) {
      filters[key] = value;
    }
  });

  return filters;
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1
  };
}

/**
 * Generate cache headers for API responses
 */
export function getCacheHeaders(maxAge: number = 300) {
  return {
    'Cache-Control': `public, max-age=${maxAge}`,
    'CDN-Cache-Control': `max-age=${maxAge}`,
    'Vercel-CDN-Cache-Control': `max-age=${maxAge}`
  };
}

/**
 * Check if request is within rate limits
 */
export function checkRateLimit(
  currentUsage: number,
  limit: number,
  windowMs: number = 30 * 24 * 60 * 60 * 1000 // 30 days
): { allowed: boolean; remaining: number; resetTime: Date } {
  const resetTime = new Date(Date.now() + windowMs);
  const remaining = Math.max(0, limit - currentUsage);

  return {
    allowed: currentUsage < limit,
    remaining,
    resetTime
  };
}

/**
 * Generate API endpoint URL
 */
export function buildApiUrl(
  baseUrl: string,
  project: string,
  dataset: string,
  params?: Record<string, any>
): string {
  const url = new URL(`${baseUrl}/api/v1/${project}/${dataset}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Extract client information from request
 */
export function getClientInfo(request: Request) {
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const ipAddress = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'Unknown';

  return {
    userAgent,
    ipAddress: ipAddress.split(',')[0].trim(), // Get first IP if multiple
    timestamp: new Date().toISOString()
  };
}

/**
 * Validate dataset name format
 */
export function validateDatasetName(name: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push('Dataset name cannot be empty');
  }

  if (name.length > 100) {
    errors.push('Dataset name cannot exceed 100 characters');
  }

  // Check for valid characters (alphanumeric, underscore, dash)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    errors.push('Dataset name can only contain letters, numbers, underscores, and dashes');
  }

  // Check for reserved words
  const reserved = ['api', 'admin', 'system', 'test', 'temp'];
  if (reserved.includes(name.toLowerCase())) {
    errors.push('Dataset name cannot be a reserved word');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Generate example API calls for documentation
 */
export function generateApiExamples(baseUrl: string, project: string, dataset: string) {
  const baseEndpoint = `${baseUrl}/api/v1/${project}/${dataset}`;

  return {
    basic: `curl -H "Authorization: Bearer YOUR_API_KEY" ${baseEndpoint}`,
    pagination: `curl -H "Authorization: Bearer YOUR_API_KEY" "${baseEndpoint}?page=2&limit=50"`,
    filtering: `curl -H "Authorization: Bearer YOUR_API_KEY" "${baseEndpoint}?category=Electronics"`,
    sorting: `curl -H "Authorization: Bearer YOUR_API_KEY" "${baseEndpoint}?sort=price&order=desc"`,
    search: `curl -H "Authorization: Bearer YOUR_API_KEY" "${baseEndpoint}?q=laptop"`,
    range: `curl -H "Authorization: Bearer YOUR_API_KEY" "${baseEndpoint}?price_min=100&price_max=500"`
  };
}