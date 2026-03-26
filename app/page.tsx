'use client';

import { useState, useRef, useEffect } from 'react';
import FileDropzone from '@/components/FileDropzone';
import LeadsUpload from '@/components/LeadsUpload';
import LatestIngestionReport from '@/components/LatestIngestionReport';
import { Upload, RefreshCw, Users, BarChart3, Download, Terminal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';

type LogEntry = {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'detail';
};

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [isLeadsUploading, setIsLeadsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'remedi' | 'leads' | 'wabot'>('remedi');
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadLogs, setUploadLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setUploadLogs((prev) => [...prev, { time, message, type }]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uploadLogs]);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    setUploadSuccess(false);
    setUploadProgress(`Starting upload of ${files.length} files...`);
    addLog(`▶ Starting upload of ${files.length} file(s)...`, 'info');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        addLog(`📂 Processing [${i + 1}/${files.length}]: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
        setUploadProgress(`Processing ${i + 1} of ${files.length}: ${file.name}...`);

        await new Promise<void>((resolve, reject) => {
          let uploadId: number | null = null;
          let fileType: string | null = null;
          let totalRows = 0;
          let isFirstChunk = true;

          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            chunkSize: 1024 * 1024 * 2, // 2MB chunks sent to Edge API
            chunk: async (results, parser) => {
              parser.pause(); // Pause file reading across I/O wait
              try {
                const headers = results.meta.fields || [];
                if (isFirstChunk) {
                  // Initialize upload with backend to register upload_id and verify headers
                  const initRes = await fetch('/api/upload-init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileName: file.name, headers }),
                  });
                  const initData = await initRes.json();
                  if (!initData.success) {
                      addLog(`❌ Init failed: ${initData.error}`, 'error');
                      throw new Error(initData.error || 'Failed to initialize upload');
                  }
                  
                  uploadId = initData.uploadId;
                  fileType = initData.fileType;
                  addLog(`   → Detected Type: ${initData.fileDisplayName || fileType}`, 'detail');
                  isFirstChunk = false;
                }

                if (!uploadId || !fileType) throw new Error('Failed to associate upload payload.');

                // Send micro-chunk
                const chunkRes = await fetch('/api/upload-chunk', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ uploadId, fileType, records: results.data }),
                });
                const chunkData = await chunkRes.json();
                
                if (!chunkRes.ok || !chunkData.success) {
                   throw new Error(chunkData.error || 'Failed to ingest chunk on database');
                }

                totalRows += results.data.length;
                setUploadProgress(`Uploading [${i + 1}/${files.length}] ${file.name}: ${totalRows.toLocaleString()} rows...`);
                
                parser.resume(); // Continue reading next bytes
              } catch (err: any) {
                parser.abort();
                if (uploadId) {
                   await fetch('/api/upload-complete', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ uploadId, success: false, error: err.message }),
                   });
                }
                reject(err);
              }
            },
            complete: async () => {
              try {
                if (uploadId) {
                  // Close the upload successfully
                  await fetch('/api/upload-complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uploadId, success: true }),
                  });
                  addLog(`✅ ${file.name} | Total rows processed: ${totalRows.toLocaleString()}`, 'success');
                } else {
                  addLog(`⚠ ${file.name} successfully parsed but no target was created.`, 'detail');
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            error: (err) => {
                reject(err);
            }
          });
        });
      }

      addLog(`🎉 All files uploaded successfully!`, 'success');
      setUploadSuccess(true);
      setRefreshKey((prev) => prev + 1); // Refresh report
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (error: any) {
      addLog(`❌ Upload error: ${error.message}`, 'error');
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleLeadsUpload = async (files: File[], metadata: Record<string, { tagIds: number[], sourceIds: number[] }>) => {
    setIsLeadsUploading(true);
    setUploadSuccess(false);
    setUploadProgress(`Starting upload of ${files.length} leads files...`);
    addLog(`▶ Starting leads upload of ${files.length} file(s)...`, 'info');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        addLog(`📂 Processing Leads [${i + 1}/${files.length}]: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
        setUploadProgress(`Processing ${i + 1} of ${files.length}: ${file.name}...`);
        
        const fileMeta = metadata[file.name] || { tagIds: [], sourceIds: [] };

        await new Promise<void>((resolve, reject) => {
          let uploadId: number | null = null;
          let fileType: string | null = null;
          let totalRows = 0;
          let isFirstChunk = true;

          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            chunkSize: 1024 * 1024 * 2,
            chunk: async (results, parser) => {
              parser.pause();
              try {
                if (isFirstChunk) {
                  const headers = results.meta.fields || [];
                  const initRes = await fetch('/api/upload-init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileName: file.name, headers }),
                  });
                  const initData = await initRes.json();
                  if (!initData.success) {
                      addLog(`❌ Init failed: ${initData.error}`, 'error');
                      throw new Error(initData.error || 'Failed to initialize leads upload');
                  }
                  uploadId = initData.uploadId;
                  fileType = initData.fileType;
                  addLog(`   → Detected Type: ${initData.fileDisplayName || fileType}`, 'detail');
                  isFirstChunk = false;
                }

                if (!uploadId || !fileType) throw new Error('Missing upload metadata payload.');

                const chunkRes = await fetch('/api/upload-chunk', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    uploadId, 
                    fileType, 
                    records: results.data,
                    tagIds: fileMeta.tagIds,
                    sourceIds: fileMeta.sourceIds
                  }),
                });
                const chunkData = await chunkRes.json();
                if (!chunkRes.ok || !chunkData.success) {
                   throw new Error(chunkData.error || 'Failed to ingest chunk on database');
                }

                totalRows += results.data.length;
                setUploadProgress(`Uploading Leads [${i + 1}/${files.length}] ${file.name}: ${totalRows.toLocaleString()} rows...`);
                parser.resume();
              } catch (err: any) {
                parser.abort();
                if (uploadId) {
                   await fetch('/api/upload-complete', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ uploadId, success: false, error: err.message }),
                   });
                }
                reject(err);
              }
            },
            complete: async () => {
              try {
                if (uploadId) {
                  await fetch('/api/upload-complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uploadId, success: true }),
                  });
                  addLog(`✅ ${file.name} | Total rows processed: ${totalRows.toLocaleString()}`, 'success');
                } else {
                  addLog(`⚠ ${file.name} successfully parsed but no target was created.`, 'detail');
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            error: (err) => {
                reject(err);
            }
          });
        });
      }

      addLog(`🎉 All leads files uploaded successfully!`, 'success');
      setUploadSuccess(true);
      setRefreshKey((prev) => prev + 1); // Refresh report
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (error: any) {
      addLog(`❌ Upload error: ${error.message}`, 'error');
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsLeadsUploading(false);
      setUploadProgress('');
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
              <Link
                href="/wabot-analytics"
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                <span>WABOT Analytics</span>
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
            <button
              onClick={() => setActiveTab('wabot')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'wabot'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Users className="inline h-4 w-4 mr-2" />
              WABOT Data
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  {activeTab === 'remedi' && (
                    <>
                      <Upload className="h-5 w-5 mr-2 text-blue-600" />
                      Upload Remedii CSV Files
                    </>
                  )}
                  {activeTab === 'leads' && (
                    <>
                      <Users className="h-5 w-5 mr-2 text-blue-600" />
                      Upload Leads CSV Files
                    </>
                  )}
                  {activeTab === 'wabot' && (
                    <>
                      <Upload className="h-5 w-5 mr-2 text-blue-600" />
                      Upload WABOT CSV Files
                    </>
                  )}
                </h2>
                {(isUploading || isLeadsUploading) && (
                  <div className="flex items-center text-blue-600">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    <span className="text-sm font-medium">{uploadProgress || 'Uploading...'}</span>
                  </div>
                )}
              </div>

              {activeTab === 'remedi' && (
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
              )}
              {activeTab === 'leads' && (
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
              {activeTab === 'wabot' && (
                <>
                  {/* Reuse standard file dropzone for WABOT since it goes to the same /api/upload endpoint */}
                  <FileDropzone onUpload={handleUpload} isUploading={isUploading} />

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-900 mb-2">
                      Supported WABOT File Types:
                    </h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• WABOT Blast CSV Export</li>
                    </ul>
                    <p className="text-xs text-blue-700 mt-2">
                      Note: Must include headers ID, UID, RECEIVER, STATUS, SENT, DELIVERED, READ, REPLIED for accurate processing.
                    </p>
                  </div>
                  
                  <div className="mt-4 flex space-x-4">
                    <Link
                      href="/wabot-data"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
                    >
                      View Raw WABOT Data
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Latest Ingestion Report */}
          <div className="lg:col-span-1">
            <LatestIngestionReport key={refreshKey} filter={activeTab} />
          </div>
        </div>

        {/* Upload Log Panel */}
        {uploadLogs.length > 0 && (
          <div className="mt-6 bg-gray-900 rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-green-400" />
                <span className="text-sm font-mono font-medium text-green-400">Upload Log</span>
                <span className="text-xs text-gray-400">({uploadLogs.length} entries)</span>
              </div>
              <button
                onClick={() => setUploadLogs([])}
                className="flex items-center space-x-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear</span>
              </button>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto font-mono text-xs space-y-0.5">
              {uploadLogs.map((entry, i) => (
                <div key={i} className={`flex gap-3 ${
                  entry.type === 'success' ? 'text-green-400' :
                  entry.type === 'error'   ? 'text-red-400' :
                  entry.type === 'detail'  ? 'text-gray-400' :
                  'text-blue-300'
                }`}>
                  <span className="text-gray-500 shrink-0">[{entry.time}]</span>
                  <span>{entry.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
