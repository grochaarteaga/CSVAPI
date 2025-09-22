import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ApiResponse {
  success: boolean;
  data?: any[];
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    columns: string[];
    types: Record<string, string>;
    queryTime: number;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ project: string; dataset: string }> }
): Promise<NextResponse<ApiResponse>> {
  const startTime = Date.now();

  try {
    const resolvedParams = await params;

    // Extract and validate API key
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid API key' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);

    // Hash API key for comparison
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const apiKeyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Validate API key and get associated project
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .select(`
        id,
        project_id,
        request_count,
        request_limit_per_month,
        projects!inner (
          id,
          slug,
          user_id
        )
      `)
      .eq('key_hash', apiKeyHash)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      await logRequest(null, null, resolvedParams, 401, 'Invalid API key');
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive API key' },
        { status: 401 }
      );
    }

    // Check rate limits
    if (keyData.request_count >= keyData.request_limit_per_month) {
      await logRequest(keyData.id, keyData.project_id, resolvedParams, 429, 'Rate limit exceeded');
      return NextResponse.json(
        { success: false, error: 'Monthly API limit exceeded' },
        { status: 429 }
      );
    }

    // Verify project slug matches
    if ((keyData.projects as any).slug !== resolvedParams.project) {
      await logRequest(keyData.id, keyData.project_id, resolvedParams, 403, 'Project mismatch');
      return NextResponse.json(
        { success: false, error: 'API key does not match project' },
        { status: 403 }
      );
    }

    // Get dataset information
    const { data: dataset, error: datasetError } = await supabaseAdmin
      .from('datasets')
      .select('id, name, schema_json, row_count')
      .eq('project_id', keyData.project_id)
      .eq('name', resolvedParams.dataset)
      .single();

    if (datasetError || !dataset) {
      await logRequest(keyData.id, keyData.project_id, resolvedParams, 404, 'Dataset not found');
      return NextResponse.json(
        { success: false, error: 'Dataset not found' },
        { status: 404 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = parseQueryParams(url.searchParams);

    // Build and execute query
    const { data: rows, error: queryError, count } = await executeQuery(
      dataset.id,
      queryParams,
      dataset.schema_json
    );

    if (queryError) {
      await logRequest(keyData.id, keyData.project_id, resolvedParams, 500, queryError.message);
      return NextResponse.json(
        { success: false, error: 'Query execution failed' },
        { status: 500 }
      );
    }

    // Update API key usage
    await supabaseAdmin
      .from('api_keys')
      .update({
        request_count: keyData.request_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', keyData.id);

    // Log successful request
    const queryTime = Date.now() - startTime;
    await logRequest(
      keyData.id,
      keyData.project_id,
      resolvedParams,
      200,
      null,
      queryParams,
      queryTime
    );

    // Format and return response
    const response: ApiResponse = {
      success: true,
      data: rows?.map(r => r.data) || [],
      pagination: {
        page: queryParams.page,
        limit: queryParams.limit,
        total: count || dataset.row_count,
        totalPages: Math.ceil((count || dataset.row_count) / queryParams.limit)
      },
      meta: {
        columns: Object.keys(dataset.schema_json || {}),
        types: dataset.schema_json || {},
        queryTime
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('API endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Helper function to parse query parameters
function parseQueryParams(searchParams: URLSearchParams) {
  const params: any = {
    page: parseInt(searchParams.get('page') || '1'),
    limit: Math.min(parseInt(searchParams.get('limit') || '100'), 1000),
    sort: searchParams.get('sort'),
    order: searchParams.get('order') || 'asc',
    search: searchParams.get('q'),
    fields: searchParams.get('fields')?.split(',').map(f => f.trim()),
    filters: {} as Record<string, any>
  };

  // Extract filters (any param not in reserved list)
  const reserved = ['page', 'limit', 'sort', 'order', 'q', 'fields'];
  searchParams.forEach((value, key) => {
    if (!reserved.includes(key)) {
      // Handle range filters (e.g., price_min, price_max)
      if (key.endsWith('_min') || key.endsWith('_max')) {
        const field = key.replace(/_min$|_max$/, '');
        if (!params.filters[field]) params.filters[field] = {};
        params.filters[field][key.endsWith('_min') ? 'min' : 'max'] = value;
      } else {
        params.filters[key] = value;
      }
    }
  });

  return params;
}

// Helper function to execute database query
async function executeQuery(
  datasetId: string,
  params: any,
  schema: Record<string, string>
) {
  let query = supabaseAdmin
    .from('csv_data')
    .select('data, row_number', { count: 'exact' })
    .eq('dataset_id', datasetId);

  // Apply filters
  for (const [field, value] of Object.entries(params.filters)) {
    if (typeof value === 'object' && value !== null) {
      // Range filter
      const rangeVal = value as { min?: string; max?: string };
      if (rangeVal.min) {
        query = query.gte(`data->>${field}`, rangeVal.min);
      }
      if (rangeVal.max) {
        query = query.lte(`data->>${field}`, rangeVal.max);
      }
    } else {
      // Exact match filter
      query = query.eq(`data->>${field}`, value);
    }
  }

  // Apply search across all text fields
  if (params.search) {
    const searchConditions = Object.keys(schema)
      .filter(key => schema[key] === 'text' || schema[key] === 'string')
      .map(key => `data->>${key}.ilike.%${params.search}%`)
      .join(',');

    if (searchConditions) {
      query = query.or(searchConditions);
    }
  }

  // Apply sorting
  if (params.sort) {
    const column = `data->>${params.sort}`;
    query = query.order(column, { ascending: params.order === 'asc' });
  } else {
    query = query.order('row_number', { ascending: true });
  }

  // Apply pagination
  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  query = query.range(from, to);

  return query;
}

// Helper function to log API requests
async function logRequest(
  apiKeyId: string | null,
  projectId: string | null,
  params: { project: string; dataset: string },
  statusCode: number,
  errorMessage: string | null = null,
  queryParams: any = null,
  responseTime: number = 0
) {
  try {
    await supabaseAdmin
      .from('usage_logs')
      .insert({
        api_key_id: apiKeyId,
        project_id: projectId,
        endpoint: `/api/v1/${params.project}/${params.dataset}`,
        method: 'GET',
        status_code: statusCode,
        response_time_ms: responseTime,
        error_message: errorMessage,
        query_params: queryParams
      });
  } catch (error) {
    console.error('Failed to log request:', error);
  }
}