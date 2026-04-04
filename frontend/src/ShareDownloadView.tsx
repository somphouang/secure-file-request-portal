import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useLanguage, t } from './i18n';

const API_BASE = 'http://localhost:3001/api/public';

interface ShareInfo {
  originalFilename: string;
  status: string;
  hasDownloadSecret: boolean;
  blobUri?: string | null;
  caseNumber?: string;
  downloadCompletedAt?: string;
}

export default function ShareDownloadView() {
  const { lang } = useLanguage();
  const { token } = useParams<{ token: string }>();
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'auth' | 'ready' | 'error'>('loading');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    axios.get<ShareInfo>(`${API_BASE}/shares/${token}`)
      .then((res) => {
        setShareInfo(res.data);
        if (res.data.hasDownloadSecret) {
          setStatus('auth');
        } else {
          setStatus('ready');
        }
      })
      .catch(() => {
        setStatus('error');
        setError('Unable to access this share.');
      });
  }, [token, lang]);

  const validateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      await axios.post(`${API_BASE}/shares/${token}/validate-download`, { secret });
      setStatus('ready');
      setError('');
    } catch (err: any) {
      setStatus('auth');
      setError('Invalid passcode');
    }
  };

  const handleDownload = async () => {
    if (!token) return;
    try {
      const q = status === 'auth' ? '' : `?secret=${encodeURIComponent(secret)}`;
      const { data } = await axios.get<{ url: string }>(`${API_BASE}/shares/${token}/download${q}`);
      window.open(data.url, '_blank');
      
      // Mark download as complete
      setTimeout(async () => {
        try {
          await axios.post(`${API_BASE}/shares/${token}/mark-download-complete`, { secret });
        } catch (err) {
          console.error('Error marking download complete', err);
        }
      }, 1000);
    } catch (err) {
      setError('Failed to generate download link.');
    }
  };

  if (status === 'loading') return <div>{t('loading', lang)}</div>;

  return (
    <div>
      <h1>{t('download_portal_title', lang)}</h1>
      
      {status === 'error' && (
        <div className="alert alert-danger">
          <h2>{t('invalid_link', lang)}</h2>
          <p>{error}</p>
        </div>
      )}

      {status === 'auth' && (
        <fieldset>
          <legend>Verify Access</legend>
          <p>Enter the passcode sent to your email to access this shared file.</p>
          <form onSubmit={validateSecret}>
            <div className="form-group">
              <label htmlFor="downloadSecret">Passcode</label>
              <input 
                id="downloadSecret" 
                className="form-control" 
                type="password" 
                required 
                value={secret} 
                onChange={e => setSecret(e.target.value)} 
                placeholder="Enter passcode"
              />
            </div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <button type="submit" className="btn btn-primary">Verify</button>
          </form>
        </fieldset>
      )}

      {status === 'ready' && shareInfo && (
        <fieldset>
          <legend>Download File</legend>
          {shareInfo.caseNumber && (
            <div style={{ marginBottom: '1em', padding: '1em', backgroundColor: '#f0f0f0', borderLeft: '4px solid #0066cc' }}>
              <strong>Case Number:</strong> {shareInfo.caseNumber}
            </div>
          )}
          <p><strong>File:</strong> {shareInfo.originalFilename}</p>
          {shareInfo.blobUri ? (
            <button className="btn btn-success" onClick={handleDownload}>
              Download {shareInfo.originalFilename}
            </button>
          ) : (
            <div className="alert alert-warning">File is not yet ready for download.</div>
          )}
        </fieldset>
      )}
    </div>
  );
}
