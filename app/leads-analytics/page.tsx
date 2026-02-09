'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Users, UserCheck, UserX, TrendingUp, RefreshCw, PieChart } from 'lucide-react';

interface AnalyticsData {
  overall: {
    total_leads: string;
    existing_patients: string;
    non_patients: string;
    total_patients?: string;
  };
  sources: Array<{ source_name: string; lead_count: string }>;
  tags: Array<{ tag_name: string; lead_count: string }>;
  gender: Array<{ gender: string; lead_count: string }>;
  provinces: Array<{ province_state: string; lead_count: string }>;
  ageGroups: Array<{ age_group: string; lead_count: string }>;
  leadTrend: Array<{ date: Date; lead_count: string }>;
  status: Array<{ status: string; lead_count: string }>;
}

export default function LeadsAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch('/api/leads/analytics');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Failed to load analytics data</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalLeads = parseInt(data.overall.total_leads, 10);
  const existingPatients = parseInt(data.overall.existing_patients, 10);
  const nonPatients = parseInt(data.overall.non_patients, 10);
  const totalPatients = data.overall.total_patients ? parseInt(data.overall.total_patients, 10) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
                <BarChart3 className="h-8 w-8 mr-3 text-blue-600" />
                Leads Analytics Dashboard
              </h1>
              <p className="text-gray-600">
                Comprehensive analytics for all leads including existing patients
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalLeads.toLocaleString()}</p>
              </div>
              <Users className="h-12 w-12 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Existing Patients</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{existingPatients.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {totalLeads > 0 ? ((existingPatients / totalLeads) * 100).toFixed(1) : 0}% of leads
                  {totalPatients > 0 && ` • ${totalPatients.toLocaleString()} total patients`}
                </p>
              </div>
              <UserCheck className="h-12 w-12 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Non-Patients</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{nonPatients.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {totalLeads > 0 ? ((nonPatients / totalLeads) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              <UserX className="h-12 w-12 text-orange-600 opacity-20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Source Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-blue-600" />
              Source Distribution
            </h2>
            <div className="space-y-3">
              {data.sources.map((source, index) => {
                const count = parseInt(source.lead_count, 10);
                const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{source.source_name}</span>
                      <span className="text-sm text-gray-600">{count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tag Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-blue-600" />
              Tag Distribution
            </h2>
            <div className="space-y-3">
              {data.tags.length > 0 ? (
                data.tags.map((tag, index) => {
                  const count = parseInt(tag.lead_count, 10);
                  const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{tag.tag_name}</span>
                        <span className="text-sm text-gray-600">{count.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No tags assigned</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Gender Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h2>
            <div className="space-y-3">
              {data.gender.map((item, index) => {
                const count = parseInt(item.lead_count, 10);
                const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.gender}</span>
                      <span className="text-sm text-gray-600">{count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Province/State Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Provinces/States</h2>
            <div className="space-y-3">
              {data.provinces.map((province, index) => {
                const count = parseInt(province.lead_count, 10);
                const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{province.province_state}</span>
                      <span className="text-sm text-gray-600">{count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Age Distribution (for existing patients) */}
        {data.ageGroups.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Age Distribution (Existing Patients)</h2>
            <div className="space-y-3">
              {data.ageGroups.map((ageGroup, index) => {
                const count = parseInt(ageGroup.lead_count, 10);
                const percentage = existingPatients > 0 ? (count / existingPatients) * 100 : 0;
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{ageGroup.age_group}</span>
                      <span className="text-sm text-gray-600">{count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Distribution (TikTok Beg Biru) */}
        {data.status.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution (TikTok Beg Biru)</h2>
            <div className="space-y-3">
              {data.status.map((item, index) => {
                const count = parseInt(item.lead_count, 10);
                const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.status}</span>
                      <span className="text-sm text-gray-600">{count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lead Trend */}
        {data.leadTrend.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              Lead Creation Trend (Last 30 Days)
            </h2>
            <div className="flex items-end space-x-2 h-64">
              {data.leadTrend.map((item, index) => {
                const count = parseInt(item.lead_count, 10);
                const maxCount = Math.max(...data.leadTrend.map(t => parseInt(t.lead_count, 10)));
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-gray-200 rounded-t" style={{ height: `${100 - height}%` }} />
                    <div
                      className="w-full bg-blue-600 rounded-t transition-all hover:bg-blue-700"
                      style={{ height: `${height}%` }}
                      title={`${new Date(item.date).toLocaleDateString()}: ${count} leads`}
                    />
                    <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
