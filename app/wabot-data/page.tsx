'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, RefreshCw, AlertCircle, FileText } from 'lucide-react';

interface WabotRecord {
  id: string;
  uid: string;
  receiver: string;
  status: string;
  sent: string | null;
  delivered: string | null;
  read: string | null;
  replied: string | null;
  failed: boolean;
  error: string | null;
}

export default function WabotDataPage() {
  const [data, setData] = useState<WabotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wabot-data?page=${pageNum}&limit=50`);
      const result = await res.json();
      
      if (result.success) {
        setData(result.data);
        setTotalPages(result.pagination.totalPages);
        setPage(result.pagination.page);
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page);
  }, [page]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return <span className="text-gray-400 italic">Pending</span>;
    try {
      const date = new Date(dateString);
      // Format to DD/MM/YYYY HH:mm in Malaysia Time
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kuala_Lumpur',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      return formatter.format(date).replace(',', '');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">WABOT Blast Data</h1>
              <p className="text-gray-600">Raw representation of your WABOT CSV uploads.</p>
            </div>
            <button
              onClick={() => fetchData(page)}
              className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
              <div className="mt-1 text-sm text-red-700">{error}</div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID / UID</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receiver</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivered</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Read</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Replied</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                        <p>Loading data...</p>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <FileText className="h-8 w-8 mx-auto mb-4 text-gray-400" />
                        <p>No WABOT blast data found.</p>
                      </td>
                    </tr>
                  ) : (
                    data.map((row) => (
                      <tr key={row.id} className={row.status === 'failed' || row.failed ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium truncate max-w-[120px]" title={row.id}>{row.id}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[120px]" title={row.uid}>{row.uid}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.receiver}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            row.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                            row.status === 'read' ? 'bg-purple-100 text-purple-800' :
                            row.status === 'replied' ? 'bg-green-100 text-green-800' :
                            row.status === 'failed' || row.failed ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-900 whitespace-nowrap">{formatDate(row.sent)}</td>
                        <td className="px-4 py-3 text-xs text-gray-900 whitespace-nowrap">{formatDate(row.delivered)}</td>
                        <td className="px-4 py-3 text-xs text-gray-900 whitespace-nowrap">{formatDate(row.read)}</td>
                        <td className="px-4 py-3 text-xs text-gray-900 whitespace-nowrap">{formatDate(row.replied)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate" title={row.error || ''}>
                          {(row.error?.toLowerCase().includes('spam') || row.error?.toLowerCase().includes('limit')) ? (
                            <span className="inline-flex items-center text-red-600 font-medium">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {row.error}
                            </span>
                          ) : (
                            row.error || '-'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                      >
                        <span className="sr-only">Previous</span>
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 text-center"
                      >
                        <span className="sr-only">Next</span>
                        <ChevronLeft className="h-5 w-5 transform rotate-180" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
