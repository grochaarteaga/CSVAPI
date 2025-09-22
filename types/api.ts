// API Response Types

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: PaginationInfo;
  meta?: ResponseMeta;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ResponseMeta {
  columns: string[];
  types: Record<string, string>;
  queryTime: number;
}

// API Request Types

export interface ApiQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string; // search query
  fields?: string[]; // field selection
  [key: string]: any; // dynamic filters
}

// Dataset Types

export interface DatasetInfo {
  id: string;
  name: string;
  original_filename: string;
  schema_json: Record<string, string>;
  row_count: number;
  file_size_bytes: number;
  file_url: string;
  created_at: string;
}

// API Key Types

export interface ApiKeyInfo {
  id: string;
  project_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  request_count: number;
  request_limit_per_month: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

// Usage Log Types

export interface UsageLog {
  id: string;
  api_key_id: string;
  project_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  ip_address: string;
  user_agent: string;
  query_params: Record<string, any>;
  error_message: string | null;
  created_at: string;
}

// Error Types

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Validation Types

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Rate Limit Types

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  isExceeded: boolean;
}

// Analytics Types

export interface UsageStats {
  totalRequests: number;
  monthlyRequests: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    avgResponseTime: number;
  }>;
}

export interface QuotaUsage {
  used: number;
  limit: number;
  percentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
}