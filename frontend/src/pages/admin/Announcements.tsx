import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';

interface Announcement {
  id: number;
  title: string;
  content: string;
  published: boolean;
  admin?: {
    id: number;
    name: string;
  };
  image_url?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200';

const getApiErrorMessage = (error: any, fallback: string): string => {
  const responseData = error?.response?.data;
  const message = typeof responseData?.message === 'string' ? responseData.message : '';
  const errors = responseData?.errors;

  if (errors && typeof errors === 'object') {
    const firstField = Object.keys(errors)[0];
    const firstError = firstField && Array.isArray(errors[firstField]) ? errors[firstField][0] : null;
    if (firstError) {
      return message ? `${message}: ${firstError}` : String(firstError);
    }
  }

  if (message) return message;
  return fallback;
};

const AdminAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPublished, setFilterPublished] = useState<'all' | 'published' | 'draft'>('all');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    published: true,
    image_url: '' as string | null,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormData({ title: '', content: '', published: true, image_url: '' });
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/announcements', { params: { limit: 100 } });
      setAnnouncements(response.data.data || []);
    } catch (error: any) {
      showError(getApiErrorMessage(error, 'Failed to load announcements'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showError('Please enter a title.');
      return;
    }

    if (!formData.content.trim() || formData.content.trim().length < 10) {
      showError('Content must be at least 10 characters.');
      return;
    }

    const payload = new FormData();
    payload.append('title', formData.title.trim());
    payload.append('content', formData.content.trim());
    payload.append('published', formData.published ? '1' : '0');
    if (imageFile) payload.append('image', imageFile);
    if (formData.image_url && !imageFile) payload.append('image_url', formData.image_url);
    if (removeImage) payload.append('remove_image', '1');

    setSaving(true);
    try {
      if (editingId) {
        await api.post(`/admin/announcements/${editingId}?_method=PUT`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        showSuccess('Announcement updated successfully.');
      } else {
        await api.post('/admin/announcements', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        showSuccess('Announcement created successfully.');
      }

      resetForm();
      setShowForm(false);
      await fetchAnnouncements();
    } catch (error: any) {
      showError(getApiErrorMessage(error, 'Failed to save announcement'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setFormData({
      title: announcement.title,
      content: announcement.content,
      published: announcement.published,
      image_url: announcement.image_url || '',
    });
    setImagePreview(announcement.image_url || null);
    setImageFile(null);
    setRemoveImage(false);
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this announcement?')) return;

    setLoading(true);
    try {
      await api.delete(`/admin/announcements/${id}`);
      showSuccess('Announcement deleted successfully.');
      await fetchAnnouncements();
    } catch (error: any) {
      showError(getApiErrorMessage(error, 'Failed to delete announcement'));
    } finally {
      setLoading(false);
    }
  };

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((announcement) => {
      const authorName = announcement.admin?.name || '';
      const query = searchTerm.toLowerCase();

      const matchesSearch =
        announcement.title.toLowerCase().includes(query) ||
        announcement.content.toLowerCase().includes(query) ||
        authorName.toLowerCase().includes(query);

      const matchesFilter =
        filterPublished === 'all' ||
        (filterPublished === 'published' && announcement.published) ||
        (filterPublished === 'draft' && !announcement.published);

      return matchesSearch && matchesFilter;
    });
  }, [announcements, searchTerm, filterPublished]);

  const stats = useMemo(() => {
    const total = announcements.length;
    const published = announcements.filter((item) => item.published).length;
    const drafts = total - published;
    const withImages = announcements.filter((item) => !!item.image_url).length;
    return { total, published, drafts, withImages };
  }, [announcements]);

  return (
    <div className="app-shell section-shell space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-cyan-50 via-white to-blue-50 p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Communication Center</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Announcements</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Create and publish student notices with better visibility and control.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
          >
            <i className="bx bx-plus text-base" />
            New Announcement
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Published</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{stats.published}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs uppercase tracking-wide text-amber-700">Drafts</p>
            <p className="mt-1 text-2xl font-bold text-amber-800">{stats.drafts}</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-xs uppercase tracking-wide text-indigo-700">With Image</p>
            <p className="mt-1 text-2xl font-bold text-indigo-800">{stats.withImages}</p>
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Announcement' : 'Create Announcement'}</h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Announcement title"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your announcement..."
                  rows={7}
                  className={`${inputClass} resize-y`}
                />
                <p className="mt-1 text-xs text-slate-500">Minimum 10 characters</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700" htmlFor="announcement-image">
                  Optional Image
                </label>
                <input
                  id="announcement-image"
                  type="file"
                  accept="image/*"
                  title="Announcement image"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                    setRemoveImage(false);
                    if (file) {
                      setImagePreview(URL.createObjectURL(file));
                    }
                  }}
                  className={inputClass}
                />
                {(formData.image_url || imagePreview) && (
                  <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={removeImage}
                      onChange={(e) => setRemoveImage(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Remove image
                  </label>
                )}
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.published}
                  onChange={(e) => setFormData((prev) => ({ ...prev, published: e.target.checked }))}
                  className="h-4 w-4"
                />
                Publish now
              </label>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <i className="bx bx-loader-alt animate-spin" /> : <i className="bx bx-check" />}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Preview</p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">{formData.title || 'Announcement title'}</h3>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                {formData.content || 'Announcement content will appear here...'}
              </p>

              {(imagePreview || formData.image_url) && !removeImage && (
                <img
                  src={imagePreview || formData.image_url || ''}
                  alt="Announcement preview"
                  className="mt-3 h-36 w-full rounded-lg border border-slate-200 object-cover"
                />
              )}

              <div className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: formData.published ? '#059669' : '#64748b' }}>
                {formData.published ? 'Will be published immediately' : 'Saved as draft'}
              </div>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, content, or author..."
              className={inputClass}
            />
          </div>
          <select
            value={filterPublished}
            onChange={(e) => setFilterPublished(e.target.value as 'all' | 'published' | 'draft')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
            title="Filter announcements"
          >
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading announcements...</div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <i className="bx bx-message-rounded-dots text-5xl text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">{announcements.length === 0 ? 'No announcements yet.' : 'No matching announcements.'}</p>
          </div>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <article
              key={announcement.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md md:p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-bold text-slate-900">{announcement.title}</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        announcement.published
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {announcement.published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{announcement.content}</p>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>By: <strong className="text-slate-700">{announcement.admin?.name || 'Admin'}</strong></span>
                    <span>Created: {new Date(announcement.created_at).toLocaleString()}</span>
                    {announcement.published_at && (
                      <span>Published: {new Date(announcement.published_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  {announcement.image_url ? (
                    <img
                      src={announcement.image_url}
                      alt={announcement.title}
                      className="h-20 w-28 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : null}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(announcement)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                      title="Edit announcement"
                    >
                      <i className="bx bx-pencil text-lg" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(announcement.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                      title="Delete announcement"
                    >
                      <i className="bx bx-trash text-lg" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
};

export default AdminAnnouncements;
