'use client';

import { useState } from 'react';
import FileDropzone from '@/components/FileDropzone';
import LeadsUpload from '@/components/LeadsUpload';
import LatestIngestionReport from '@/components/LatestIngestionReport';
import { Upload, RefreshCw, Users, BarChart3, Download } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [isLeadsUploading, setIsLeadsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'remedi' | 'leads'>('remedi');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadSuccess(true);
        setRefreshKey((prev) => prev + 1); // Refresh report
        setTimeout(() => setUploadSuccess(false), 5000);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLeadsUpload = async (files: File[], metadata: Record<string, { tagIds: number[], sourceIds: number[] }>) => {
    setIsLeadsUploading(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch('/api/upload-leads', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadSuccess(true);
        setRefreshKey((prev) => prev + 1); // Refresh report
        setTimeout(() => setUploadSuccess(false), 5000);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsLeadsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Data Bank Dashboard
              </h1>
              <p className="text-gray-600">
                Upload CSV files to import data into the database. Supports Remedii files and Leads data.
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/leads-analytics"
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Analytics</span>
              </Link>
              <Link
                href="/leads-export"
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {uploadSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <Upload className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800 font-medium">
              Files uploaded successfully!
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('remedi')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'remedi'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Upload className="inline h-4 w-4 mr-2" />
              Remedii Data
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'leads'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Users className="inline h-4 w-4 mr-2" />
              Leads Data
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  {activeTab === 'remedi' ? (
                    <>
                      <Upload className="h-5 w-5 mr-2 text-blue-600" />
                      Upload Remedii CSV Files
                    </>
                  ) : (
                    <>
                      <Users className="h-5 w-5 mr-2 text-blue-600" />
                      Upload Leads CSV Files
                    </>
                  )}
                </h2>
                {(isUploading || isLeadsUploading) && (
                  <div className="flex items-center text-blue-600">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    <span className="text-sm">Uploading...</span>
                  </div>
                )}
              </div>

              {activeTab === 'remedi' ? (
                <>
                  <FileDropzone onUpload={handleUpload} isUploading={isUploading} />

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-900 mb-2">
                      Supported File Types:
                    </h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Patient Details Report</li>
                      <li>• Doctor Insights Report (Consultation)</li>
                      <li>• Doctor Insights Report (Sales)</li>
                      <li>• Patient Prescription Report (Procedure)</li>
                      <li>• Patient Prescription Report (Medicine)</li>
                      <li>• Itemise Sales Report</li>
                      <li>• Sales Report by Invoice Date</li>
                    </ul>
                    <p className="text-xs text-blue-700 mt-2 italic">
                      Note: Files may use monthly or date range formats (e.g., "FROM 01 JAN 2026 TO 31 JAN 2026")
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <LeadsUpload onUpload={handleLeadsUpload} isUploading={isLeadsUploading} />

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-900 mb-2">
                      Supported Leads File Types:
                    </h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• TikTok Beg Biru - Standard format with consistent headers</li>
                      <li>• Wsapme - Requires "phone" and "name" columns (headers may vary)</li>
                    </ul>
                    <p className="text-xs text-blue-700 mt-2">
                      Note: For Wsapme files, you must select at least one source. Tags are optional.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Latest Ingestion Report */}
          <div className="lg:col-span-1">
            <LatestIngestionReport key={refreshKey} filter={activeTab === 'remedi' ? 'remedi' : 'leads'} />
          </div>
        </div>
      </div>
    </div>
  );
}
