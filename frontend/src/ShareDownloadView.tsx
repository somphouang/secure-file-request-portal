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
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

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
        setError(t('share_access_error', lang));
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
      setError(t('invalid_passcode', lang));
    }
  };

  const handleSend2fa = async () => {
    try {
      await axios.post(`${API_BASE}/shares/${token}/send-download-2fa`);
      setCooldown(60);
      setError('');
      alert('2FA Passcode sent to your email.');
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Please wait 1 minute before requesting another code.');
      } else {
        setError('Failed to send 2FA code.');
      }
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
          <legend>{t('verify_access', lang)}</legend>
          <p>{t('shared_file_auth_desc', lang)}</p>
          <form onSubmit={validateSecret}>
            <div className="form-group">
              <label htmlFor="downloadSecret">{t('passcode_label', lang)}</label>
              <input 
                id="downloadSecret" 
                className="form-control" 
                type="password" 
                required 
                value={secret} 
                onChange={e => setSecret(e.target.value)} 
                placeholder={t('passcode_placeholder', lang)}
              />
            </div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">{t('verify', lang)}</button>
              <button type="button" className="btn btn-default" onClick={handleSend2fa} disabled={cooldown > 0}>
                {cooldown > 0 ? `Wait ${cooldown}s` : 'Send Passcode'}
              </button>
            </div>
          </form>
        </fieldset>
      )}

      {status === 'ready' && shareInfo && (
        <fieldset>
          <legend>{t('download_file', lang)}</legend>
          {shareInfo.caseNumber && (
            <div style={{ marginBottom: '1em', padding: '1em', backgroundColor: '#f0f0f0', borderLeft: '4px solid #0066cc' }}>
              <strong>{t('case_number_label', lang)}</strong> {shareInfo.caseNumber}
            </div>
          )}
          <p><strong>{t('file_label', lang)}</strong> {shareInfo.originalFilename}</p>
          {shareInfo.blobUri ? (
            <button className="btn btn-success" onClick={handleDownload}>
              {t('download', lang)} {shareInfo.originalFilename}
            </button>
          ) : (
            <div className="alert alert-warning">{t('file_not_ready', lang)}</div>
          )}
        </fieldset>
      )}
    </div>
  );
}
