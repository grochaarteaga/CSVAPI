import { supabaseAdmin } from '../supabase/admin'
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
    // Build CREATE TABLE SQL
    const columns = schema.map(col => {
      const postgresType = mapTypeToPostgres(col.type)
      const nullable = col.nullable ? '' : ' NOT NULL'
      return `"${col.name}" ${postgresType}${nullable}`
    }).join(', ')

    const sql = `
      CREATE TABLE "${tableName}" (
        id SERIAL PRIMARY KEY,
        ${columns},
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Execute via Supabase admin
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql })

    if (error) {
      return {
        tableName,
        success: false,
        error: error.message
      }
    }

    return {
      tableName,
      success: true
    }
  } catch (error) {
    return {
      tableName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}