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

      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          slug,
          created_at
        `)
        .eq('user_id', user.id)

      if (projectsData) {
        // Get dataset counts for each project
        const projectsWithCounts = await Promise.all(
          projectsData.map(async (project) => {
            const { count: datasetCount } = await supabase
              .from('datasets')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', project.id)

            // Get API calls this month
            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0, 0, 0, 0)

            const { count: apiCallsThisMonth } = await supabase
              .from('usage_logs')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', project.id)
              .gte('created_at', startOfMonth.toISOString())

            return {
              id: project.id,
              name: project.name,
              slug: project.slug,
              description: `Project created on ${new Date(project.created_at).toLocaleDateString()}`,
              datasetCount: datasetCount || 0,
              apiCallsThisMonth: apiCallsThisMonth || 0,
              createdAt: project.created_at
            }
          })
        )
        setProjects(projectsWithCounts)
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
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center">
                    <Database className="h-4 w-4 mr-1" />
                    {project.datasetCount} datasets
                  </div>
                  <div className="flex items-center">
                    <Activity className="h-4 w-4 mr-1" />
                    {project.apiCallsThisMonth} calls
                  </div>
                </div>
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