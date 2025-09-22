'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Copy, Play, Code, Book, Zap, Shield, Database } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Project {
  id: string;
  name: string;
  slug: string;
  datasets: any[];
  api_keys: any[];
}

export default function ApiDocsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: projectsData } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          slug,
          datasets (
            id,
            name,
            schema_json,
            row_count
          ),
          api_keys (
            id,
            key_prefix,
            key_hash
          )
        `)
        .eq('user_id', user.id);

      if (projectsData) {
        setProjects(projectsData);
        if (projectsData.length > 0) {
          setSelectedProject(projectsData[0].slug);
          if (projectsData[0].datasets && projectsData[0].datasets.length > 0) {
            setSelectedDataset(projectsData[0].datasets[0].name);
          }
          if (projectsData[0].api_keys && projectsData[0].api_keys.length > 0) {
            setApiKey(`${projectsData[0].api_keys[0].key_prefix}...`);
          }
        }
      }
      setLoading(false);
    };

    fetchProjects();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const generateExample = (endpoint: string, params: Record<string, string> = {}) => {
    const url = new URL(`${window.location.origin}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  };

  const selectedProjectData = projects.find(p => p.slug === selectedProject);
  const selectedDatasetData = selectedProjectData?.datasets?.find(d => d.name === selectedDataset);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Book className="h-8 w-8 mr-3 text-blue-600" />
            API Documentation
          </h1>
          <p className="text-gray-600 mt-2">Complete guide to using your CSV API endpoints</p>
        </div>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Quick Start
          </CardTitle>
          <CardDescription>
            Get started with your API in minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">1. Choose Project & Dataset</h4>
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  const project = projects.find(p => p.slug === e.target.value);
                  if (project && project.datasets && project.datasets.length > 0) {
                    setSelectedDataset(project.datasets[0].name);
                  }
                  if (project && project.api_keys && project.api_keys.length > 0) {
                    setApiKey(`${project.api_keys[0].key_prefix}...`);
                  }
                }}
                className="w-full p-2 border rounded"
              >
                {projects.map(project => (
                  <option key={project.id} value={project.slug}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. Select Dataset</h4>
              <select
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
                className="w-full p-2 border rounded"
                disabled={!selectedProjectData?.datasets?.length}
              >
                {selectedProjectData?.datasets?.map(dataset => (
                  <option key={dataset.id} value={dataset.name}>
                    {dataset.name} ({dataset.row_count} rows)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {apiKey && (
            <div>
              <h4 className="font-medium mb-2">3. Your API Key</h4>
              <div className="flex items-center space-x-2">
                <code className="flex-1 p-2 bg-gray-50 rounded font-mono text-sm">
                  {apiKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(apiKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            All API requests require authentication using your API key in the Authorization header.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <code className="text-sm">
              Authorization: Bearer {apiKey || 'your_api_key_here'}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Endpoint Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            API Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base Endpoint */}
          <div>
            <h4 className="font-medium mb-2">Base Endpoint</h4>
            <div className="flex items-center space-x-2 mb-2">
              <code className="flex-1 p-2 bg-gray-50 rounded font-mono text-sm">
                GET /api/v1/{selectedProject}/{selectedDataset}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`/api/v1/${selectedProject}/${selectedDataset}`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-600">Retrieve all data from your dataset</p>
          </div>

          {/* Query Parameters */}
          <div>
            <h4 className="font-medium mb-3">Query Parameters</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <code className="text-sm bg-gray-50 px-2 py-1 rounded">page</code>
                  <p className="text-xs text-gray-600 mt-1">Page number (default: 1)</p>
                </div>
                <div>
                  <code className="text-sm bg-gray-50 px-2 py-1 rounded">limit</code>
                  <p className="text-xs text-gray-600 mt-1">Items per page (max: 1000)</p>
                </div>
                <div>
                  <code className="text-sm bg-gray-50 px-2 py-1 rounded">sort</code>
                  <p className="text-xs text-gray-600 mt-1">Sort by column name</p>
                </div>
                <div>
                  <code className="text-sm bg-gray-50 px-2 py-1 rounded">order</code>
                  <p className="text-xs text-gray-600 mt-1">Sort order: asc or desc</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <code className="text-sm bg-gray-50 px-2 py-1 rounded">q</code>
                  <p className="text-xs text-gray-600 mt-1">Search query</p>
                </div>
                <div>
                  <code className="text-sm bg-gray-50 px-2 py-1 rounded">column_name</code>
                  <p className="text-xs text-gray-600 mt-1">Filter by column value</p>
                </div>
                <div>
                  <code className="text-sm bg-gray-50 px-2 py-1 rounded">price_min</code>
                  <p className="text-xs text-gray-600 mt-1">Range filter minimum</p>
                </div>
                <div>
                  <code className="text-sm bg-gray-50 px-2 py-1 rounded">price_max</code>
                  <p className="text-xs text-gray-600 mt-1">Range filter maximum</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Code className="h-5 w-5 mr-2" />
            Code Examples
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* cURL */}
          <div>
            <h4 className="font-medium mb-2">cURL</h4>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">
{`curl -H "Authorization: Bearer ${apiKey || 'your_api_key'}" \\
  "${window.location.origin}/api/v1/${selectedProject}/${selectedDataset}"`}
              </pre>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => copyToClipboard(`curl -H "Authorization: Bearer ${apiKey || 'your_api_key'}" "${window.location.origin}/api/v1/${selectedProject}/${selectedDataset}"`)}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
          </div>

          {/* JavaScript */}
          <div>
            <h4 className="font-medium mb-2">JavaScript</h4>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">
{`const response = await fetch('${window.location.origin}/api/v1/${selectedProject}/${selectedDataset}', {
  headers: {
    'Authorization': 'Bearer ${apiKey || 'your_api_key'}'
  }
});

const data = await response.json();`}
              </pre>
            </div>
          </div>

          {/* Python */}
          <div>
            <h4 className="font-medium mb-2">Python</h4>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">
{`import requests

response = requests.get(
    '${window.location.origin}/api/v1/${selectedProject}/${selectedDataset}',
    headers={'Authorization': 'Bearer ${apiKey || 'your_api_key'}'}
)

data = response.json()`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Response Format */}
      <Card>
        <CardHeader>
          <CardTitle>Response Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm">
{`{
  "success": true,
  "data": [
    {
      "column1": "value1",
      "column2": "value2",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 1250,
    "totalPages": 13
  },
  "meta": {
    "columns": ["column1", "column2"],
    "types": {
      "column1": "text",
      "column2": "number"
    },
    "queryTime": 45
  }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Error Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Error Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
              <div>
                <code className="text-sm font-medium">401 Unauthorized</code>
                <p className="text-sm text-gray-600">Invalid or missing API key</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
              <div>
                <code className="text-sm font-medium">403 Forbidden</code>
                <p className="text-sm text-gray-600">API key doesn't match project</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
              <div>
                <code className="text-sm font-medium">404 Not Found</code>
                <p className="text-sm text-gray-600">Dataset not found</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
              <div>
                <code className="text-sm font-medium">429 Too Many Requests</code>
                <p className="text-sm text-gray-600">Monthly API limit exceeded</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
              <div>
                <code className="text-sm font-medium">500 Internal Server Error</code>
                <p className="text-sm text-gray-600">Server error occurred</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}