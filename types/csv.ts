import { ColumnSchema, ColumnType } from '../lib/csv/type-detector'

export interface ParsedCSV {
  data: any[]
  schema: ColumnSchema[]
  rowCount: number
  errors: string[]
}

export interface UploadResult {
  success: boolean
  datasetId?: string
  tableName?: string
  apiKey?: string
  apiEndpoint?: string
  error?: string
}

export interface Project {
  id: string
  name: string
  slug: string
  description: string
  datasetCount: number
  apiCallsThisMonth: number
  createdAt: string
}

export type { ColumnSchema, ColumnType }