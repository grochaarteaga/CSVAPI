import Papa from 'papaparse'
import { detectColumnType, sanitizeColumnName, ColumnSchema, ColumnType } from './type-detector'

export interface ParsedCSV {
  data: any[]
  schema: ColumnSchema[]
  rowCount: number
  errors: string[]
}

export async function parseCSV(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const { data: rawData, errors } = results
          const data = rawData as any[]

          if (errors.length > 0) {
            const errorMessages = errors.map(err => err.message)
            resolve({
              data: [],
              schema: [],
              rowCount: 0,
              errors: errorMessages
            })
            return
          }

          if (data.length === 0) {
            resolve({
              data: [],
              schema: [],
              rowCount: 0,
              errors: ['No data found in CSV']
            })
            return
          }

          // Get column names from first row
          const columns = Object.keys(data[0] as object)

          // Detect schema
          const schema: ColumnSchema[] = columns.map(col => {
            const values = data.map((row: any) => row[col])
            const type = detectColumnType(values)
            const nullable = values.some(val => val === null || val === undefined || val === '')

            return {
              name: sanitizeColumnName(col),
              type,
              nullable
            }
          })

          resolve({
            data,
            schema,
            rowCount: data.length,
            errors: []
          })
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}