import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCSV } from '../../../lib/csv/parser'
import { createTable, generateTableName } from '../../../lib/csv/table-creator'
import { slugify } from '../../../lib/utils/slugify'
import { nanoid } from 'nanoid'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const schemaOverride = formData.get('schema') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB allowed.' }, { status: 400 })
    }

    // Check user's subscription and project count
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('plan_name, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    const planName = subscription?.plan_name || 'free'

    const { data: planLimits, error: planError } = await supabase
      .from('plan_limits')
      .select('*')
      .eq('plan_name', planName)
      .single()

    if (planError || !planLimits) {
      return NextResponse.json({ error: 'Failed to get plan limits' }, { status: 500 })
    }

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id)

    if (projectsError) {
      return NextResponse.json({ error: 'Failed to check project limit' }, { status: 500 })
    }

    if (projects && projects.length >= planLimits.max_projects) {
      return NextResponse.json({ error: 'Project limit reached. Upgrade your plan.' }, { status: 400 })
    }

    // Check CSV file count for this project (if updating existing project)
    // For now, we'll create new projects, so this is fine

    // Parse CSV
    const parsedData = await parseCSV(file)

    if (parsedData.errors.length > 0) {
      return NextResponse.json({ error: `CSV parsing failed: ${parsedData.errors.join(', ')}` }, { status: 400 })
    }

    if (parsedData.rowCount > planLimits.max_rows_per_csv) {
      return NextResponse.json({ error: `Too many rows. Maximum ${planLimits.max_rows_per_csv} rows allowed for your plan.` }, { status: 400 })
    }

    // Use provided schema or detected schema
    const schema = schemaOverride ? JSON.parse(schemaOverride) : parsedData.schema

    // Create project
    const projectName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
    const projectSlug = slugify(projectName)

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: projectName,
        slug: projectSlug,
        description: `Project for ${file.name}`,
        is_active: true
      })
      .select()
      .single()

    if (projectError) {
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }

    // Upload file to storage
    const fileName = `${user.id}/${project.id}/${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('csv-uploads')
      .upload(fileName, file)

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // Create dynamic table
    const tableName = generateTableName(project.id)
    const tableResult = await createTable(tableName, schema)

    if (!tableResult.success) {
      return NextResponse.json({ error: `Failed to create table: ${tableResult.error}` }, { status: 500 })
    }

    // Insert data into table
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: insertError } = await supabaseAdmin
      .from(tableName)
      .insert(parsedData.data)

    if (insertError) {
      return NextResponse.json({ error: 'Failed to insert data' }, { status: 500 })
    }

    // Save dataset metadata
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .insert({
        project_id: project.id,
        table_name: tableName,
        schema_json: schema,
        row_count: parsedData.rowCount,
        file_url: uploadData.path
      })
      .select()
      .single()

    if (datasetError) {
      return NextResponse.json({ error: 'Failed to save dataset metadata' }, { status: 500 })
    }

    // Generate API key
    const apiKeyValue = `csv_${nanoid(32)}`
    const { data: apiKey, error: apiKeyError } = await supabase
      .from('api_keys')
      .insert({
        project_id: project.id,
        key_hash: apiKeyValue // In production, hash this
      })
      .select()
      .single()

    if (apiKeyError) {
      return NextResponse.json({ error: 'Failed to generate API key' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      datasetId: dataset.id,
      tableName,
      apiKey: apiKeyValue,
      apiEndpoint: `/api/data/${project.slug}`,
      projectId: project.id
    })

  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}