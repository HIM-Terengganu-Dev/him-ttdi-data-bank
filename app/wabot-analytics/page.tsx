'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  RefreshCw, 
  MessageCircle, 
  CheckCircle2, 
  Eye, 
  CornerUpLeft, 
  AlertTriangle 
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface AnalyticsData {
  metrics: {
    totalBlast: number;
    deliveryRate: string;
    readRate: string;
    replyRate: string;
  };
  funnel: Array<{ name: string; value: number }>;
  failureAnalysis: Array<{ reason: string; count: number }>;
  timeSeries: Array<{ date: string; blasts: number }>;
}

export default function WabotAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wabot-analytics');
      const result = await res.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch analytics');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="bg-red-50 text-red-800 p-4 rounded-lg shadow">
          {error}
        </div>
      </div>
    );
  }

  const { metrics, funnel, failureAnalysis, timeSeries } = data!;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 mb-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">WABOT Performance Overview</h1>
            <p className="mt-1 text-sm text-gray-500">Comprehensive analytics for your Whatsapp blasts</p>
          </div>
          <button
            onClick={fetchAnalytics}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <MessageCircle className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Blast</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{metrics.totalBlast.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle2 className="h-6 w-6 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Delivery Rate</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{metrics.deliveryRate}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Eye className="h-6 w-6 text-purple-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Read Rate</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{metrics.readRate}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CornerUpLeft className="h-6 w-6 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Reply Rate</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{metrics.replyRate}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Funnel Chart (Simulated with BarChart due to Recharts simplicity constraints) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center">
              <BarChart className="h-5 w-5 mr-2 text-blue-500" />
              Conversion Funnel
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={40}>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time Series */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Blast Activity (Timeline)
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="blasts" stroke="#8b5cf6" activeDot={{ r: 8 }} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Failure Analysis Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
              Failure Analysis (Top Reasons)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error Reason
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Occurrence Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {failureAnalysis.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-sm text-gray-500">
                      No failures recorded yet. Great job!
                    </td>
                  </tr>
                ) : (
                  failureAnalysis.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.reason}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">
                        {item.count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
