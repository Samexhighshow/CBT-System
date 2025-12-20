import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface Tag {
  id: number;
  name: string;
  category: string;
  color: string;
  description?: string;
}

interface TagSelectorProps {
  selectedTagIds: number[];
  onChange: (tagIds: number[]) => void;
  placeholder?: string;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTagIds,
  onChange,
  placeholder = 'Select tags...',
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const API_URL = 'http://localhost:8000/api';

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/question-tags`);
      setTags(response.data.tags || response.data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTag = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleRemoveTag = (tagId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedTagIds.filter(id => id !== tagId));
  };

  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group tags by category
  const groupedTags = filteredTags.reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = [];
    }
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, Tag[]>);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Tags Display */}
      <div
        className="min-h-[42px] px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:border-gray-400 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedTags.length === 0 ? (
          <span className="text-gray-500">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
                <button
                  onClick={(e) => handleRemoveTag(tag.id, e)}
                  className="hover:bg-black/20 rounded-full p-0.5 transition-colors"
                >
                  <i className="bx bx-x text-base"></i>
                </button>
              </span>
            ))}
          </div>
        )}
        <i className={`bx bx-chevron-down absolute right-3 top-3 text-xl text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search Box */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tags..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Tags List */}
          <div className="overflow-y-auto max-h-60">
            {loading ? (
              <div className="p-4 text-center">
                <i className="bx bx-loader-alt bx-spin text-2xl text-blue-600"></i>
              </div>
            ) : Object.keys(groupedTags).length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <i className="bx bx-tag text-2xl mb-1"></i>
                <p className="text-sm">No tags found</p>
              </div>
            ) : (
              Object.entries(groupedTags).map(([category, categoryTags]) => (
                <div key={category} className="border-b border-gray-100 last:border-0">
                  <div className="px-3 py-2 bg-gray-50">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {category}
                    </span>
                  </div>
                  {categoryTags.map(tag => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={() => handleToggleTag(tag.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">{tag.name}</div>
                        {tag.description && (
                          <div className="text-xs text-gray-500 truncate">{tag.description}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Quick Actions */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (selectedTagIds.length > 0) {
                  onChange([]);
                } else {
                  onChange(tags.map(t => t.id));
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              {selectedTagIds.length > 0 ? 'Clear All' : 'Select All'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagSelector;
