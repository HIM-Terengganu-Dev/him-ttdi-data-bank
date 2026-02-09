'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Database, FileText, CheckCircle2, XCircle, RefreshCw, Clock } from 'lucide-react';

interface IngestionData {
  fileType: string;
  tableName: string;
  hasData: boolean;
  fileName?: string;
  uploadedAt?: string;
  csvDate?: string;
  rowsProcessed?: number;
  rowsInserted?: number;
  rowsUpdated?: number;
  rowsFailed?: number;
  uploadStatus?: string;
}

interface LatestIngestionReportProps {
  filter?: 'remedi' | 'leads' | 'all';
}

export default function LatestIngestionReport({ filter = 'all' }: LatestIngestionReportProps) {
  const [data, setData] = useState<IngestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLatestIngestion();
  }, [filter]);

  const fetchLatestIngestion = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const url = filter !== 'all' ? `/api/latest-ingestion?filter=${filter}` : '/api/latest-ingestion';
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.ingestions);
      }
    } catch (error) {
      console.error('Error fetching latest ingestion:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchLatestIngestion(true);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'd MMM yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'd MMM yyyy, h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Database className="h-5 w-5 mr-2 text-blue-600" />
              Latest Ingestion Report
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'remedi' 
                ? 'Most recent data uploads for Remedii file types'
                : filter === 'leads'
                ? 'Most recent data uploads for Leads file types'
                : 'Most recent data uploads for all file types'}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh ingestion report"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {data.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No ingestion history found
          </div>
        ) : (
          data.map((item, index) => (
            <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900">
                      {item.fileType}
                    </h3>
                    {item.hasData && item.uploadStatus === 'success' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {item.hasData && (item.uploadStatus === 'processing' || item.uploadStatus === 'queued') && (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />
                        <span className="text-xs text-yellow-600 font-medium">Processing...</span>
                      </div>
                    )}
                    {item.hasData && item.uploadStatus === 'failed' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>

                  {item.hasData ? (
                    <div className="space-y-2 mt-3">
                      {(item.uploadStatus === 'processing' || item.uploadStatus === 'queued') ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                          <p className="text-sm text-yellow-800 font-medium">
                            File is being processed in the background. This may take a few moments.
                          </p>
                          {item.uploadedAt && (
                            <p className="text-xs text-yellow-600 mt-1">
                              Uploaded: {formatDateTime(item.uploadedAt)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-4 text-sm">
                            <div className="flex items-center text-gray-600">
                              <Calendar className="h-4 w-4 mr-1.5 text-blue-500" />
                              <span className="font-medium">CSV Data Date:</span>
                              <span className="ml-2 text-gray-900">
                                {formatDate(item.csvDate)}
                              </span>
                            </div>
                            <div className="flex items-center text-gray-600">
                              <span className="font-medium">Ingested:</span>
                              <span className="ml-2 text-gray-900">
                                {formatDateTime(item.uploadedAt)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            {item.rowsProcessed !== undefined && (
                              <span>
                                Processed: <span className="font-medium text-gray-900">{item.rowsProcessed}</span>
                              </span>
                            )}
                            {item.rowsInserted !== undefined && item.rowsInserted > 0 && (
                              <span>
                                Inserted: <span className="font-medium text-green-600">{item.rowsInserted}</span>
                              </span>
                            )}
                            {item.rowsUpdated !== undefined && item.rowsUpdated > 0 && (
                              <span>
                                Updated: <span className="font-medium text-blue-600">{item.rowsUpdated}</span>
                              </span>
                            )}
                            {item.rowsFailed !== undefined && item.rowsFailed > 0 && (
                              <span>
                                Failed: <span className="font-medium text-red-600">{item.rowsFailed}</span>
                              </span>
                            )}
                          </div>
                        </>
                      )}

                      {item.fileName && (
                        <p className="text-xs text-gray-500 mt-2">
                          File: {item.fileName}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-2">
                      No data ingested yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
