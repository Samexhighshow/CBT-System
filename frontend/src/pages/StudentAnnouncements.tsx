import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { showError } from '../utils/alerts';

interface Announcement {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  admin: {
    id: number;
    name: string;
  };
  published_at: string;
  created_at: string;
}

const StudentAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/announcements?limit=20');
      setAnnouncements(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch announcements:', error);
      showError('Failed to load announcements');
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAnnouncements = announcements.filter((announcement) =>
    announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    announcement.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedAnnouncement = announcements.find((a) => a.id === selectedId);

  return (
    <div className="app-shell py-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Announcements
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Latest updates from the administration
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Announcements List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Search */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search announcements..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>

              {/* List */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    <i className="bx bx-loader-alt animate-spin text-2xl mb-2"></i>
                    <p>Loading announcements...</p>
                  </div>
                ) : filteredAnnouncements.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    <i className="bx bx-message text-3xl mb-2"></i>
                    <p className="text-sm">No announcements</p>
                  </div>
                ) : (
                  filteredAnnouncements.map((announcement) => (
                    <button
                      key={announcement.id}
                      onClick={() => setSelectedId(announcement.id)}
                      className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                        selectedId === announcement.id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : ''
                      }`}
                    >
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
                        {announcement.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(announcement.published_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Selected Announcement Details */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {selectedAnnouncement ? (
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedAnnouncement.title}
                    </h2>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>By: <strong>{selectedAnnouncement.admin.name}</strong></span>
                      <span className="hidden sm:inline">•</span>
                      <span>{new Date(selectedAnnouncement.published_at).toLocaleDateString()} {new Date(selectedAnnouncement.published_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gray-200 dark:bg-gray-700"></div>

                  {/* Content */}
                  <div className="space-y-3">
                    {selectedAnnouncement.image_url && (
                      <img
                        src={selectedAnnouncement.image_url}
                        alt={selectedAnnouncement.title}
                        className="w-full max-h-72 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                    )}
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {selectedAnnouncement.content}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="bx bx-message text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                  <p className="text-gray-500 dark:text-gray-400">
                    {announcements.length === 0
                      ? 'No announcements available'
                      : 'Select an announcement to view details'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAnnouncements;
