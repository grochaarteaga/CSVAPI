'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface UsageData {
  date: string;
  requests: number;
}

interface UsageChartProps {
  projectId?: string;
  days?: number;
}

export default function UsageChart({ projectId, days = 7 }: UsageChartProps) {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsageData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      let query = supabase
        .from('usage_logs')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (projectId) {
        query = query.eq('project_id', projectId);
      } else {
        // Get user's projects and filter by them
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', user.id);

        if (projects && projects.length > 0) {
          query = query.in('project_id', projects.map(p => p.id));
        }
      }

      const { data: logs } = await query;

      if (logs) {
        // Group by date
        const grouped = logs.reduce((acc: Record<string, number>, log) => {
          const date = new Date(log.created_at).toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});

        // Fill in missing dates
        const data: UsageData[] = [];
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          data.push({
            date: dateStr,
            requests: grouped[dateStr] || 0
          });
        }

        setUsageData(data);
      }

      setLoading(false);
    };

    fetchUsageData();
  }, [projectId, days]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const maxRequests = Math.max(...usageData.map(d => d.requests));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">API Usage ({days} days)</h3>
        <div className="text-sm text-gray-600">
          Total: {usageData.reduce((sum, d) => sum + d.requests, 0)} requests
        </div>
      </div>

      <div className="h-64 flex items-end space-x-2">
        {usageData.map((data, index) => (
          <div key={data.date} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-blue-600 rounded-t transition-all duration-300 hover:bg-blue-700"
              style={{
                height: maxRequests > 0 ? `${(data.requests / maxRequests) * 180}px` : '0px',
                minHeight: data.requests > 0 ? '4px' : '0px'
              }}
              title={`${data.requests} requests on ${new Date(data.date).toLocaleDateString()}`}
            ></div>
            <div className="text-xs text-gray-600 mt-2 transform -rotate-45 origin-top">
              {new Date(data.date).toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-sm text-gray-600">
        <span>0</span>
        <span>{maxRequests} requests</span>
      </div>
    </div>
  );
}