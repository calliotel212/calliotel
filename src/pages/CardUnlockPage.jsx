import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';

const fileToB64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function CardUnlockPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [idType, setIdType] = useState('passport');
  const [idFile, setIdFile] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token = safeLocalStorage.getItem('token');
    axios.get(`${API}/payments/stripe/card-status`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => setStatus(r.data)).catch(() => setStatus({ blocked: true, documents_required: true }));
  }, []);

  const submit = async () => {
    if (!idFile || !selfieFile) {
      toast({ title: 'Add both photos', description: 'Government ID and a selfie holding the ID.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const [id_image_b64, selfie_b64] = await Promise.all([fileToB64(idFile), fileToB64(selfieFile)]);
      await axios.post(`${API}/payments/stripe/unlock-documents`, {
        id_type: idType,
        id_image_b64,
        selfie_b64,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setDone(true);
      toast({ title: 'Documents received', description: 'We will review and unlock cards if everything checks out.' });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err.response?.data?.detail || 'Email the photos to support@calliotel.com instead.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', paddingBottom: 72 }}>
      <div style={{ borderBottom: '1px solid #1e1e1e', padding: '12px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>Unlock card payments</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#666' }}>ID + selfie after 3 declined cards</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
        <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', gap: 10 }}>
          <ShieldAlert size={20} color={AMBER} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' }}>
            Card payments are locked on this account. Upload a photo of your government ID and a selfie holding that ID.
            You can also email both photos to support@calliotel.com. Crypto still works.
          </p>
        </div>

        {done ? (
          <p style={{ color: '#22c55e', fontWeight: 700 }}>Documents submitted. We will email you after review.</p>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>ID type</label>
            <select value={idType} onChange={(e) => setIdType(e.target.value)} style={{ width: '100%', marginBottom: 14, padding: 10, borderRadius: 8, background: '#111', color: '#fff', border: '1px solid #333' }}>
              <option value="passport">Passport</option>
              <option value="national_id">National ID</option>
              <option value="drivers_license">Driver’s license</option>
            </select>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>ID photo</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)} style={{ marginBottom: 14, color: '#ccc' }} />
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Selfie holding the ID</label>
            <input type="file" accept="image/*" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} style={{ marginBottom: 18, color: '#ccc' }} />
            <button
              type="button"
              onClick={submit}
              disabled={sending || !status}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: AMBER, color: '#000', fontWeight: 800, cursor: 'pointer' }}
            >
              {sending ? <Loader size={18} className="animate-spin" style={{ margin: '0 auto' }} /> : 'Submit documents'}
            </button>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
