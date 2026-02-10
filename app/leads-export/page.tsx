'use client';

import { useEffect, useState } from 'react';
import { Download, Filter, RefreshCw, X, Check } from 'lucide-react';

interface Source {
  source_id: number;
  source_name: string;
}

interface Tag {
  tag_id: number;
  tag_name: string;
}

export default function LeadsExportPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filter states
  const [leadType, setLeadType] = useState<'all' | 'existing_patients' | 'non_patients'>('all');
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState<string>('');
  const [ageMax, setAgeMax] = useState<string>('');
  const [createdDateFrom, setCreatedDateFrom] = useState<string>('');
  const [createdDateTo, setCreatedDateTo] = useState<string>('');
  const [firstVisitDateFrom, setFirstVisitDateFrom] = useState<string>('');
  const [firstVisitDateTo, setFirstVisitDateTo] = useState<string>('');
  const [visitCountMin, setVisitCountMin] = useState<string>('');
  const [visitCountMax, setVisitCountMax] = useState<string>('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSourceTraffic, setSelectedSourceTraffic] = useState<string[]>([]);
  const [selectedSourceAction, setSelectedSourceAction] = useState<string[]>([]);
  const [selectedSourceScenario, setSelectedSourceScenario] = useState<string[]>([]);

  // Available options for filters
  const genderOptions = ['Male', 'Female', 'Prefer not to say', 'Unknown'];
  const [availableProvinces, setAvailableProvinces] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableSourceTraffic, setAvailableSourceTraffic] = useState<string[]>([]);
  const [availableSourceAction, setAvailableSourceAction] = useState<string[]>([]);
  const [availableSourceScenario, setAvailableSourceScenario] = useState<string[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Fetch sources and tags
      const [sourcesRes, tagsRes] = await Promise.all([
        fetch('/api/sources'),
        fetch('/api/tags'),
      ]);

      const sourcesData = await sourcesRes.json();
      const tagsData = await tagsRes.json();

      if (sourcesData.success) {
        setSources(sourcesData.sources);
      }
      if (tagsData.success) {
        setTags(tagsData.tags);
      }

      // Fetch available filter options
      await fetchFilterOptions();
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/leads/analytics');
      const result = await response.json();

      if (result.success) {
        // Extract unique provinces
        const provinces = result.data.provinces
          .map((p: { province_state: string }) => p.province_state)
          .filter((p: string) => p !== 'Unknown');
        setAvailableProvinces(provinces);

        // Extract unique statuses
        const statuses = result.data.status
          .map((s: { status: string }) => s.status)
          .filter((s: string) => s !== 'Unknown');
        setAvailableStatuses(statuses);

        // For source_traffic, source_action, source_scenario, we'll need to query the database
        // For now, we'll leave them empty and let users type or we can add a separate endpoint
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const toggleSource = (sourceId: number) => {
    setSelectedSourceIds((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    );
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleGender = (gender: string) => {
    setSelectedGenders((prev) =>
      prev.includes(gender) ? prev.filter((g) => g !== gender) : [...prev, gender]
    );
  };

  const toggleProvince = (province: string) => {
    setSelectedProvinces((prev) =>
      prev.includes(province) ? prev.filter((p) => p !== province) : [...prev, province]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setLeadType('all');
    setSelectedSourceIds([]);
    setSelectedTagIds([]);
    setSelectedGenders([]);
    setSelectedProvinces([]);
    setAgeMin('');
    setAgeMax('');
    setCreatedDateFrom('');
    setCreatedDateTo('');
    setFirstVisitDateFrom('');
    setFirstVisitDateTo('');
    setVisitCountMin('');
    setVisitCountMax('');
    setSelectedStatuses([]);
    setSelectedSourceTraffic([]);
    setSelectedSourceAction([]);
    setSelectedSourceScenario([]);
  };

  const handleExport = async () => {
    try {
      setExporting(true);

      const filters = {
        leadType,
        sourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        gender: selectedGenders.length > 0 ? selectedGenders : undefined,
        provinceState: selectedProvinces.length > 0 ? selectedProvinces : undefined,
        ageMin: ageMin ? parseInt(ageMin, 10) : undefined,
        ageMax: ageMax ? parseInt(ageMax, 10) : undefined,
        createdDateFrom: createdDateFrom || undefined,
        createdDateTo: createdDateTo || undefined,
        firstVisitDateFrom: firstVisitDateFrom || undefined,
        firstVisitDateTo: firstVisitDateTo || undefined,
        visitCountMin: visitCountMin ? parseInt(visitCountMin, 10) : undefined,
        visitCountMax: visitCountMax ? parseInt(visitCountMax, 10) : undefined,
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        sourceTraffic: selectedSourceTraffic.length > 0 ? selectedSourceTraffic : undefined,
        sourceAction: selectedSourceAction.length > 0 ? selectedSourceAction : undefined,
        sourceScenario: selectedSourceScenario.length > 0 ? selectedSourceScenario : undefined,
      };

      const response = await fetch('/api/leads/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Download the CSV file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
            <Download className="h-8 w-8 mr-3 text-blue-600" />
            Leads Export
          </h1>
          <p className="text-gray-600">
            Export leads to CSV with phone and name columns. Apply filters to refine your export.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filter Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <Filter className="h-5 w-5 mr-2 text-blue-600" />
                    Filter Controls
                  </h2>
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Lead Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lead Type
                  </label>
                  <div className="flex space-x-4">
                    {(['all', 'existing_patients', 'non_patients'] as const).map((type) => (
                      <label key={type} className="flex items-center">
                        <input
                          type="radio"
                          name="leadType"
                          value={type}
                          checked={leadType === type}
                          onChange={(e) => setLeadType(e.target.value as typeof leadType)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 capitalize">
                          {type.replace('_', ' ')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sources - Only for non-patients or all */}
                {(leadType === 'non_patients' || leadType === 'all') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sources (Multiple Selection)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {sources.map((source) => (
                        <button
                          key={source.source_id}
                          onClick={() => toggleSource(source.source_id)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            selectedSourceIds.includes(source.source_id)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {source.source_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags - Only for non-patients or all */}
                {(leadType === 'non_patients' || leadType === 'all') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (Multiple Selection)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <button
                          key={tag.tag_id}
                          onClick={() => toggleTag(tag.tag_id)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            selectedTagIds.includes(tag.tag_id)
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {tag.tag_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gender - Show for all types, but more relevant for existing patients */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender (Multiple Selection)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {genderOptions.map((gender) => (
                      <button
                        key={gender}
                        onClick={() => toggleGender(gender)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedGenders.includes(gender)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Province/State - Only for non-patients or all */}
                {availableProvinces.length > 0 && (leadType === 'non_patients' || leadType === 'all') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Province/State (Multiple Selection)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableProvinces.map((province) => (
                        <button
                          key={province}
                          onClick={() => toggleProvince(province)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            selectedProvinces.includes(province)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {province}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Age Range (for existing patients) */}
                {leadType === 'existing_patients' || leadType === 'all' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Age Range
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="number"
                          placeholder="Min age"
                          value={ageMin}
                          onChange={(e) => setAgeMin(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                          min="0"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Max age"
                          value={ageMax}
                          onChange={(e) => setAgeMax(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Visit Count Range (for existing patients) */}
                {leadType === 'existing_patients' || leadType === 'all' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visit Count Range
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="number"
                          placeholder="Min visits"
                          value={visitCountMin}
                          onChange={(e) => setVisitCountMin(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                          min="0"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Max visits"
                          value={visitCountMax}
                          onChange={(e) => setVisitCountMax(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* First Visit Date Range (for existing patients) */}
                {leadType === 'existing_patients' || leadType === 'all' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Visit Date Range
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="date"
                          value={firstVisitDateFrom}
                          onChange={(e) => setFirstVisitDateFrom(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="date"
                          value={firstVisitDateTo}
                          onChange={(e) => setFirstVisitDateTo(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Lead Creation Date Range - Only for non-patients or all */}
                {(leadType === 'non_patients' || leadType === 'all') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lead Creation Date Range
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="date"
                          value={createdDateFrom}
                          onChange={(e) => setCreatedDateFrom(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="date"
                          value={createdDateTo}
                          onChange={(e) => setCreatedDateTo(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Status (TikTok Beg Biru) - Only for non-patients or all */}
                {availableStatuses.length > 0 && (leadType === 'non_patients' || leadType === 'all') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status (TikTok Beg Biru) - Multiple Selection
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableStatuses.map((status) => (
                        <button
                          key={status}
                          onClick={() => toggleStatus(status)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            selectedStatuses.includes(status)
                              ? 'bg-yellow-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source Traffic, Action, Scenario - Only for non-patients or all */}
                {(leadType === 'non_patients' || leadType === 'all') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Source Traffic (TikTok Beg Biru) - Comma separated
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Organic, Paid"
                        value={selectedSourceTraffic.join(', ')}
                        onChange={(e) =>
                          setSelectedSourceTraffic(
                            e.target.value.split(',').map((s) => s.trim()).filter((s) => s)
                          )
                        }
                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Source Action (TikTok Beg Biru) - Comma separated
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Click, View"
                        value={selectedSourceAction.join(', ')}
                        onChange={(e) =>
                          setSelectedSourceAction(
                            e.target.value.split(',').map((s) => s.trim()).filter((s) => s)
                          )
                        }
                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Source Scenario (TikTok Beg Biru) - Comma separated
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Scenario1, Scenario2"
                        value={selectedSourceScenario.join(', ')}
                        onChange={(e) =>
                          setSelectedSourceScenario(
                            e.target.value.split(',').map((s) => s.trim()).filter((s) => s)
                          )
                        }
                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Export Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h2>
              <p className="text-sm text-gray-600 mb-6">
                The exported CSV will contain only <strong>phone</strong> and <strong>name</strong> columns.
              </p>

              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {exporting ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    <span>Export to CSV</span>
                  </>
                )}
              </button>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> All filters are optional. If no filters are applied, all leads will be exported.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
