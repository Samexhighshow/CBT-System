import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { showSuccess, showError } from '../../utils/alerts';

interface Announcement {
  id: number;
  title: string;
  content: string;
  published: boolean;
  admin: {
    id: number;
    name: string;
  };
  published_at: string;
  created_at: string;
  updated_at: string;
}

const AdminAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPublished, setFilterPublished] = useState<'all' | 'published' | 'draft'>('all');
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    published: true,
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/announcements');
      setAnnouncements(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch announcements:', error);
      showError('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showError('Please enter a title');
      return;
    }

    if (!formData.content.trim() || formData.content.trim().length < 10) {
      showError('Content must be at least 10 characters');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Update existing
        await api.put(`/admin/announcements/${editingId}`, formData);
        showSuccess('Announcement updated successfully');
      } else {
        // Create new
        await api.post('/admin/announcements', formData);
        showSuccess('Announcement created successfully');
      }
      
      setFormData({ title: '', content: '', published: true });
      setEditingId(null);
      setShowForm(false);
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Failed to save announcement:', error);
      showError(error.response?.data?.message || 'Failed to save announcement');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setFormData({
      title: announcement.title,
      content: announcement.content,
      published: announcement.published,
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/admin/announcements/${id}`);
      showSuccess('Announcement deleted successfully');
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Failed to delete announcement:', error);
      showError('Failed to delete announcement');
    } finally {
      setLoading(false);
    }
  };

  const filteredAnnouncements = announcements.filter((announcement) => {
    const matchesSearch =
      announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      announcement.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      announcement.admin.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterPublished === 'all' ||
      (filterPublished === 'published' && announcement.published) ||
      (filterPublished === 'draft' && !announcement.published);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="app-shell py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Announcements
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage announcements for students
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ title: '', content: '', published: true });
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
          >
            <i className="bx bx-plus"></i>
            <span>New Announcement</span>
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Edit Announcement' : 'Create Announcement'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Announcement title..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Announcement content..."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>

              {/* Publish Status */}
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.published}
                    onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Publish Now</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({ title: '', content: '', published: true });
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <i className="bx bx-loader-alt animate-spin"></i>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <i className="bx bx-check"></i>
                      <span>{editingId ? 'Update' : 'Create'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search announcements..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <select
              value={filterPublished}
              onChange={(e) => setFilterPublished(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              title="Filter by publish status"
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-3">
          {filteredAnnouncements.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
              <i className="bx bx-message text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
              <p className="text-gray-500 dark:text-gray-400">
                {announcements.length === 0 ? 'No announcements yet' : 'No matching announcements'}
              </p>
            </div>
          ) : (
            filteredAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {announcement.title}
                      </h3>
                      {announcement.published ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full whitespace-nowrap">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full whitespace-nowrap">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                      {announcement.content}
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                      <p>By: <strong>{announcement.admin.name}</strong></p>
                      <p>Created: {new Date(announcement.created_at).toLocaleDateString()}</p>
                      {announcement.published_at && (
                        <p>Published: {new Date(announcement.published_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                      title="Edit"
                    >
                      <i className="bx bx-pencil text-lg"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      title="Delete"
                    >
                      <i className="bx bx-trash text-lg"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnnouncements;
