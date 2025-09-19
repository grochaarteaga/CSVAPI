import { createClient } from '@supabase/supabase-js'
import { ColumnSchema, ColumnType } from './type-detector'

export interface TableCreationResult {
  tableName: string
  success: boolean
  error?: string
}

export function generateTableName(projectId: string): string {
  const timestamp = Date.now()
  return `csv_${projectId}_${timestamp}`
}

export function mapTypeToPostgres(type: ColumnType): string {
  switch (type) {
    case 'INTEGER':
      return 'INTEGER'
    case 'FLOAT':
      return 'DECIMAL(15,6)'
    case 'DATE':
      return 'DATE'
    case 'BOOLEAN':
      return 'BOOLEAN'
    case 'TEXT':
    default:
      return 'TEXT'
  }
}

export async function createTable(
  tableName: string,
  schema: ColumnSchema[]
): Promise<TableCreationResult> {
  try {
    // Check if CSV has an 'id' column and rename it to avoid conflicts
    const processedSchema = schema.map(col => {
      if (col.name.toLowerCase() === 'id') {
        return { ...col, name: 'csv_id' } // Rename CSV 'id' column to 'csv_id'
      }
      return col
    })

    // Build CREATE TABLE SQL
    const columns = processedSchema.map(col => {
      const postgresType = mapTypeToPostgres(col.type)
      const nullable = col.nullable ? '' : ' NOT NULL'
      return `"${col.name}" ${postgresType}${nullable}`
    }).join(', ')

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id SERIAL PRIMARY KEY,
        ${columns},
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    console.log('Creating table with SQL:', createTableSQL)

    // Use service role client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Method 1: Try using direct PostgreSQL function with correct parameter name
    try {
      const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        sql_query: createTableSQL
      })

      if (!error) {
        console.log(`Table ${tableName} created successfully using exec_sql`)
        // Add a small delay to allow schema cache to update
        await new Promise(resolve => setTimeout(resolve, 1000))
        return { tableName, success: true }
      }

      console.log('exec_sql failed, trying alternative method:', error.message)
    } catch (e) {
      console.log('exec_sql not available, trying alternative method')
    }

    // Method 2: Use Supabase's built-in SQL execution via REST API with correct parameter
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!
        },
        body: JSON.stringify({
          sql_query: createTableSQL
        })
      })

      if (response.ok) {
        console.log(`Table ${tableName} created successfully using REST API`)
        // Add a small delay to allow schema cache to update
        await new Promise(resolve => setTimeout(resolve, 1000))
        return { tableName, success: true }
      }

      const errorData = await response.text()
      console.log('REST API failed:', errorData)
    } catch (e) {
      console.log('REST API method failed:', e)
    }

    // Method 3: Fallback - try to execute via a simple query
    // This might work if the table creation is simple enough
    try {
      // For simple cases, we can try direct table creation
      // This is a last resort and might not work for complex schemas
      const simpleSQL = createTableSQL.replace(/"/g, '') // Remove quotes for simpler tables

      const { error } = await supabaseAdmin.from(tableName).select('*').limit(1)
      if (error && error.message.includes('does not exist')) {
        // Table doesn't exist, we need to create it
        console.log('Table does not exist, attempting creation via alternative method')

        // This is a workaround - we'll return an error asking user to create table manually
        return {
          tableName,
          success: false,
          error: `Unable to create table automatically. Please run this SQL in your Supabase SQL Editor:\n\n${createTableSQL}`
        }
      }

      console.log(`Table ${tableName} appears to exist or was created`)
      return { tableName, success: true }
    } catch (e) {
      console.log('All methods failed')
    }

    return {
      tableName,
      success: false,
      error: 'Failed to create table using all available methods'
    }
  } catch (error) {
    console.error('Table creation exception:', error)
    return {
      tableName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}