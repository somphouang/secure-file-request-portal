import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useLanguage, t } from './i18n';

const API_BASE = 'http://localhost:3001/api/public';

interface RequestInfo {
  uploaderEmail: string;
  requestedFileTypes: string;
  status: string;
  requiresSecret: boolean;
  blobUri?: string | null;
  allowMultiple?: boolean;
  isClosed?: boolean;
  caseNumber?: string;
  downloadCompletedAt?: string;
}

export default function DownloaderView() {
  const { lang } = useLanguage();
  const { token } = useParams<{ token: string }>();
  const [requestInfo, setRequestInfo] = useState<RequestInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'auth' | 'ready' | 'error'>('loading');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    axios.get<RequestInfo>(`${API_BASE}/requests/${token}`)
      .then((res) => {
        setRequestInfo(res.data);
        setStatus('auth');
      })
      .catch(() => {
        setStatus('error');
        setError(t('invalid_link_desc', lang));
      });
  }, [token, lang]);

  const validateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      await axios.post(`${API_BASE}/requests/${token}/validate-download`, { secret });
      setStatus('ready');
      setError('');
    } catch (err: any) {
      setStatus('auth');
      setError(t('invalid_link_desc', lang));
    }
  };

  const handleDownload = async (filename?: string) => {
    if (!token) return;
    try {
      const q = `?secret=${encodeURIComponent(secret)}${filename ? `&filename=${encodeURIComponent(filename)}` : ''}`;
      const { data } = await axios.get<{ url: string }>(`${API_BASE}/requests/${token}/download${q}`);
      window.open(data.url, '_blank');
      
      // Mark download as complete
      setTimeout(async () => {
        try {
          await axios.post(`${API_BASE}/requests/${token}/mark-download-complete`, { secret });
        } catch (err) {
          console.error('Error marking download complete', err);
        }
      }, 1000);
    } catch (err) {
      setError(t('download_error', lang));
    }
  };

  if (status === 'loading') return <div>{t('loading', lang)}</div>;
  if (status === 'error') return <div className="alert alert-danger"><h2>{t('invalid_link', lang)}</h2><p>{error}</p></div>;

  if (status === 'auth') {
    return (
      <div>
        <h1>{t('download_portal_title', lang)}</h1>
        <p>{t('download_portal_desc', lang)}</p>
        <form onSubmit={validateSecret}> 
          <div className="form-group">
            <label htmlFor="downloadSecret">Passcode</label>
            <input id="downloadSecret" className="form-control" type="password" required value={secret} onChange={e => setSecret(e.target.value)} />
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <button type="submit" className="btn btn-primary">{t('validate_passcode', lang)}</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1>{t('download_portal_title', lang)}</h1>
      <p>{t('download_portal_desc', lang)}</p>
      {requestInfo?.caseNumber && (
        <div style={{ marginBottom: '1em', padding: '1em', backgroundColor: '#f0f0f0', borderLeft: '4px solid #0066cc' }}>
          <strong>Case Number:</strong> {requestInfo.caseNumber}
        </div>
      )}
      {requestInfo?.blobUri ? (
        <div>
          <p>{t('available_files', lang)}</p>
          <ul>
            {requestInfo.blobUri.split(',').map((blob, idx) => (
              <li key={idx}>
                {blob} <button className="btn btn-small btn-success" onClick={() => handleDownload(blob)}>{t('download', lang)}</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="alert alert-warning">{t('no_files_available', lang)}</div>
      )}
    </div>
  );
}
