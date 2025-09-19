import { parse } from 'csv-parse'
import { detectColumnType, sanitizeColumnName, ColumnSchema, ColumnType } from './type-detector'

export interface ParsedCSV {
  data: any[]
  schema: ColumnSchema[]
  rowCount: number
  errors: string[]
}

export async function parseCSV(file: File): Promise<ParsedCSV> {
  try {
    // Convert File to buffer
    const buffer = await file.arrayBuffer()
    const csvString = Buffer.from(buffer).toString('utf-8')

    return new Promise((resolve, reject) => {
      parse(csvString, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, records) => {
        if (err) {
          reject(err)
          return
        }

        try {
          const data = records as any[]

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
      })
    })
  } catch (error) {
    return Promise.reject(error)
  }
}