import React, { useState, useEffect } from 'react';
import { Upload, Plus, Edit2, Trash2, MessageSquare, Search, Download, X, User, UserPlus } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';

const ContactsPage = () => {
  const [contacts, setContacts]           = useState([]);
  const [filteredContacts, setFiltered]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [permissionGranted, setPermission] = useState(false);
  const [showPermissionDialog, setShowPerm] = useState(false);
  const [activeTab, setActiveTab]         = useState('all');

  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditing]      = useState(null);
  const [formData, setFormData]           = useState({ name: '', phone: '', email: '', notes: '' });
  const [uploading, setUploading]         = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const granted = safeLocalStorage.getItem('contacts_permission') === 'granted';
    if (granted) { setPermission(true); fetchContacts(); }
    else { setShowPerm(true); setLoading(false); }
  }, []);

  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    setFiltered(!query ? contacts : contacts.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone.includes(query) ||
      (c.email && c.email.toLowerCase().includes(query))
    ));
  }, [searchQuery, contacts]);

  const handlePermissionAllow = () => {
    safeLocalStorage.setItem('contacts_permission', 'granted');
    setPermission(true); setShowPerm(false); fetchContacts();
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const r = await axios.get(`${API}/contacts/`, { headers: { Authorization: `Bearer ${token}` } });
      setContacts(r.data.contacts);
      setFiltered(r.data.contacts);
    } catch { console.error('Could not load contacts'); }
    finally { setLoading(false); }
  };

  const handleAddContact = async () => {
    if (!formData.name || !formData.phone) {
      toast({ title: 'Missing Information', description: 'Name and phone are required', variant: 'destructive' });
      return;
    }
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(`${API}/contacts/`, formData, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'Contact Added' });
      setShowAddModal(false);
      setFormData({ name: '', phone: '', email: '', notes: '' });
      fetchContacts();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Could not add contact', variant: 'destructive' });
    }
  };

  const handleEditContact = async () => {
    if (!editingContact) return;
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.put(`${API}/contacts/${editingContact.id}`, formData, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'Contact Updated' });
      setShowEditModal(false);
      setEditing(null);
      setFormData({ name: '', phone: '', email: '', notes: '' });
      fetchContacts();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Could not update', variant: 'destructive' });
    }
  };

  const handleDeleteContact = async (contactId, contactName) => {
    if (!window.confirm(`Delete ${contactName}?`)) return;
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.delete(`${API}/contacts/${contactId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'Contact Deleted' });
      fetchContacts();
    } catch {
      toast({ title: 'Error', description: 'Could not delete contact', variant: 'destructive' });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const r = await axios.post(`${API}/contacts/upload`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      toast({ title: 'Upload Complete', description: r.data.message });
      fetchContacts();
    } catch (e) {
      toast({ title: 'Upload Failed', description: e.response?.data?.detail || 'Could not upload', variant: 'destructive' });
    } finally { setUploading(false); event.target.value = ''; }
  };

  const handleExport = async () => {
    try {
      const token = safeLocalStorage.getItem('token');
      const r = await axios.get(`${API}/contacts/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.data.csv) { toast({ title: 'No Contacts' }); return; }
      const blob = new Blob([r.data.csv], { type: 'text/csv' });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`; a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: `${r.data.total_contacts} contacts` });
    } catch { toast({ title: 'Export Failed', variant: 'destructive' }); }
  };

  const openEditModal = (contact) => {
    setEditing(contact);
    setFormData({ name: contact.name, phone: contact.phone, email: contact.email || '', notes: contact.notes || '' });
    setShowEditModal(true);
  };

  const ContactFormModal = ({ title, onSubmit, onClose }) => (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="max-w-md w-full p-6 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,166,35,0.22)' }}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>{title}</h2>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: 'var(--text-3)' }} /></button>
        </div>
        <div className="space-y-4">
          {[
            { key: 'name', label: 'Name', type: 'text', placeholder: 'John Doe', required: true },
            { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+1234567890', required: true },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'john@example.com' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--text-3)' }}>{f.label} {f.required && '*'}</label>
              <input type={f.type} value={formData[f.key]} placeholder={f.placeholder}
                onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-1)', background: 'var(--bg-input, #16161f)' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-3)' }}>Notes</label>
            <textarea value={formData.notes} rows={2} placeholder="Optional notes..."
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-1)', background: 'var(--bg-input, #16161f)' }} />
          </div>
          <button onClick={onSubmit}
            className="w-full py-3 font-extrabold rounded-xl"
            style={{ background: AMBER, color: '#111' }}>
            {title}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', paddingBottom: 57 }}>

      {/* Top bar */}
      <div className="sticky top-0 z-20" style={{ background: 'rgba(6,6,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--soft-border-2)' }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-extrabold text-[18px]" style={{ color: 'var(--text-1)' }}>Contacts</span>
          <div className="flex items-center gap-1">
            {permissionGranted && (
              <>
                <label className="p-2 rounded-xl cursor-pointer" style={{ color: AMBER, background: 'var(--soft-fill)' }} title="Upload CSV">
                  <Upload className="w-5 h-5" />
                  <input type="file" accept=".csv,.vcf" onChange={handleFileUpload} disabled={uploading} className="hidden" />
                </label>
                <button onClick={() => { setFormData({ name: '', phone: '', email: '', notes: '' }); setShowAddModal(true); }}
                  className="p-2 rounded-xl" style={{ background: AMBER, color: '#111' }} title="Add Contact">
                  <Plus className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pb-3 flex items-center gap-2">
          {['all', 'favorite'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 font-bold text-sm rounded-full capitalize"
              style={{
                color: activeTab === tab ? '#111' : 'var(--text-2)',
                background: activeTab === tab ? AMBER : 'var(--soft-fill)',
                border: activeTab === tab ? 'none' : '1px solid var(--soft-border)',
              }}>
              {tab === 'all' ? 'All' : 'Favorite'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        {/* Permission dialog */}
        {showPermissionDialog && (
          <div className="fixed inset-0 flex items-center justify-center p-6 z-50"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="max-w-sm w-full p-6 rounded-2xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,166,35,0.28)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(245,166,35,0.15)' }}>
                <User className="w-8 h-8" style={{ color: AMBER }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-1)' }}>Contacts</h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Enable access to manage and sync your Calliotel contacts.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowPerm(false)}
                  className="flex-1 py-3 font-semibold rounded-xl" style={{ background: 'var(--soft-fill)', color: 'var(--text-2)', border: '1px solid var(--soft-border)' }}>
                  Cancel
                </button>
                <button onClick={handlePermissionAllow}
                  className="flex-1 py-3 font-extrabold rounded-xl" style={{ background: AMBER, color: '#111' }}>
                  Allow
                </button>
              </div>
            </div>
          </div>
        )}

        {!permissionGranted && !showPermissionDialog ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <span style={{ fontSize: 56 }}>👥</span>
            <h3 className="text-lg font-bold mt-4 mb-2" style={{ color: 'var(--text-1)' }}>Contact Access Denied</h3>
            <p className="text-sm mb-6" style={{ color: '#666' }}>Enable access to view and manage your contacts.</p>
            <button onClick={() => setShowPerm(true)}
              className="px-6 py-3 font-extrabold rounded-xl" style={{ background: AMBER, color: '#111' }}>
              Enable Access
            </button>
          </div>
        ) : permissionGranted && (
          <>
            {/* Search */}
            <div className="px-4 pt-3 pb-2" style={{ background: 'var(--bg-page)' }}>
              <div className="relative">
                <input type="text" placeholder="Search" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid #2a2a2a', color: 'var(--text-1)' }} />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: AMBER }} />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                  style={{ borderColor: AMBER, borderTopColor: 'transparent' }} />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <span style={{ fontSize: 48 }}>👤</span>
                <h3 className="text-base font-bold mt-4 mb-1" style={{ color: 'var(--text-1)' }}>
                  {searchQuery ? 'No contacts found' : 'No Contacts'}
                </h3>
                <p className="text-sm mb-4" style={{ color: '#666' }}>
                  {searchQuery ? 'Try a different search' : 'Add your first contact or upload a CSV file'}
                </p>
                {!searchQuery && (
                  <div className="flex gap-3">
                    <button onClick={() => { setFormData({ name: '', phone: '', email: '', notes: '' }); setShowAddModal(true); }}
                      className="px-5 py-2.5 text-sm font-extrabold rounded-xl flex items-center gap-2"
                      style={{ background: AMBER, color: '#111' }}>
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between px-5 py-2">
                  <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#555' }}>
                    {filteredContacts.length} Contact{filteredContacts.length !== 1 ? 's' : ''}
                  </span>
                  <button onClick={handleExport}
                    className="text-xs font-semibold flex items-center gap-1" style={{ color: AMBER }}>
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
                <div>
                  {filteredContacts.map(contact => (
                    <div key={contact.id}
                      className="flex items-center gap-3 px-4 py-3.5"
                      style={{ borderBottom: '1px solid #1e1e1e' }}>
                      <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(245,166,35,0.16)' }}>
                        <span className="font-bold text-sm" style={{ color: AMBER }}>
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{contact.name}</p>
                        <p className="text-xs" style={{ color: '#666' }}>{contact.phone}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/sms?to=${contact.phone}`)}
                          className="p-2 rounded-lg" style={{ color: AMBER }}>
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEditModal(contact)}
                          className="p-2 rounded-lg" style={{ color: '#555' }}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteContact(contact.id, contact.name)}
                          className="p-2 rounded-lg" style={{ color: '#5a2020' }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showAddModal  && <ContactFormModal title="Add Contact"   onSubmit={handleAddContact}  onClose={() => setShowAddModal(false)} />}
      {showEditModal && <ContactFormModal title="Save Changes"  onSubmit={handleEditContact} onClose={() => setShowEditModal(false)} />}

      <BottomNav />
    </div>
  );
};

export default ContactsPage;
