import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { nanoid } from 'nanoid';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file size (10MB limit for free tier)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
    }

    // Read and parse CSV
    const text = await file.text();
    const parseResult = Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Sanitize column names
        return header
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/^_+|_+$/g, '');
      }
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing failed',
        details: parseResult.errors
      }, { status: 400 });
    }

    const data = parseResult.data;
    const columns = parseResult.meta.fields || [];

    // Check row count limit (10,000 for free tier)
    if (data.length > 10000) {
      return NextResponse.json({
        error: 'Too many rows. Free tier supports up to 10,000 rows'
      }, { status: 400 });
    }

    // Detect column types
    const schema = detectSchema(data, columns);

    // Create or get project
    let project;
    if (projectId) {
      const { data: existingProject } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      project = existingProject;
    } else {
      // Check existing projects count
      const { count: projectCount } = await supabaseAdmin
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // If user has reached project limit (1 for free tier), use existing project
      if (projectCount && projectCount >= 1) {
        const { data: existingProject } = await supabaseAdmin
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (existingProject) {
          project = existingProject;
        } else {
          return NextResponse.json({ error: 'Failed to access existing project' }, { status: 500 });
        }
      } else {
        // Create new project
        const projectSlug = `project-${nanoid(8)}`;
        const { data: newProject, error: projectError } = await supabaseAdmin
          .from('projects')
          .insert({
            user_id: user.id,
            name: file.name.replace('.csv', ''),
            slug: projectSlug,
            description: `Uploaded from ${file.name}`
          })
          .select()
          .single();

        if (projectError) {
          console.error('Project creation error:', projectError);
          return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
        }

        project = newProject;
      }
    }

    // Upload original CSV to storage
    const storagePath = `${user.id}/${project.id}/${file.name}`;
    const { error: storageError } = await supabaseAdmin.storage
      .from('csv-uploads')
      .upload(storagePath, file, {
        contentType: 'text/csv',
        upsert: true
      });

    if (storageError) {
      console.error('Storage error:', storageError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Create dataset record
    const datasetName = file.name.replace('.csv', '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const { data: dataset, error: datasetError } = await supabaseAdmin
      .from('datasets')
      .insert({
        project_id: project.id,
        name: datasetName,
        original_filename: file.name,
        table_name: `csv_data`, // Always use the same table
        schema_json: schema,
        row_count: data.length,
        file_size_bytes: file.size,
        file_url: storagePath
      })
      .select()
      .single();

    if (datasetError) {
      console.error('Dataset error:', datasetError);
      return NextResponse.json({ error: 'Failed to create dataset' }, { status: 500 });
    }

    // Store data in csv_data table as JSONB
    const csvRows = data.map((row: any, index: number) => ({
      dataset_id: dataset.id,
      row_number: index + 1,
      data: row
    }));

    // Insert in batches of 500 to avoid size limits
    const batchSize = 500;
    for (let i = 0; i < csvRows.length; i += batchSize) {
      const batch = csvRows.slice(i, i + batchSize);
      const { error: insertError } = await supabaseAdmin
        .from('csv_data')
        .insert(batch);

      if (insertError) {
        console.error('Insert error:', insertError);
        // Clean up on failure
        await supabaseAdmin.from('datasets').delete().eq('id', dataset.id);
        return NextResponse.json({ error: 'Failed to store CSV data' }, { status: 500 });
      }
    }

    // Generate API key for this project
    const apiKey = `csv_live_${nanoid(32)}`;
    const apiKeyPrefix = apiKey.substring(0, 12) + '...';

    // Simple hash for MVP (in production, use bcrypt)
    const encoder = new TextEncoder();
    const apiKeyBytes = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', apiKeyBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const apiKeyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { error: apiKeyError } = await supabaseAdmin
      .from('api_keys')
      .insert({
        project_id: project.id,
        name: 'Default Key',
        key_prefix: apiKeyPrefix,
        key_hash: apiKeyHash,
        request_limit_per_month: 1000
      });

    if (apiKeyError) {
      console.error('API key error:', apiKeyError);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        slug: project.slug
      },
      dataset: {
        id: dataset.id,
        name: dataset.name,
        rows: data.length,
        columns: columns.length
      },
      api: {
        endpoint: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/${project.slug}/${datasetName}`,
        key: apiKey,
        example: `curl -H "Authorization: Bearer ${apiKey}" ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/${project.slug}/${datasetName}`
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function detectSchema(data: any[], columns: string[]) {
  const schema: any = {};

  for (const column of columns) {
    const samples = data
      .slice(0, Math.min(100, data.length))
      .map(row => row[column])
      .filter(val => val != null && val !== '');

    schema[column] = detectType(samples);
  }

  return schema;
}

function detectType(samples: any[]): string {
  if (samples.length === 0) return 'text';

  // Check if all samples are booleans
  if (samples.every(s =>
    typeof s === 'boolean' ||
    ['true', 'false', 'yes', 'no', '1', '0'].includes(String(s).toLowerCase())
  )) {
    return 'boolean';
  }

  // Check if all samples are integers
  if (samples.every(s => Number.isInteger(Number(s)))) {
    return 'integer';
  }

  // Check if all samples are numbers
  if (samples.every(s => !isNaN(Number(s)))) {
    return 'number';
  }

  // Check if all samples are dates
  if (samples.every(s => !isNaN(Date.parse(s)))) {
    return 'date';
  }

  // Check if all samples are emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (samples.every(s => emailRegex.test(String(s)))) {
    return 'email';
  }

  // Check if all samples are URLs
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  if (samples.every(s => urlRegex.test(String(s)))) {
    return 'url';
  }

  return 'text';
}