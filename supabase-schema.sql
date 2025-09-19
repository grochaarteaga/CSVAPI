-- Supabase Database Schema for CSV Upload App
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'free',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, is_active)
);

-- Create plan_limits table
CREATE TABLE IF NOT EXISTS plan_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name TEXT NOT NULL UNIQUE,
  max_projects INTEGER NOT NULL DEFAULT 1,
  max_rows_per_csv INTEGER NOT NULL DEFAULT 1000,
  max_csvs_per_project INTEGER NOT NULL DEFAULT 10,
  price_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS max_csvs_per_project INTEGER DEFAULT 10;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS price_cents INTEGER DEFAULT 0;

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create datasets table
CREATE TABLE IF NOT EXISTS datasets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_filename TEXT,
  table_name TEXT NOT NULL,
  schema_json JSONB NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  file_size_bytes INTEGER,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Default Key',
  key_prefix TEXT,
  key_hash TEXT NOT NULL UNIQUE,
  request_count INTEGER NOT NULL DEFAULT 0,
  request_limit_per_month INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create csv_data table for JSONB storage
CREATE TABLE IF NOT EXISTS csv_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create usage_logs table
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  query_params JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default plan limits
INSERT INTO plan_limits (plan_name, max_projects, max_rows_per_csv, max_csvs_per_project, price_cents)
VALUES
  ('free', 1, 1000, 5, 0),
  ('pro', 10, 10000, 50, 9900),
  ('enterprise', 100, 100000, 500, 49900)
ON CONFLICT (plan_name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- user_subscriptions policies
CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- projects policies
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- datasets policies
CREATE POLICY "Users can view datasets from their projects" ON datasets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = datasets.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert datasets to their projects" ON datasets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = datasets.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update datasets from their projects" ON datasets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = datasets.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete datasets from their projects" ON datasets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = datasets.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- api_keys policies
CREATE POLICY "Users can view api keys from their projects" ON api_keys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = api_keys.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert api keys to their projects" ON api_keys
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = api_keys.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update api keys from their projects" ON api_keys
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = api_keys.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete api keys from their projects" ON api_keys
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = api_keys.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- csv_data policies
CREATE POLICY "Users can view csv data from their projects" ON csv_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM datasets
      JOIN projects ON projects.id = datasets.project_id
      WHERE datasets.id = csv_data.dataset_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert csv data to their projects" ON csv_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM datasets
      JOIN projects ON projects.id = datasets.project_id
      WHERE datasets.id = csv_data.dataset_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update csv data from their projects" ON csv_data
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM datasets
      JOIN projects ON projects.id = datasets.project_id
      WHERE datasets.id = csv_data.dataset_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete csv data from their projects" ON csv_data
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM datasets
      JOIN projects ON projects.id = datasets.project_id
      WHERE datasets.id = csv_data.dataset_id
      AND projects.user_id = auth.uid()
    )
  );

-- usage_logs policies
CREATE POLICY "Users can view usage logs from their projects" ON usage_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = usage_logs.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert usage logs" ON usage_logs
  FOR INSERT WITH CHECK (true);

-- Create storage bucket for CSV uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('csv-uploads', 'csv-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for csv-uploads bucket
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'csv-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'csv-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'csv-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'csv-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create function to execute SQL (used by table creator)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_csv_data_dataset_id ON csv_data(dataset_id);
CREATE INDEX IF NOT EXISTS idx_csv_data_row_number ON csv_data(dataset_id, row_number);
CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key_id ON usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);