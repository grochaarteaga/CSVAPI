export interface User {
  id: string
  email: string
  full_name?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  slug: string
  created_at: string
}

export interface Dataset {
  id: string
  project_id: string
  table_name: string
  schema_json: any
  row_count: number
  file_url?: string
  created_at: string
}

export interface ApiKey {
  id: string
  project_id: string
  key_hash: string
  last_used?: string
  request_count: number
  created_at: string
}

export interface UsageLog {
  id: string
  api_key_id?: string
  project_id?: string
  endpoint: string
  method: string
  status_code?: number
  response_time_ms?: number
  ip_address?: string
  user_agent?: string
  query_params?: any
  error_message?: string
  created_at: string
}

export interface PlanLimit {
  id: string
  plan_name: string
  max_projects: number
  max_csv_files: number
  max_api_calls_per_month: number
  max_rows_per_csv: number
  price_cents: number
  created_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_name: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  current_period_start: string
  current_period_end: string
  is_active: boolean
  created_at: string
  updated_at: string
}