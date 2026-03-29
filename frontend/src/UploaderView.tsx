import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { UploadCloud } from 'lucide-react';
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
}

export default function UploaderView() {
  const { lang } = useLanguage();
  const { token } = useParams<{ token: string }>();
  const [requestInfo, setRequestInfo] = useState<RequestInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  
  const [status, setStatus] = useState('loading'); // loading, ready (auth needed), authenticated, uploading, success, error, already_uploaded
  const [secret, setSecret] = useState('');
  const [secretError, setSecretError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    axios.get<RequestInfo>(`${API_BASE}/requests/${token}`)
      .then(res => {
        // ALWAYS allow them to see the form even if already uploaded, per requirements
        setRequestInfo(res.data);
        if (res.data.isClosed || (res.data.blobUri && !res.data.allowMultiple)) {
          setStatus('already_uploaded');
        } else {
          setStatus(res.data.requiresSecret ? 'ready' : 'authenticated');
        }
      })
      .catch(() => {
          setStatus('error');
      });
  }, [token]);

  const handleAuthenticate = async (e: FormEvent) => {
    e.preventDefault();
    setSecretError('');
    try {
      await axios.post(`${API_BASE}/requests/${token}/validate-secret`, { secret });
      // If it's already closed or completed, validating should show already_uploaded
      if (requestInfo?.isClosed || (requestInfo?.blobUri && !requestInfo?.allowMultiple)) {
        setStatus('already_uploaded');
      } else {
        setStatus('authenticated');
      }
    } catch (err) {
      setSecretError(t('invalid_link_desc', lang));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');

    try {
      const sasRes = await axios.post<{ url: string, blobName: string }>(`${API_BASE}/requests/${token}/sas`, { filename: file.name, secret });
      const { url, blobName } = sasRes.data;

      await axios.put(url, file, {
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': file.type || 'application/octet-stream'
        }
      });

      await axios.post(`${API_BASE}/requests/${token}/confirm`, { blobName });

      // Refresh data to show currently uploaded files and allow more uploads
      const res = await axios.get<RequestInfo>(`${API_BASE}/requests/${token}`);
      setRequestInfo(res.data);
      setFile(null);
      
      // If allowMultiple is not enabled, mark as closed immediately after 1 upload.
      if (!res.data.allowMultiple) {
          setStatus('success'); // or already_uploaded
      } else {
          setStatus('authenticated');
      }
    } catch (error) {
      console.error('Upload error', error);
      setStatus('error');
    }
  };

  const handleDone = async () => {
    try {
      if (!window.confirm("Are you sure you want to complete your upload? This request will be closed and no further files can be added.")) {
        return;
      }
      await axios.post(`${API_BASE}/requests/${token}/complete`);
      setStatus('already_uploaded');
    } catch (error) {
      console.error('Complete error', error);
      setStatus('error');
    }
  };

  if (status === 'loading') return <h1 id="main-content">{t('loading', lang)}</h1>;
  if (status === 'already_uploaded') return <div className="alert alert-success"><h2 style={{marginTop:0}}>{t('fulfilled', lang)}</h2><p>{t('fulfilled_desc', lang)}</p></div>;
  if (status === 'error') return <div className="alert alert-danger"><h2 style={{marginTop:0}}>{t('invalid_link', lang)}</h2><p>{t('invalid_link_desc', lang)}</p></div>;
  if (status === 'success') return <div className="alert alert-success"><h2 style={{marginTop:0}}>{t('success', lang)}</h2><p>{t('success_desc', lang)}</p></div>;

  return (
    <div>
      <h1 id="main-content">{t('portal_title', lang)}</h1>
      <p>{t('portal_desc', lang)}</p>

      {status === 'ready' && (
        <fieldset>
          <legend>{t('auth_req', lang)}</legend>
          <p>{t('auth_req_desc', lang)}</p>
          {secretError && <div className="alert alert-danger" role="alert">{secretError}</div>}
          <form onSubmit={handleAuthenticate}>
            <div className="form-group">
              <label htmlFor="secretInput">{t('secret', lang)}</label>
              <input 
                type="password" 
                id="secretInput"
                className="form-control"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">{t('access_portal', lang)}</button>
          </form>
        </fieldset>
      )}

      {(status === 'authenticated' || status === 'uploading') && requestInfo && (
        <fieldset>
          <legend>{t('upload_doc', lang)}</legend>

          {requestInfo.blobUri && !requestInfo.allowMultiple && (
            <div className="alert alert-success" style={{ marginBottom: '1.5em' }}>
              <strong>Upload complete! Multiple file uploads are not permitted for this request.</strong>
            </div>
          )}
          
          {requestInfo.blobUri && requestInfo.allowMultiple && (
            <div className="alert alert-info" style={{ marginBottom: '1.5em' }}>
              <strong>Files successfully uploaded for this request:</strong>
              <ul style={{ margin: '0.5em 0 0', paddingLeft: '1.5em' }}>
                {requestInfo.blobUri.split(',').map((blob: string, idx: number) => (
                  <li key={idx}>{blob}</li>
                ))}
              </ul>
              <p style={{ marginTop: '0.5em' }}>You are permitted to upload additional files.</p>
            </div>
          )}

          {(!requestInfo.blobUri || requestInfo.allowMultiple) && (
            <>
              <p><strong>{t('allowed_file_types', lang)}</strong> {requestInfo.requestedFileTypes}</p>
          
          <div 
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if(e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
            role="button"
            tabIndex={0}
            aria-label={t('click_drag', lang)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            <UploadCloud size={48} className="dropzone-icon" aria-hidden="true" />
            {file ? (
              <p className="dropzone-text">{t('selected', lang)} {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
            ) : (
              <p className="dropzone-text">{t('click_drag', lang)}</p>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
              accept={requestInfo.requestedFileTypes.split(',').map(ext => `.${ext.trim()}`).join(',')} 
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <div style={{ marginTop: '2em', display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-primary" 
              disabled={!file || status === 'uploading'}
              onClick={handleUpload}
            >
              {status === 'uploading' ? t('encrypting', lang) : t('submit_doc', lang)}
            </button>
            {requestInfo.allowMultiple && requestInfo.blobUri && (
              <button 
                type="button" 
                className="btn btn-default" 
                onClick={handleDone}
              >
                Complete Multiple Uploads
              </button>
            )}
          </div>
          </>
          )}
        </fieldset>
      )}
    </div>
  );
}
