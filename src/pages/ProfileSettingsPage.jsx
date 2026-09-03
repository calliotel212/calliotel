import React, { useState, useEffect } from 'react';
import { Upload, ArrowLeft, Trash2 } from 'lucide-react';
import useGoBack from '../hooks/useGoBack';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const ProfileSettingsPage = () => {
  const goBack = useGoBack('/dashboard');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleDeleteAccount = async () => {
    if (deleteText.trim().toLowerCase() !== 'delete') {
      toast({ title: 'Type "delete" to confirm', variant: 'destructive' });
      return;
    }
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/auth/account`, { headers: { Authorization: `Bearer ${token}` } });
      await logout();
      navigate('/login');
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Failed to delete account', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load profile', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File too large. Max 5MB', variant: 'destructive' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Error', description: 'Invalid file type. Use JPG, PNG, or WEBP', variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API}/api/profile/upload-avatar`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setProfile({ ...profile, profile_picture: response.data.avatar_url });
      toast({ title: 'Avatar Updated!', description: 'Your profile picture has been uploaded', duration: 3000 });
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to upload avatar', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ember"></div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-ember to-ember-light text-white p-6">
        <button onClick={goBack} className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-3 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-sm opacity-90 mt-1">Manage your account</p>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Profile Picture */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Profile Picture</h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-3xl font-bold text-white overflow-hidden">
              {profile.profile_picture ? (
                <img src={`${API}${profile.profile_picture}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile.email?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <label
                htmlFor="avatar-upload"
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-ember text-black rounded-lg hover:bg-ember-light transition-colors"
              >
                {uploading ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Uploading...</>
                ) : (
                  <><Upload size={18} /> Upload New Photo</>
                )}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploading}
              />
              <p className="text-xs text-gray-500 mt-2">JPG, PNG, or WEBP • Max 5MB</p>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Account Info</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-900">{profile.email}</span>
            </div>
            {profile.name && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Name</span>
                <span className="text-sm font-medium text-gray-900">{profile.name}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">Member Since</span>
              <span className="text-sm font-medium text-gray-900">
                {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Delete Account */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-red-100">
          <h2 className="text-lg font-bold text-red-600 mb-1">Delete Account</h2>
          <p className="text-sm text-gray-500 mb-4">
            Permanently delete your account and all associated data — numbers, messages, wallet balance. This cannot be undone.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => { setShowDeleteConfirm(true); setDeleteText(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
            >
              <Trash2 size={16} /> Delete My Account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Type <strong>"delete"</strong> to confirm:</p>
              <input
                type="text"
                value={deleteText}
                onChange={e => setDeleteText(e.target.value)}
                placeholder='Type "delete"'
                className="w-full px-4 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteText.toLowerCase() !== 'delete'}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                  {deleting ? 'Deleting…' : 'Delete Permanently'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteText(''); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      <BottomNav />
    </div>
  );
};

export default ProfileSettingsPage;
