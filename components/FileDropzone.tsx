'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { detectFileType } from '@/lib/csv/file-detector';

interface FileWithType {
  file: File;
  detected: ReturnType<typeof detectFileType> | null;
  status: 'detecting' | 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface FileDropzoneProps {
  onUpload: (files: File[]) => Promise<void>;
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

export default function FileDropzone({ onUpload, isUploading }: FileDropzoneProps) {
  const [files, setFiles] = useState<FileWithType[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // First, add files with "detecting" status
    const newFiles: FileWithType[] = acceptedFiles.map((file) => ({
      file,
      detected: null,
      status: 'detecting' as const,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Then detect file types by reading headers
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      try {
        const headers = await readCSVHeaders(file);
        const detected = detectFileType(file.name, headers);
        
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
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    multiple: true,
    disabled: isUploading,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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
      (f) => f.detected && f.detected.type !== 'unknown' && (f.status === 'pending' || f.status === 'error')
    );
    const invalidFiles = files.filter(
      (f) => f.detected && f.detected.type === 'unknown'
    );

    if (invalidFiles.length > 0) {
      const proceed = confirm(
        `Some files could not be identified as valid Remedii CSV files:\n${invalidFiles
          .map((f) => f.file.name)
          .join('\n')}\n\nDo you want to proceed with the valid files only?`
      );
      if (!proceed) return;
    }

    if (validFiles.length === 0) {
      alert('No valid files to upload. Please ensure files are detected correctly.');
      return;
    }

    // Update file statuses
    setFiles((prev) =>
      prev.map((f) =>
        f.detected && f.detected.type !== 'unknown'
          ? { ...f, status: 'uploading' }
          : f
      )
    );

    try {
      await onUpload(validFiles.map((f) => f.file));

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
          ${
            isDragActive
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
            ? 'Drop the CSV files here'
            : 'Drag & drop Remedii CSV files here'}
        </p>
        <p className="text-sm text-gray-500">
          or click to select files (supports multiple files)
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Accepted: Patient Details, Consultations, Prescriptions, Sales, Invoices
        </p>
      </div>

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
            {files.map((fileWithType, index) => (
              <div
                key={index}
                className={`
                  flex items-center justify-between p-3 rounded-lg border
                  ${
                    fileWithType.status === 'success'
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
                          {fileWithType.detected.confidence === 'high' && (
                            <span className="ml-1 text-green-600" title="Detected by content">
                              ✓
                            </span>
                          )}
                        </>
                      ) : (
                        'Unknown'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
