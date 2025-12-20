import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Tag {
  id: number;
  name: string;
  category: string;
  color: string;
  description?: string;
  question_count: number;
}

interface TagManagerProps {
  onTagsChange?: () => void;
}

const TAG_CATEGORIES = ['topic', 'difficulty', 'format', 'skill', 'other'];
const TAG_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Gray', value: '#6b7280' },
];

const TagManager: React.FC<TagManagerProps> = ({ onTagsChange }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'topic',
    color: '#3b82f6',
    description: '',
  });

  const API_URL = 'http://localhost:8000/api';

  useEffect(() => {
    fetchTags();
  }, [filterCategory]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const endpoint = filterCategory === 'all' 
        ? `${API_URL}/question-tags`
        : `${API_URL}/question-tags/category/${filterCategory}`;
      
      const response = await axios.get(endpoint);
      setTags(response.data.tags || response.data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingTag) {
        // Update existing tag
        await axios.put(`${API_URL}/question-tags/${editingTag.id}`, formData);
      } else {
        // Create new tag
        await axios.post(`${API_URL}/question-tags`, formData);
      }
      
      resetForm();
      fetchTags();
      onTagsChange?.();
    } catch (error: any) {
      console.error('Error saving tag:', error);
      alert(error.response?.data?.message || 'Failed to save tag');
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      category: tag.category,
      color: tag.color,
      description: tag.description || '',
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (tagId: number) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;
    
    try {
      await axios.delete(`${API_URL}/question-tags/${tagId}`);
      fetchTags();
      onTagsChange?.();
    } catch (error: any) {
      console.error('Error deleting tag:', error);
      alert(error.response?.data?.message || 'Failed to delete tag');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'topic',
      color: '#3b82f6',
      description: '',
    });
    setEditingTag(null);
    setShowCreateForm(false);
  };

  const filteredTags = tags;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Question Tags</h2>
          <p className="text-sm text-gray-600 mt-1">Organize questions with custom tags</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <i className="bx bx-plus"></i>
          {showCreateForm ? 'Cancel' : 'Create Tag'}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            {editingTag ? 'Edit Tag' : 'Create New Tag'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tag Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {TAG_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`h-10 rounded-lg border-2 transition-all ${
                        formData.color === color.value
                          ? 'border-gray-800 scale-110'
                          : 'border-gray-300 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingTag ? 'Update Tag' : 'Create Tag'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            filterCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Tags
        </button>
        {TAG_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filterCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Tags List */}
      {loading ? (
        <div className="text-center py-8">
          <i className="bx bx-loader-alt bx-spin text-4xl text-blue-600"></i>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="bx bx-tag text-4xl mb-2"></i>
          <p>No tags found. Create your first tag!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTags.map(tag => (
            <div
              key={tag.id}
              className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <h3 className="font-semibold text-gray-800">{tag.name}</h3>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  {tag.category}
                </span>
              </div>
              
              {tag.description && (
                <p className="text-sm text-gray-600 mb-3">{tag.description}</p>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {tag.question_count} {tag.question_count === 1 ? 'question' : 'questions'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                    title="Edit"
                  >
                    <i className="bx bx-edit text-lg"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="Delete"
                  >
                    <i className="bx bx-trash text-lg"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagManager;
