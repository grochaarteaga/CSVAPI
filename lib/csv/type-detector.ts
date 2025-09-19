export type ColumnType = 'INTEGER' | 'FLOAT' | 'DATE' | 'BOOLEAN' | 'TEXT'

export interface ColumnSchema {
  name: string
  type: ColumnType
  nullable: boolean
}

export function detectColumnType(values: any[]): ColumnType {
  if (values.length === 0) return 'TEXT'

  // Sample first 100 non-empty values
  const sampleValues = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 100)

  if (sampleValues.length === 0) return 'TEXT'

  // Check if all are dates FIRST (before numbers to avoid date strings being classified as numbers)
  if (sampleValues.every(val => isValidDate(val))) {
    return 'DATE'
  }

  // Check if all are booleans
  if (sampleValues.every(val => isValidBoolean(val))) {
    return 'BOOLEAN'
  }

  // Check if all are integers (but exclude date-like strings)
  if (sampleValues.every(val => isValidInteger(val))) {
    return 'INTEGER'
  }

  // Check if all are numbers
  if (sampleValues.every(val => isValidNumber(val))) {
    return 'FLOAT'
  }

  // Default to TEXT
  return 'TEXT'
}

function isValidInteger(value: any): boolean {
  if (typeof value === 'number') return Number.isInteger(value)
  if (typeof value === 'string') {
    // Exclude strings that look like dates (contain hyphens, slashes, or other date separators)
    if (value.includes('-') || value.includes('/') || value.includes('.')) {
      return false
    }
    const num = parseFloat(value)
    return !isNaN(num) && Number.isInteger(num) && num.toString() === value.trim()
  }
  return false
}

function isValidNumber(value: any): boolean {
  if (typeof value === 'number') return !isNaN(value)
  if (typeof value === 'string') {
    const num = parseFloat(value)
    return !isNaN(num)
  }
  return false
}

function isValidDate(value: any): boolean {
  if (!value) return false
  const str = String(value).trim()

  // Common date formats
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY or DD/MM/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY or DD-MM-YYYY
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
  ]

  if (!datePatterns.some(pattern => pattern.test(str))) return false

  const date = new Date(str)
  return !isNaN(date.getTime())
}

function isValidBoolean(value: any): boolean {
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return value === 0 || value === 1
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    return ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(lower)
  }
  return false
}

export function sanitizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    || 'column'
}