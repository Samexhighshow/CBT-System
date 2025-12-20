import React from 'react';

interface BulkActionToolbarProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkStatusUpdate: (status: 'active' | 'disabled' | 'draft') => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCount,
  onBulkDelete,
  onBulkStatusUpdate,
  onClearSelection,
  isLoading = false,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-500 shadow-lg z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Selected Count */}
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
            {selectedCount} selected
          </div>
          <button
            onClick={onClearSelection}
            className="text-xs text-gray-600 hover:text-gray-800 underline"
          >
            Clear
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Status Update Dropdown */}
          <div className="relative group">
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1">
              <i className='bx bx-status-up'></i>
              Change Status
              <i className='bx bx-chevron-down'></i>
            </button>
            <div className="absolute right-0 hidden group-hover:block bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 min-w-40">
              <button
                onClick={() => onBulkStatusUpdate('active')}
                disabled={isLoading}
                className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Make Active
              </button>
              <button
                onClick={() => onBulkStatusUpdate('disabled')}
                disabled={isLoading}
                className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Make Disabled
              </button>
              <button
                onClick={() => onBulkStatusUpdate('draft')}
                disabled={isLoading}
                className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                Make Draft
              </button>
            </div>
          </div>

          {/* Delete Button */}
          <button
            onClick={onBulkDelete}
            disabled={isLoading}
            className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <i className='bx bx-trash'></i>
            Delete Selected
          </button>

          {isLoading && (
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <i className='bx bx-loader-alt animate-spin'></i>
              Processing...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
