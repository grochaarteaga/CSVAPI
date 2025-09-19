'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import { Dropzone } from '../../../components/upload/dropzone'
import { UploadProgress } from '../../../components/upload/upload-progress'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { parseCSV } from '../../../lib/csv/parser'
import { ParsedCSV } from '../../../types/csv'
import { ArrowLeft, Upload as UploadIcon } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const router = useRouter()

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)

    try {
      const result = await parseCSV(selectedFile)
      if (result.errors.length > 0) {
        toast.error(`Parsing error: ${result.errors.join(', ')}`)
        return
      }
      setParsedData(result)
    } catch (error: any) {
      toast.error(`Failed to parse CSV: ${error.message}`)
    }
  }

  const handleUpload = async () => {
    if (!file || !parsedData) return

    setUploading(true)
    setUploadProgress(0)

    try {
      let { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Debug: Check token expiration
      const expiresAt = new Date(session.expires_at! * 1000)
      const now = new Date()
      console.log('Token expires at:', expiresAt)
      console.log('Current time:', now)
      console.log('Token expired:', expiresAt < now)

      if (expiresAt < now) {
        console.log('Token expired, attempting refresh...')
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError || !refreshData.session) {
          throw new Error('Session expired. Please log in again.')
        }

        console.log('Token refreshed successfully')
        // Update the session with refreshed data
        session = refreshData.session
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('schema', JSON.stringify(parsedData.schema))

      console.log('Sending upload request with token:', session.access_token.substring(0, 20) + '...')

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      const result = await response.json()
      toast.success('CSV uploaded successfully!')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Upload CSV</h1>
          <p className="text-gray-600 mt-1">Upload and process your CSV file</p>
        </div>
      </div>

      {!file ? (
        <Card>
          <CardHeader>
            <CardTitle>Select CSV File</CardTitle>
            <CardDescription>
              Choose a CSV file to upload. Maximum size: 10MB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dropzone onFileSelect={handleFileSelect} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>File Selected</CardTitle>
              <CardDescription>
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null)
                  setParsedData(null)
                }}
              >
                Choose Different File
              </Button>
            </CardContent>
          </Card>

          {parsedData && (
            <Card>
              <CardHeader>
                <CardTitle>Data Preview</CardTitle>
                <CardDescription>
                  First 5 rows of your data ({parsedData.rowCount} total rows)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {parsedData.schema.map((col) => (
                          <th
                            key={col.name}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {col.name} ({col.type})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {parsedData.data.slice(0, 5).map((row, index) => (
                        <tr key={index}>
                          {parsedData.schema.map((col) => (
                            <td key={col.name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {String(row[col.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {uploading && (
            <Card>
              <CardContent className="pt-6">
                <UploadProgress progress={uploadProgress} status="Uploading..." />
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!parsedData || uploading}
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload CSV'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}