'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface EndpointData {
  endpoint: string;
  requests: number;
  avgResponseTime: number;
}

interface TopEndpointsProps {
  projectId?: string;
  limit?: number;
}

export default function TopEndpoints({ projectId, limit = 5 }: TopEndpointsProps) {
  const [endpoints, setEndpoints] = useState<EndpointData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopEndpoints = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's projects
      let projectIds: string[] = [];
      if (projectId) {
        projectIds = [projectId];
      } else {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', user.id);

        if (projects) {
          projectIds = projects.map(p => p.id);
        }
      }

      if (projectIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get usage logs for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs } = await supabase
        .from('usage_logs')
        .select('endpoint, response_time_ms')
        .in('project_id', projectIds)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .eq('status_code', 200);

      if (logs) {
        // Group by endpoint
        const grouped = logs.reduce((acc: Record<string, { count: number; totalTime: number }>, log) => {
          if (!acc[log.endpoint]) {
            acc[log.endpoint] = { count: 0, totalTime: 0 };
          }
          acc[log.endpoint].count += 1;
          acc[log.endpoint].totalTime += log.response_time_ms || 0;
          return acc;
        }, {});

        // Convert to array and sort by request count
        const endpointArray: EndpointData[] = Object.entries(grouped)
          .map(([endpoint, data]) => ({
            endpoint,
            requests: data.count,
            avgResponseTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0
          }))
          .sort((a, b) => b.requests - a.requests)
          .slice(0, limit);

        setEndpoints(endpointArray);
      }

      setLoading(false);
    };

    fetchTopEndpoints();
  }, [projectId, limit]);

  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (endpoints.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No API usage data available</p>
        <p className="text-sm">Start making API calls to see analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">Top Endpoints (30 days)</h3>

      <div className="space-y-2">
        {endpoints.map((endpoint, index) => (
          <div key={endpoint.endpoint} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                {index + 1}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {endpoint.endpoint.split('/').slice(-2).join('/')}
                </div>
                <div className="text-xs text-gray-600">
                  {endpoint.requests} requests
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {endpoint.avgResponseTime}ms
              </div>
              <div className="text-xs text-gray-600">avg response</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}