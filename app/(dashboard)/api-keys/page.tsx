'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Copy, Eye, EyeOff, RefreshCw, Key, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateApiKey, hashApiKey } from '../../../lib/api-helpers';

interface ApiKey {
  id: string;
  project_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  request_count: number;
  request_limit_per_month: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  projects?: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullKeys, setShowFullKeys] = useState<Record<string, boolean>>({});
  const [selectedProject, setSelectedProject] = useState<string>('');

  useEffect(() => {
    fetchApiKeys();
    fetchProjects();
  }, []);

  const fetchApiKeys = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: keysData } = await supabase
      .from('api_keys')
      .select(`
        id,
        project_id,
        name,
        key_prefix,
        key_hash,
        request_count,
        request_limit_per_month,
        is_active,
        last_used_at,
        created_at,
        projects (
          id,
          name,
          slug
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (keysData) {
      setApiKeys(keysData as unknown as ApiKey[]);
    }
    setLoading(false);
  };

  const fetchProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name, slug')
      .eq('user_id', user.id);

    if (projectsData) {
      setProjects(projectsData);
      if (projectsData.length > 0 && !selectedProject) {
        setSelectedProject(projectsData[0].id);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowFullKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const regenerateKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to regenerate this API key? The old key will stop working immediately.')) {
      return;
    }

    try {
      // Generate new key using utility function
      const newKey = await generateApiKey();
      const newKeyPrefix = newKey.substring(0, 12) + '...';

      // Hash the new key using utility function
      const newKeyHash = await hashApiKey(newKey);

      // Update the key in database
      const { error } = await supabase
        .from('api_keys')
        .update({
          key_prefix: newKeyPrefix,
          key_hash: newKeyHash,
          request_count: 0,
          last_used_at: null
        })
        .eq('id', keyId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Update local state
      setApiKeys(prev => prev.map(key =>
        key.id === keyId
          ? { ...key, key_prefix: newKeyPrefix, request_count: 0, last_used_at: null }
          : key
      ));

      // Show the new key to user
      toast.success(`New API key: ${newKey}`);
      copyToClipboard(newKey);

    } catch (error: any) {
      console.error('Error regenerating key:', error);
      const errorMessage = error?.message || 'Unknown error';
      toast.error(`Failed to regenerate API key: ${errorMessage}`);
    }
  };

  const deleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;

      // Remove from local state
      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      toast.success('API key deleted');

    } catch (error) {
      console.error('Error deleting key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const createNewKey = async () => {
    if (!selectedProject) {
      toast.error('Please select a project');
      return;
    }

    try {
      // Generate new key using utility function
      const newKey = await generateApiKey();
      const newKeyPrefix = newKey.substring(0, 12) + '...';

      // Hash the key using utility function
      const newKeyHash = await hashApiKey(newKey);

      // Create new API key
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          project_id: selectedProject,
          name: 'New API Key',
          key_prefix: newKeyPrefix,
          key_hash: newKeyHash,
          request_limit_per_month: 1000
        })
        .select(`
          id,
          project_id,
          name,
          key_prefix,
          key_hash,
          request_count,
          request_limit_per_month,
          is_active,
          last_used_at,
          created_at,
          projects (
            id,
            name,
            slug
          )
        `)
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Add to local state
      setApiKeys(prev => [data as unknown as ApiKey, ...prev]);

      // Show the new key to user
      toast.success(`New API key created: ${newKey}`);
      copyToClipboard(newKey);

    } catch (error: any) {
      console.error('Error creating key:', error);
      const errorMessage = error?.message || 'Unknown error';
      toast.error(`Failed to create API key: ${errorMessage}`);
    }
  };

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
            <Key className="h-8 w-8 mr-3 text-blue-600" />
            API Keys
          </h1>
          <p className="text-gray-600 mt-2">Manage your API keys and monitor usage</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">Select Project</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <Button onClick={createNewKey}>
            <Plus className="h-4 w-4 mr-2" />
            New API Key
          </Button>
        </div>
      </div>

      {/* Usage Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apiKeys.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests (30d)</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiKeys.reduce((sum, key) => sum + key.request_count, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiKeys.filter(key => key.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Key className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <CardTitle className="text-xl mb-2">No API keys yet</CardTitle>
              <CardDescription className="mb-6">
                Create your first API key to start using the CSV API
              </CardDescription>
              <Button onClick={createNewKey} disabled={!selectedProject}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First API Key
              </Button>
            </CardContent>
          </Card>
        ) : (
          apiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                    <CardDescription>
                      Project: {apiKey.projects?.name || 'Unknown'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                    >
                      {showFullKeys[apiKey.id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateKey(apiKey.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteKey(apiKey.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">API Key</h4>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 p-2 bg-gray-50 rounded font-mono text-sm">
                        {showFullKeys[apiKey.id] ? apiKey.key_hash : apiKey.key_prefix}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(
                          showFullKeys[apiKey.id] ? apiKey.key_hash : apiKey.key_prefix
                        )}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {showFullKeys[apiKey.id] && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                          <span className="text-sm text-yellow-800">
                            Never share your full API key publicly
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Usage Statistics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Requests this month:</span>
                        <span className="text-sm font-medium">
                          {apiKey.request_count} / {apiKey.request_limit_per_month}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min((apiKey.request_count / apiKey.request_limit_per_month) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Last used:</span>
                        <span className="text-sm">
                          {apiKey.last_used_at
                            ? new Date(apiKey.last_used_at).toLocaleDateString()
                            : 'Never'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Created:</span>
                        <span className="text-sm">
                          {new Date(apiKey.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}