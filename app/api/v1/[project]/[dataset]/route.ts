import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ project: string; dataset: string }> }
) {
  try {
    const resolvedParams = await params;

    // Get API key from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.replace('Bearer ', '');

    // Hash the API key to compare with stored hash
    const encoder = new TextEncoder();
    const apiKeyBytes = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', apiKeyBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const apiKeyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Validate API key and get project
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .select(`
        id,
        project_id,
        request_count,
        request_limit_per_month,
        projects!inner(
          id,
          slug,
          user_id
        )
      `)
      .eq('key_hash', apiKeyHash)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Check rate limit
    if (keyData.request_count >= keyData.request_limit_per_month) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Check if project slug matches
    if ((keyData.projects as any).slug !== resolvedParams.project) {
      return NextResponse.json({ error: 'Invalid project' }, { status: 403 });
    }

    // Get dataset
    const { data: dataset, error: datasetError } = await supabaseAdmin
      .from('datasets')
      .select('id, schema_json, row_count')
      .eq('project_id', keyData.project_id)
      .eq('name', resolvedParams.dataset)
      .single();

    if (datasetError || !dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
    const sort = url.searchParams.get('sort');
    const order = url.searchParams.get('order') || 'asc';
    const search = url.searchParams.get('q');

    // Build query
    let query = supabaseAdmin
      .from('csv_data')
      .select('data, row_number')
      .eq('dataset_id', dataset.id);

    // Apply filters
    const filters: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (!['page', 'limit', 'sort', 'order', 'q'].includes(key)) {
        filters[key] = value;
      }
    });

    // Apply JSONB filters
    for (const [key, value] of Object.entries(filters)) {
      // Use JSONB containment for filtering
      query = query.filter('data', '@>', JSON.stringify({ [key]: value }));
    }

    // Apply search if provided
    if (search) {
      // Search across all JSONB fields (case-insensitive)
      query = query.filter('data', 'ilike', `%${search}%`);
    }

    // Apply sorting
    if (sort) {
      // Sort by JSONB field
      query = query.order('data->' + sort, { ascending: order === 'asc' });
    } else {
      // Default sort by row_number
      query = query.order('row_number', { ascending: true });
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: rows, error: queryError } = await query;

    if (queryError) {
      console.error('Query error:', queryError);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    // Update API key usage
    await supabaseAdmin
      .from('api_keys')
      .update({
        request_count: keyData.request_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', keyData.id);

    // Log the request
    await supabaseAdmin
      .from('usage_logs')
      .insert({
        api_key_id: keyData.id,
        project_id: keyData.project_id,
        endpoint: `/api/v1/${resolvedParams.project}/${resolvedParams.dataset}`,
        method: 'GET',
        status_code: 200,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        query_params: Object.fromEntries(url.searchParams)
      });

    // Format response
    return NextResponse.json({
      success: true,
      data: rows?.map(r => r.data) || [],
      pagination: {
        page,
        limit,
        total: dataset.row_count,
        totalPages: Math.ceil(dataset.row_count / limit)
      },
      meta: {
        columns: Object.keys(dataset.schema_json || {}),
        types: dataset.schema_json
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}