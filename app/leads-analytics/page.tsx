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
  sources: Array<{ source_name: string; lead_count: string; patient_count: string; conversion_rate: string }>;
  tags: Array<{ tag_name: string; lead_count: string }>;
  gender: Array<{ gender: string; lead_count: string }>;
  provinces: Array<{ province_state: string; lead_count: string; patient_count: string; conversion_rate: string }>;
  ageGroups: Array<{ age_group: string; lead_count: string }>;
  leadTrend: Array<{ date: string | Date; lead_count: string; patient_count: string }>;
  status: Array<{ status: string; lead_count: string }>;
  patientValue: {
    total_patients: string;
    avg_visits_per_patient: string;
    max_visits: string;
    returning_patients: string;
    new_patients_30d: string;
    new_patients_90d: string;
  };
  monthlyTrend: Array<{ month: string; lead_count: string; patient_count: string }>;
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

        {/* Overall Statistics - CEO Focus */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-100">Total Leads</p>
                <p className="text-4xl font-bold mt-2">{totalLeads.toLocaleString()}</p>
              </div>
              <Users className="h-12 w-12 text-blue-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-100">Conversion Rate</p>
                <p className="text-4xl font-bold mt-2">
                  {totalLeads > 0 ? ((existingPatients / totalLeads) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-green-100 mt-1">
                  {existingPatients.toLocaleString()} patients from {totalLeads.toLocaleString()} leads
                </p>
              </div>
              <TrendingUp className="h-12 w-12 text-green-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-100">Existing Patients</p>
                <p className="text-4xl font-bold mt-2">{existingPatients.toLocaleString()}</p>
                <p className="text-xs text-emerald-100 mt-1">
                  {totalPatients > 0 && `${totalPatients.toLocaleString()} total in system`}
                </p>
              </div>
              <UserCheck className="h-12 w-12 text-emerald-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-100">Non-Patients</p>
                <p className="text-4xl font-bold mt-2">{nonPatients.toLocaleString()}</p>
                <p className="text-xs text-orange-100 mt-1">
                  {totalLeads > 0 ? ((nonPatients / totalLeads) * 100).toFixed(1) : 0}% unconverted
                </p>
              </div>
              <UserX className="h-12 w-12 text-orange-200 opacity-50" />
            </div>
          </div>
        </div>

        {/* Patient Value Metrics - CEO Focus */}
        {data.patientValue && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Avg Visits</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {parseFloat(data.patientValue.avg_visits_per_patient || '0').toFixed(1)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Max Visits</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {parseInt(data.patientValue.max_visits || '0', 10).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Returning</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {parseInt(data.patientValue.returning_patients || '0', 10).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.patientValue.total_patients && 
                  `${((parseInt(data.patientValue.returning_patients || '0', 10) / parseInt(data.patientValue.total_patients, 10)) * 100).toFixed(1)}% retention`
                }
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">New (30d)</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {parseInt(data.patientValue.new_patients_30d || '0', 10).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">New (90d)</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {parseInt(data.patientValue.new_patients_90d || '0', 10).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Source Performance - CEO Focus (Conversion Rates) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-blue-600" />
              Source Performance (ROI)
            </h2>
            <p className="text-xs text-gray-500 mb-4">Shows conversion rate: Leads → Patients</p>
            <div className="space-y-3">
              {data.sources.map((source, index) => {
                const leadCount = parseInt(source.lead_count, 10);
                const patientCount = parseInt(source.patient_count || '0', 10);
                const conversionRate = parseFloat(source.conversion_rate || '0');
                const percentage = totalLeads > 0 ? (leadCount / totalLeads) * 100 : 0;
                return (
                  <div key={index} className="border-l-4 border-blue-500 pl-3">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{source.source_name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {conversionRate}% conversion
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">{patientCount.toLocaleString()}</span>
                        <span className="text-xs text-gray-500"> / {leadCount.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">{patientCount} patients</span>
                      <span className="text-xs text-gray-500">{leadCount} leads</span>
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

          {/* Province/State Performance - CEO Focus */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Provinces/States Performance</h2>
            <p className="text-xs text-gray-500 mb-4">By patient conversion</p>
            <div className="space-y-3">
              {data.provinces.map((province, index) => {
                const leadCount = parseInt(province.lead_count, 10);
                const patientCount = parseInt(province.patient_count || '0', 10);
                const conversionRate = parseFloat(province.conversion_rate || '0');
                const percentage = totalLeads > 0 ? (leadCount / totalLeads) * 100 : 0;
                return (
                  <div key={index} className="border-l-4 border-indigo-500 pl-3">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{province.province_state}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {conversionRate}% conversion
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">{patientCount.toLocaleString()}</span>
                        <span className="text-xs text-gray-500"> / {leadCount.toLocaleString()}</span>
                      </div>
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

        {/* Monthly Growth Trend - CEO Focus */}
        {data.monthlyTrend && data.monthlyTrend.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              Monthly Growth Trend (Last 12 Months)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data.monthlyTrend.map((item, index) => {
                const leadCount = parseInt(item.lead_count, 10);
                const patientCount = parseInt(item.patient_count || '0', 10);
                const conversionRate = leadCount > 0 ? ((patientCount / leadCount) * 100).toFixed(1) : '0';
                const prevMonth = index < data.monthlyTrend.length - 1 ? data.monthlyTrend[index + 1] : null;
                const growth = prevMonth ? 
                  ((patientCount - parseInt(prevMonth.patient_count || '0', 10)) / parseInt(prevMonth.patient_count || '1', 10) * 100).toFixed(1) 
                  : null;
                
                return (
                  <div key={index} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      {new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">{patientCount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">patients</p>
                    <p className="text-xs text-gray-400 mt-1">{leadCount} leads ({conversionRate}%)</p>
                    {growth && (
                      <p className={`text-xs mt-1 font-medium ${parseFloat(growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(growth) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(growth))}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily Lead Trend */}
        {data.leadTrend.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              Daily Lead & Patient Trend (Last 30 Days)
            </h2>
            <div className="flex items-end space-x-1 h-64">
              {data.leadTrend.map((item, index) => {
                const leadCount = parseInt(item.lead_count, 10);
                const patientCount = parseInt(item.patient_count || '0', 10);
                const maxCount = Math.max(...data.leadTrend.map(t => Math.max(
                  parseInt(t.lead_count, 10), 
                  parseInt(t.patient_count || '0', 10)
                )));
                const leadHeight = maxCount > 0 ? (leadCount / maxCount) * 100 : 0;
                const patientHeight = maxCount > 0 ? (patientCount / maxCount) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group">
                    <div className="w-full relative" style={{ height: '100%' }}>
                      <div className="w-full bg-gray-200 rounded-t absolute bottom-0" style={{ height: `${100 - leadHeight}%` }} />
                      <div
                        className="w-full bg-blue-400 rounded-t absolute bottom-0 transition-all hover:bg-blue-500"
                        style={{ height: `${leadHeight}%` }}
                        title={`${new Date(item.date).toLocaleDateString()}: ${leadCount} leads, ${patientCount} patients`}
                      />
                      <div
                        className="w-full bg-green-500 rounded-t absolute bottom-0 transition-all hover:bg-green-600 opacity-80"
                        style={{ height: `${patientHeight}%`, width: '60%', left: '20%' }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center space-x-4 mt-4">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-400 rounded mr-2"></div>
                <span className="text-xs text-gray-600">Leads</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                <span className="text-xs text-gray-600">Patients</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
