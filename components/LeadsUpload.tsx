'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle2, AlertCircle, Loader2, Plus, Tag, Globe } from 'lucide-react';
import { detectFileType } from '@/lib/csv/file-detector';

interface Tag {
  tag_id: number;
  tag_name: string;
}

interface Source {
  source_id: number;
  source_name: string;
}

interface FileWithType {
  file: File;
  detected: ReturnType<typeof detectFileType> | null;
  status: 'detecting' | 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface LeadsUploadProps {
  onUpload: (files: File[], metadata: Record<string, { tagIds: number[], sourceIds: number[] }>) => Promise<void>;
  isUploading: boolean;
}

// Read first line of CSV to get headers
async function readCSVHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const firstLine = text.split('\n')[0];
        // Parse CSV header line (handle quoted values)
        const headers: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < firstLine.length; i++) {
          const char = firstLine[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            headers.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        if (current) {
          headers.push(current.trim());
        }

        resolve(headers);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    // Only read first 10KB to get headers
    const blob = file.slice(0, 10240);
    reader.readAsText(blob);
  });
}

// Read Excel file headers (client-side)
// Note: For Excel files, we'll detect by filename and let the server parse
// This avoids bundling issues with xlsx in the browser
async function readExcelHeaders(file: File): Promise<string[]> {
  // For Excel files, we'll return empty array and let server-side detection handle it
  // Or we can try to read it if xlsx is available
  try {
    // Try dynamic import - if it fails, return empty and let server handle it
    const XLSX = await import('xlsx');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Read only first row
          const firstRow = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            range: 1, // Only first row
            defval: '',
          });

          if (firstRow.length === 0) {
            resolve([]);
            return;
          }

          const headers = (firstRow[0] as any[]).map((h: any) => String(h || '').trim());
          resolve(headers);
        } catch (error) {
          // If parsing fails, return empty - server will handle it
          resolve([]);
        }
      };
      reader.onerror = () => resolve([]);
      // Only read first 50KB for headers
      const blob = file.slice(0, 51200);
      reader.readAsArrayBuffer(blob);
    });
  } catch (error) {
    // If xlsx is not available in browser, return empty array
    // Server will parse it properly
    return Promise.resolve([]);
  }
}

