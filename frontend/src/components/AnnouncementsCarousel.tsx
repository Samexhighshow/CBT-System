import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Announcement {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  admin: {
    name: string;
  };
  published_at: string;
}

interface AnnouncementsCarouselProps {
  limit?: number;
  autoScrollInterval?: number;
}

const AnnouncementsCarousel: React.FC<AnnouncementsCarouselProps> = ({ 
  limit = 5,
  autoScrollInterval = 5000 
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (announcements.length === 0 || isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, autoScrollInterval);

    return () => clearInterval(interval);
  }, [announcements.length, autoScrollInterval, isHovered]);

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get(`/announcements?limit=${limit}`);
      setAnnouncements(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    }
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  if (announcements.length === 0) {
    return null;
  }

  const currentAnnouncement = announcements[currentIndex];

  return (
    <div 
      className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white relative overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white rounded-full -ml-20 -mb-20"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <i className="bx bx-megaphone text-2xl"></i>
          <h3 className="text-lg font-bold">Announcements</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
            {currentIndex + 1} / {announcements.length}
          </span>
        </div>
      </div>

      {/* Carousel Content */}
      <div className="relative z-10">
        <div className="min-h-[140px] grid gap-4 md:grid-cols-3 items-center">
          <div className="md:col-span-2">
            <h4 className="text-xl font-semibold mb-2 line-clamp-2">
              {currentAnnouncement.title}
            </h4>
            <p className="text-sm text-white text-opacity-90 line-clamp-3 mb-3">
              {currentAnnouncement.content}
            </p>
            <div className="flex items-center justify-between text-xs text-white text-opacity-75">
              <span>By: {currentAnnouncement.admin.name}</span>
              <span>{new Date(currentAnnouncement.published_at).toLocaleDateString()}</span>
            </div>
          </div>
          {currentAnnouncement.image_url && (
            <div className="hidden md:block justify-self-end">
              <img
                src={currentAnnouncement.image_url}
                alt={currentAnnouncement.title}
                className="h-24 w-32 rounded-lg object-cover border border-white border-opacity-30"
              />
            </div>
          )}
        </div>

        {/* Navigation Arrows */}
        {announcements.length > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={goToPrevious}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition"
              aria-label="Previous announcement"
            >
              <i className="bx bx-chevron-left text-xl"></i>
            </button>

            {/* Dots Indicator */}
            <div className="flex space-x-2">
              {announcements.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? 'bg-white w-6'
                      : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                  }`}
                  aria-label={`Go to announcement ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={goToNext}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition"
              aria-label="Next announcement"
            >
              <i className="bx bx-chevron-right text-xl"></i>
            </button>
          </div>
        )}
      </div>

      {/* View All Link */}
      <div className="relative z-10 mt-4 pt-4 border-t border-white border-opacity-20">
        <a
          href="/announcements"
          className="text-sm font-medium hover:underline flex items-center space-x-1"
        >
          <span>View all announcements</span>
          <i className="bx bx-right-arrow-alt text-lg"></i>
        </a>
      </div>
    </div>
  );
};

export default AnnouncementsCarousel;
