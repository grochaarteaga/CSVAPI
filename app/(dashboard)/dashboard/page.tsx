'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { Project } from '../../../types/csv'
import Link from 'next/link'
import { Plus, Database, Activity } from 'lucide-react'

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch projects with datasets and API keys
     const { data: projectsData } = await supabase
       .from('projects')
       .select(`
         id,
         name,
         slug,
         created_at,
         datasets (
           id,
           name,
           row_count
         ),
         api_keys (
           id,
           key_prefix,
           request_count,
           request_limit_per_month
         )
       `)
       .eq('user_id', user.id)

     if (projectsData) {
       const projectsWithDetails = projectsData.map((project) => {
         const datasetCount = project.datasets?.length || 0;
         const totalApiCalls = project.api_keys?.reduce((sum, key) => sum + (key.request_count || 0), 0) || 0;
         const apiKey = project.api_keys?.[0]; // Get first API key for examples

         // Get API calls this month
         const startOfMonth = new Date()
         startOfMonth.setDate(1)
         startOfMonth.setHours(0, 0, 0, 0)

         // Note: We can't easily get monthly calls without additional query, so we'll show total for now

         return {
           id: project.id,
           name: project.name,
           slug: project.slug,
           description: `Project created on ${new Date(project.created_at).toLocaleDateString()}`,
           datasetCount,
           apiCallsThisMonth: totalApiCalls, // Using total calls as approximation
           datasets: project.datasets || [],
           apiKey: apiKey?.key_prefix ? `${apiKey.key_prefix}` : undefined,
           createdAt: project.created_at
         }
       })
       setProjects(projectsWithDetails)
     }

      setLoading(false)
    }

    fetchProjects()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your CSV datasets and API keys</p>
        </div>
        <Link href="/upload">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Upload New CSV
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <CardTitle className="text-xl mb-2">No projects yet</CardTitle>
            <CardDescription className="mb-6">
              Get started by uploading your first CSV file
            </CardDescription>
            <Link href="/upload">
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Upload Your First CSV
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                  <div className="flex items-center">
                    <Database className="h-4 w-4 mr-1" />
                    {project.datasetCount} datasets
                  </div>
                  <div className="flex items-center">
                    <Activity className="h-4 w-4 mr-1" />
                    {project.apiCallsThisMonth} calls
                  </div>
                </div>

                {project.datasets && project.datasets.length > 0 && project.apiKey && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">API Examples:</p>
                    {project.datasets.slice(0, 2).map((dataset) => (
                      <div key={dataset.id} className="mb-2">
                        <p className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
                          GET /api/v1/{project.slug}/{dataset.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {dataset.row_count} rows
                        </p>
                      </div>
                    ))}
                    <p className="text-xs text-gray-600 mt-2">
                      Use API key: <code className="bg-gray-50 px-1 rounded">{project.apiKey}</code>
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}