export default function LeadsUpload({ onUpload, isUploading }: LeadsUploadProps) {
  const [files, setFiles] = useState<FileWithType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedTags, setSelectedTags] = useState<Record<string, number[]>>({});
  const [selectedSources, setSelectedSources] = useState<Record<string, number[]>>({});

  const [newTagName, setNewTagName] = useState('');
  const [newSourceName, setNewSourceName] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isAddingSource, setIsAddingSource] = useState(false);

  // Fetch tags and sources on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tagsRes, sourcesRes] = await Promise.all([
          fetch('/api/tags'),
          fetch('/api/sources'),
        ]);
        const tagsData = await tagsRes.json();
        const sourcesData = await sourcesRes.json();
        if (tagsData.success) setTags(tagsData.tags);
        if (sourcesData.success) setSources(sourcesData.sources);
      } catch (error) {
        console.error('Error fetching tags/sources:', error);
      }
    };
    fetchData();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // First, add files with "detecting" status
    const newFiles: FileWithType[] = acceptedFiles.map((file) => ({
      file,
      detected: null,
      status: 'detecting' as const,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Then detect file types by reading headers
    let hasSourceRequired = false;
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      try {
        const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
        let headers: string[] = [];

        if (isExcel) {
          // Try to read Excel headers, but if it fails, use filename detection
          try {
            headers = await readExcelHeaders(file);
          } catch (error) {
            // If Excel parsing fails on client, use filename detection
            headers = [];
          }
        } else {
          headers = await readCSVHeaders(file);
        }

        // Detect file type - if headers are empty (Excel parsing failed), use filename
        const detected = headers.length > 0
          ? detectFileType(file.name, headers)
          : detectFileType(file.name);

        if (detected.type === 'leads_wsapme') {
          hasSourceRequired = true;
        }

        setFiles((prev) => {
          const updated = [...prev];
          const fileIndex = updated.findIndex((f) => f.file === file);
          if (fileIndex !== -1) {
            updated[fileIndex] = {
              ...updated[fileIndex],
              detected,
              status: 'pending' as const,
            };
          }
          return updated;
        });
      } catch (error: any) {
        // If header reading fails, fallback to filename detection
        const detected = detectFileType(file.name);
        if (detected.type === 'leads_wsapme') {
          hasSourceRequired = true;
        }
        setFiles((prev) => {
          const updated = [...prev];
          const fileIndex = updated.findIndex((f) => f.file === file);
          if (fileIndex !== -1) {
            updated[fileIndex] = {
              ...updated[fileIndex],
              detected,
              status: 'pending' as const,
            };
          }
          return updated;
        });
      }
    }

    // Initialize empty selections for new files
    // Use file name + index or just file object as key? 
    // Using file name might collide if duplicate names, but Dropzone usually handles uniques or we can use index.
    // Let's use file name for now as that's what we'll send to server

    // We don't need global isSourceRequiredFile state anymore since it's per file

  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: true,
    disabled: isUploading,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleTag = (fileName: string, tagId: number) => {
    setSelectedTags((prev) => {
      const current = prev[fileName] || [];
      const updated = current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId];
      return { ...prev, [fileName]: updated };
    });
  };

  const toggleSource = (fileName: string, sourceId: number) => {
    setSelectedSources((prev) => {
      const current = prev[fileName] || [];
      const updated = current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId];
      return { ...prev, [fileName]: updated };
    });
  };

  const handleAddTag = async (fileName: string) => {
    if (!newTagName.trim()) return;
    setIsAddingTag(true);
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagName: newTagName.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        setTags((prev) => [...prev, data.tag]);
        // Auto-select for the current file
        toggleTag(fileName, data.tag.tag_id);
        setNewTagName('');
      }
    } catch (error) {
      console.error('Error adding tag:', error);
      alert('Failed to add tag');
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleAddSource = async (fileName: string) => {
    if (!newSourceName.trim()) return;
    setIsAddingSource(true);
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceName: newSourceName.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        setSources((prev) => [...prev, data.source]);
        // Auto-select for the current file
        toggleSource(fileName, data.source.source_id);
        setNewSourceName('');
      }
    } catch (error) {
      console.error('Error adding source:', error);
      alert('Failed to add source');
    } finally {
      setIsAddingSource(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    // Filter out unknown file types and files still being detected
    const detectingFiles = files.filter((f) => f.status === 'detecting');
    if (detectingFiles.length > 0) {
      alert('Please wait for file detection to complete');
      return;
    }

    const validFiles = files.filter(
      (f) =>
        f.detected &&
        (f.detected.type === 'leads_tiktok_beg_biru' ||
          f.detected.type === 'leads_wsapme' ||
          f.detected.type === 'leads_device_export') &&
        (f.status === 'pending' || f.status === 'error')
    );
    const invalidFiles = files.filter(
      (f) =>
        f.detected &&
        f.detected.type !== 'leads_tiktok_beg_biru' &&
        f.detected.type !== 'leads_wsapme' &&
        f.detected.type !== 'leads_device_export'
    );

    if (invalidFiles.length > 0) {
      const proceed = confirm(
        `Some files are not leads files:\n${invalidFiles
          .map((f) => f.file.name)
          .join('\n')}\n\nDo you want to proceed with the valid files only?`
      );
      if (!proceed) return;
    }

    if (validFiles.length === 0) {
      alert('No valid leads files to upload.');
      return;
    }

    // Source is now optional for all files
    // No validation needed for sourceIds

    // Update file statuses
    setFiles((prev) =>
      prev.map((f) =>
        f.detected &&
          (f.detected.type === 'leads_tiktok_beg_biru' ||
            f.detected.type === 'leads_wsapme' ||
            f.detected.type === 'leads_device_export')
          ? { ...f, status: 'uploading' }
          : f
      )
    );

    try {
      // Construct metadata
      const metadata: Record<string, { tagIds: number[], sourceIds: number[] }> = {};
      validFiles.forEach(f => {
        metadata[f.file.name] = {
          tagIds: selectedTags[f.file.name] || [],
          sourceIds: selectedSources[f.file.name] || []
        };
      });

      await onUpload(
        validFiles.map((f) => f.file),
        metadata
      );

      // Update to success
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading' ? { ...f, status: 'success' } : f
        )
      );
    } catch (error: any) {
      // Update to error
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading'
            ? { ...f, status: 'error', error: error.message }
            : f
        )
      );
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          {isDragActive
            ? 'Drop the leads CSV files here'
            : 'Drag & drop leads CSV files here'}
        </p>
        <p className="text-sm text-gray-500">
          or click to select files (supports multiple files)
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Accepted: TikTok Beg Biru, Wsapme (CSV or Excel .xlsx)
        </p>
      </div>

      {/* Global Add Tag/Source UI - Removed, or keep somewhere else if needed? 
          The user wanted per-file fields. The global creation UI could remain but the selection is per file.
          Let's just remove the logic that conditionally shows the "Global Selection" block.
      */}

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Selected Files ({files.length})
            </h3>
            {!isUploading && (
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload All
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((fileWithType, index) => {
              const fileName = fileWithType.file.name;
              const isSourceRequired = fileWithType.detected?.type === 'leads_wsapme' || fileWithType.detected?.type === 'leads_device_export';

              return (
                <div
                  key={index}
                  className={`
                  p-3 rounded-lg border
                  ${fileWithType.status === 'success'
                      ? 'bg-green-50 border-green-200'
                      : fileWithType.status === 'error'
                        ? 'bg-red-50 border-red-200'
                        : fileWithType.status === 'uploading'
                          ? 'bg-blue-50 border-blue-200'
                          : fileWithType.status === 'detecting'
                            ? 'bg-gray-50 border-gray-200'
                            : fileWithType.detected?.type === 'unknown'
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-white border-gray-200'
                    }
                `}
                >
                  <div className="flex items-center justify-between pointer-events-none">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {fileWithType.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {fileWithType.status === 'detecting' ? (
                            <span className="flex items-center">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Detecting file type...
                            </span>
                          ) : fileWithType.detected ? (
                            <>
                              {fileWithType.detected.displayName}
                              {fileWithType.detected.type === 'unknown' && ' (Unknown type)'}
                            </>
                          ) : (
                            'Unknown'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pointer-events-auto">
                      {fileWithType.status === 'detecting' && (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      )}
                      {fileWithType.status === 'success' && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {fileWithType.status === 'error' && (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      {fileWithType.status === 'uploading' && (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                      )}
                      {!isUploading && fileWithType.status !== 'detecting' && (
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Per-file Settings */}
                  {isSourceRequired && !isUploading && fileWithType.status === 'pending' && (
                    <div className="mt-4 pl-8 border-t border-gray-100 pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tags */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Tags
                          </label>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {tags.map((tag) => (
                              <button
                                key={tag.tag_id}
                                onClick={() => toggleTag(fileName, tag.tag_id)}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${(selectedTags[fileName] || []).includes(tag.tag_id)
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                  }`}
                              >
                                {tag.tag_name}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              placeholder="New tag"
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                              onKeyPress={(e) => e.key === 'Enter' && handleAddTag(fileName)}
                            />
                            <button
                              onClick={() => handleAddTag(fileName)}
                              disabled={isAddingTag || !newTagName.trim()}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border border-gray-300 hover:bg-gray-200"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Source */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Source (Optional)
                          </label>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {sources.map((source) => (
                              <button
                                key={source.source_id}
                                onClick={() => toggleSource(fileName, source.source_id)}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${(selectedSources[fileName] || []).includes(source.source_id)
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                  }`}
                              >
                                {source.source_name}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={newSourceName}
                              onChange={(e) => setNewSourceName(e.target.value)}
                              placeholder="New source"
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                              onKeyPress={(e) => e.key === 'Enter' && handleAddSource(fileName)}
                            />
                            <button
                              onClick={() => handleAddSource(fileName)}
                              disabled={isAddingSource || !newSourceName.trim()}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border border-gray-300 hover:bg-gray-200"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
