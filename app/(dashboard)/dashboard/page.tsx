'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Project } from '../../../types/csv';
import Link from 'next/link';
import { Plus, Database, Activity, Copy, ExternalLink, Key, BarChart3, FileText, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProjectWithDetails extends Project {
  datasets?: any[];
  apiKey?: string;
  apiKeys?: any[];
  totalApiCalls?: number;
  monthlyApiCalls?: number;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    projects: 0,
    datasets: 0,
    totalApiCalls: 0,
    monthlyApiCalls: 0
  });

  useEffect(() => {
    const fetchProjects = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
            row_count,
            created_at
          ),
          api_keys (
            id,
            key_prefix,
            request_count,
            request_limit_per_month,
            last_used_at
          )
        `)
        .eq('user_id', user.id);

      if (projectsData) {
        const projectsWithDetails = projectsData.map((project) => {
          const datasetCount = project.datasets?.length || 0;
          const totalApiCalls = project.api_keys?.reduce((sum, key) => sum + (key.request_count || 0), 0) || 0;
          const apiKey = project.api_keys?.[0]; // Get first API key for examples

          // Calculate monthly calls (last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const monthlyApiCalls = project.api_keys?.reduce((sum, key) => {
            if (key.last_used_at && new Date(key.last_used_at) > thirtyDaysAgo) {
              return sum + (key.request_count || 0);
            }
            return sum;
          }, 0) || 0;

          return {
            id: project.id,
            name: project.name,
            slug: project.slug,
            description: `Project created on ${new Date(project.created_at).toLocaleDateString()}`,
            datasetCount,
            apiCallsThisMonth: monthlyApiCalls,
            datasets: project.datasets || [],
            apiKey: apiKey?.key_prefix ? `${apiKey.key_prefix}...` : undefined,
            apiKeys: project.api_keys || [],
            totalApiCalls,
            monthlyApiCalls,
            createdAt: project.created_at
          };
        });

        setProjects(projectsWithDetails);

        // Calculate total stats
        const totalProjects = projectsWithDetails.length;
        const totalDatasets = projectsWithDetails.reduce((sum, p) => sum + p.datasetCount, 0);
        const totalApiCalls = projectsWithDetails.reduce((sum, p) => sum + (p.totalApiCalls || 0), 0);
        const totalMonthlyCalls = projectsWithDetails.reduce((sum, p) => sum + (p.monthlyApiCalls || 0), 0);

        setTotalStats({
          projects: totalProjects,
          datasets: totalDatasets,
          totalApiCalls,
          monthlyApiCalls: totalMonthlyCalls
        });
      }

      setLoading(false);
    };

    fetchProjects();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your CSV datasets and API keys</p>
        </div>
        <div className="flex gap-3">
          <Link href="/api-keys">
            <Button variant="outline">
              <Key className="h-4 w-4 mr-2" />
              API Keys
            </Button>
          </Link>
          <Link href="/api-docs">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              API Docs
            </Button>
          </Link>
          <Link href="/upload">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.projects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Datasets</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.datasets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.monthlyApiCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalApiCalls}</div>
          </CardContent>
        </Card>
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
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription>{project.description}</CardDescription>
                  </div>
                  <Link href={`/projects/${project.slug}/settings`}>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                  <div className="flex items-center">
                    <Database className="h-4 w-4 mr-1" />
                    {project.datasetCount} datasets
                  </div>
                  <div className="flex items-center">
                    <Activity className="h-4 w-4 mr-1" />
                    {project.monthlyApiCalls} calls (30d)
                  </div>
                </div>

                {project.datasets && project.datasets.length > 0 && project.apiKey && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">API Endpoints:</p>
                    {project.datasets.slice(0, 2).map((dataset) => (
                      <div key={dataset.id} className="mb-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded flex-1 mr-2">
                            GET /api/v1/{project.slug}/{dataset.name}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(`/api/v1/${project.slug}/${dataset.name}`)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {dataset.row_count} rows • Created {new Date(dataset.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    <div className="mt-3 pt-2 border-t">
                      <p className="text-xs text-gray-600 mb-1">API Key:</p>
                      <div className="flex items-center justify-between">
                        <code className="text-xs bg-gray-50 px-2 py-1 rounded flex-1 mr-2">
                          {project.apiKey}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(project.apiKey || '')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Link href={`/api-docs?project=${project.slug}`}>
                    <Button variant="outline" size="sm">
                      <FileText className="h-3 w-3 mr-1" />
                      Docs
                    </Button>
                  </Link>
                  <Link href={`/api-keys?project=${project.slug}`}>
                    <Button variant="outline" size="sm">
                      <Key className="h-3 w-3 mr-1" />
                      Keys
                    </Button>
                  </Link>
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
  );
}