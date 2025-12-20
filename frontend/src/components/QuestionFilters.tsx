import React, { useState } from 'react';

interface FilterOptions {
  questionType?: string;
  difficulty?: string;
  status?: string;
  section?: string;
}

interface QuestionFiltersProps {
  onFilterChange: (filters: FilterOptions) => void;
  questionTypes?: string[];
  difficulties?: string[];
  statuses?: string[];
  sections?: string[];
}

export const QuestionFilters: React.FC<QuestionFiltersProps> = ({
  onFilterChange,
  questionTypes = [
    'multiple_choice_single',
    'multiple_choice_multiple',
    'true_false',
    'essay',
    'short_answer',
    'fill_blank',
    'matching',
    'ordering',
  ],
  difficulties = ['easy', 'medium', 'hard'],
  statuses = ['active', 'disabled', 'draft'],
  sections = [],
}) => {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    const newFilters = { ...filters };
    if (value === '') {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    setFilters({});
    onFilterChange({});
  };

  const activeFilterCount = Object.keys(filters).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <i className='bx bx-filter-alt text-gray-600'></i>
          <span className="font-medium text-gray-700">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        <i className={`bx bx-chevron-${isExpanded ? 'up' : 'down'} text-gray-600`}></i>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Question Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Question Type
              </label>
              <select
                value={filters.questionType || ''}
                onChange={(e) => handleFilterChange('questionType', e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                {questionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Difficulty
              </label>
              <select
                value={filters.difficulty || ''}
                onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Levels</option>
                {difficulties.map((diff) => (
                  <option key={diff} value={diff}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Section
              </label>
              <select
                value={filters.section || ''}
                onChange={(e) => handleFilterChange('section', e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Sections</option>
                {sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleReset}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <i className='bx bx-reset'></i>
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
