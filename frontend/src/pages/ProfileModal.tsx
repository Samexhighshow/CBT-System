import React, { useState } from 'react';
import Modal from '../components/Modal';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { showSuccess, showError } from '../utils/alerts';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  const saveProfile = async () => {
    try {
      const formData = new FormData();
      formData.append('name', name);
      if (profilePicture) formData.append('profile_picture', profilePicture);
      const res = await api.post('/profile/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUser({ ...(user as any), name: res.data?.name ?? name, profile_picture: res.data?.profile_picture ?? user?.profile_picture });
      localStorage.setItem('user', JSON.stringify({ ...(user as any), name: res.data?.name ?? name, profile_picture: res.data?.profile_picture ?? user?.profile_picture }));
      showSuccess('Profile updated');
      onClose();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update profile');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile" size="lg" confirmText="Save" onConfirm={saveProfile}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="Enter your full name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Profile Picture</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProfilePicture(e.target.files?.[0] || null)}
            className="mt-1 w-full border rounded px-3 py-2"
            aria-label="Upload profile picture"
          />
        </div>
      </div>
    </Modal>
  );
};

export default ProfileModal;
