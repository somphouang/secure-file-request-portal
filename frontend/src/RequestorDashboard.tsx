import { useState, useEffect, FormEvent } from 'react';
import axios from 'axios';
import { Plus, Download, RefreshCw, Upload } from 'lucide-react';

import { useMsal } from "@azure/msal-react";
import { useLanguage, t } from './i18n';

const API_BASE = 'http://localhost:3001/api';

interface UploadRequest {
  partitionKey: string;
  rowKey: string;
  uploaderEmail: string;
  requestedFileTypes: string;
  status: string;
  expiresAt: string;
  blobUri?: string;
  allowMultiple?: boolean;
  fileStatuses?: string;
  requestNumber: string;
  caseNumber: string;
  downloaderEmail?: string;
  sharedForDownload?: boolean;
  downloadCompletedAt?: string;
}

interface FileShare {
  partitionKey: string;
  rowKey: string;
  originalFilename: string;
  status: string;
  expiresAt: string;
  blobUri?: string;
  downloaderEmail?: string;
  requestNumber: string;
  caseNumber: string;
}

export default function RequestorDashboard() {
  const { instance, accounts } = useMsal();
  const { lang } = useLanguage();
  
  const getAxiosConfig = async () => {
    if (accounts.length > 0) {
      try {
        const response = await instance.acquireTokenSilent({
          scopes: ["User.Read"],
          account: accounts[0]
        });
        return { headers: { Authorization: `Bearer ${response.accessToken}` } };
      } catch (e) {
        return { headers: { 'x-user-email': accounts[0].username } };
      }
    }
    return {};
  };

  const [requests, setRequests] = useState<UploadRequest[]>([]);
  const [shares, setShares] = useState<FileShare[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [showShareForm, setShowShareForm] = useState(false);
  const [newRequest, setNewRequest] = useState({ 
    uploaderEmail: '', 
    requestedFileTypes: 'pdf,xlsx',
    expirationDays: '7',
    allowMultiple: false,
    caseNumber: ''
  });
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [uploadingShare, setUploadingShare] = useState(false);
  const [newShare, setNewShare] = useState({ 
    downloaderEmail: '', 
    expirationDays: '7',
    caseNumber: ''
  });
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    fetchRequests();
    fetchShares();
  }, [accounts]); 

  const fetchRequests = async () => {
    try {
      const config = await getAxiosConfig();
      const { data } = await axios.get<UploadRequest[]>(`${API_BASE}/requests`, config);
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch requests', error);
    }
  };

  const fetchShares = async () => {
    try {
      const config = await getAxiosConfig();
      const { data } = await axios.get<FileShare[]>(`${API_BASE}/shares`, config);
      setShares(data);
    } catch (error) {
      console.error('Failed to fetch shares', error);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const config = await getAxiosConfig();
      await axios.post(`${API_BASE}/requests`, newRequest, config);
      setShowConfig(false);
      setNewRequest({ uploaderEmail: '', requestedFileTypes: 'pdf,xlsx', expirationDays: '7', allowMultiple: false, caseNumber: '' });
      fetchRequests();
    } catch (error) {
      console.error('Failed to create request', error);
      alert(t('error_creating_request', lang));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (token: string, blobName?: string) => {
    try {
      const config = await getAxiosConfig();
      const { data } = await axios.get<{ url: string }>(`${API_BASE}/requests/${token}/download${blobName ? `?filename=${encodeURIComponent(blobName)}` : ''}`, config);
      window.open(data.url, '_blank');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to get download link.';
      alert(errorMessage);
    }
  };

  const shareToSharePoint = async (token: string, blobName?: string) => {
    try {
      // Get the file download URL
      const config = await getAxiosConfig();
      const { data } = await axios.get<{ url: string }>(`${API_BASE}/requests/${token}/download${blobName ? `?filename=${encodeURIComponent(blobName)}` : ''}`, config);
      
      // Download the file
      const fileResponse = await axios.get(data.url, { responseType: 'blob' });
      const fileBlob = fileResponse.data;
      
      // Get Microsoft Graph token
      const tokenResponse = await instance.acquireTokenSilent({
        scopes: ["https://graph.microsoft.com/Files.ReadWrite.All", "https://graph.microsoft.com/Sites.ReadWrite.All"],
        account: accounts[0]
      });
      
      // Upload to SharePoint - using default Documents library
      const sharePointUrl = `https://graph.microsoft.com/v1.0/sites/root/drive/root:/${encodeURIComponent(blobName || 'uploaded-file')}`;
      
      await axios.put(sharePointUrl, fileBlob, {
        headers: {
          'Authorization': `Bearer ${tokenResponse.accessToken}`,
          'Content-Type': fileBlob.type || 'application/octet-stream'
        }
      });
      
      alert(t('file_uploaded_sharepoint', lang));
    } catch (error) {
      console.error('Failed to share to SharePoint', error);
      alert(t('failed_upload_sharepoint', lang));
    }
  };

  const inviteDownloader = async (token: string, blobName?: string) => {
    const downloaderEmail = window.prompt(t('downloader_email_prompt', lang));
    if (!downloaderEmail) return;

    try {
      const config = await getAxiosConfig();
      await axios.post(`${API_BASE}/requests/${token}/invite-downloader`, { 
        downloaderEmail,
        blobName 
      }, config);
      alert(t('invitation_sent', lang));
      fetchShares(); // Refresh the shares list to show the new share
    } catch (error) {
      console.error('Failed to send downloader invite', error);
      alert(t('failed_send_invite', lang));
    }
  };

  const handleShareFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setShareFile(e.target.files[0]);
    }
  };

  const uploadAndShareFile = async (e: FormEvent) => {
    e.preventDefault();
    if (!shareFile || !newShare.downloaderEmail) return;
    setUploadingShare(true);

    try {
      const config = await getAxiosConfig();
      
      // Step 1: Get upload SAS with expiration
      const sasRes = await axios.post<{ url: string; blobName: string; token: string }>(
        `${API_BASE}/shares/upload`,
        { 
          filename: shareFile.name,
          expirationDays: parseInt(newShare.expirationDays),
          caseNumber: newShare.caseNumber
        },
        config
      );
      const { url, blobName, token } = sasRes.data;

      // Step 2: Upload file to blob
      await axios.put(url, shareFile, {
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': shareFile.type || 'application/octet-stream'
        }
      });

      // Step 3: Confirm upload
      await axios.post(
        `${API_BASE}/shares/confirm`,
        { token, blobName, filename: shareFile.name },
        config
      );

      // Step 4: Invite downloader
      await axios.post(
        `${API_BASE}/shares/${token}/invite`,
        { downloaderEmail: newShare.downloaderEmail },
        config
      );

      alert(t('file_uploaded_invitation_sent', lang));
      setShareFile(null);
      setNewShare({ downloaderEmail: '', expirationDays: '7', caseNumber: '' });
      setShowShareForm(false);
      fetchShares();
    } catch (error) {
      console.error('Upload error', error);
      alert(t('failed_upload_invitation', lang));
    } finally {
      setUploadingShare(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const translatedStatus = (() => {
      switch(status) {
        case 'Pending': return t('status_pending', lang);
        case 'Uploaded': return t('status_uploaded', lang);
        case 'Scanning': return t('status_scanning', lang);
        case 'Clean': return t('status_clean', lang);
        case 'Malicious': return t('status_malicious', lang);
        case 'Awaiting Download': return t('status_awaiting_download', lang);
        case 'Downloaded': return t('status_downloaded', lang);
        case 'Ready': return t('status_ready', lang);
        default: return status;
      }
    })();
    
    switch(status) {
      case 'Pending': return <span className="badge badge-warning">{translatedStatus}</span>;
      case 'Uploaded': return <span className="badge badge-info">{translatedStatus}</span>;
      case 'Scanning': return <span className="badge badge-primary">{translatedStatus}</span>;
      case 'Clean': return <span className="badge badge-success">{translatedStatus}</span>;
      case 'Ready': return <span className="badge badge-success">{translatedStatus}</span>;
      case 'Malicious': return <span className="badge badge-danger">{translatedStatus}</span>;
      case 'Awaiting Download': return <span className="badge badge-secondary">{translatedStatus}</span>;
      case 'Downloaded': return <span className="badge badge-success">✓ {translatedStatus}</span>;
      default: return <span className="badge">{translatedStatus}</span>;
    }
  };

  const getFileStatus = (req: UploadRequest, blobName: string) => {
    if (!req.fileStatuses) return req.status;
    try {
      const statuses = JSON.parse(req.fileStatuses);
      return statuses[blobName] || req.status;
    } catch {
      return req.status;
    }
  };

  return (
    <div>
      <h1 id="main-content">{t('dashboard_title', lang)}</h1>
      
      <p>{t('dashboard_desc', lang)} {t('logged_in_as', lang)} <strong>{accounts[0]?.username || 'admin@example.com'}</strong>.</p>
        
      <button className="btn btn-primary" onClick={() => setShowConfig(!showConfig)} aria-expanded={showConfig}>
        <Plus size={16} aria-hidden="true" style={{verticalAlign: '-3px', marginRight: '5px'}}/>
        {t('create_request', lang)}
      </button>

      {showConfig && (
        <fieldset>
          <legend>{t('req_details', lang)}</legend>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="uploaderEmail">{t('uploader_email', lang)} <span className="required">{t('required', lang)}</span></label>
              <span className="hint-text">{t('hint_email', lang)}</span>
              <input 
                type="email" 
                className="form-control"
                id="uploaderEmail"
                required
                value={newRequest.uploaderEmail}
                onChange={e => setNewRequest({...newRequest, uploaderEmail: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label htmlFor="allowedTypes">{t('allowed_types', lang)} <span className="required">{t('required', lang)}</span></label>
              <span className="hint-text">{t('hint_types', lang)}</span>
              <input 
                type="text" 
                className="form-control"
                id="allowedTypes"
                required
                value={newRequest.requestedFileTypes}
                onChange={e => setNewRequest({...newRequest, requestedFileTypes: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label htmlFor="caseNumber">{t('case_number', lang)}</label>
              <span className="hint-text">{t('case_number_hint', lang)}</span>
              <input 
                type="text" 
                className="form-control"
                id="caseNumber"
                value={newRequest.caseNumber}
                onChange={e => setNewRequest({...newRequest, caseNumber: e.target.value})}
                placeholder={t('case_number_placeholder', lang)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="allowMultiple" style={{ fontWeight: 'normal' }}>
                <input 
                  type="checkbox" 
                  id="allowMultiple"
                  checked={newRequest.allowMultiple}
                  onChange={e => setNewRequest({...newRequest, allowMultiple: e.target.checked})}
                  style={{ marginRight: '8px' }}
                />
                {t('allow_multiple', lang)}
              </label>
            </div>
            <div className="form-group">
              <label htmlFor="expirationDays">{t('link_exp', lang)} <span className="required">{t('required', lang)}</span></label>
              <select 
                className="form-control" 
                id="expirationDays" 
                value={newRequest.expirationDays}
                onChange={e => setNewRequest({...newRequest, expirationDays: e.target.value})}
              >
                <option value="1">1 {t('day', lang)}</option>
                <option value="7">7 {t('days', lang)}</option>
                <option value="14">14 {t('days', lang)}</option>
                <option value="30">30 {t('days', lang)}</option>
              </select>
            </div>
            <div style={{ marginTop: '1.5em' }}>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? '...' : t('submit', lang)}
              </button>
              <button type="button" className="btn btn-default" style={{ marginLeft: '10px' }} onClick={() => setShowConfig(false)}>
                {t('cancel', lang)}
              </button>
            </div>
          </form>
        </fieldset>
      )}

      <button className="btn btn-primary" onClick={() => setShowShareForm(!showShareForm)} aria-expanded={showShareForm} style={{ marginLeft: '10px' }}>
        <Upload size={16} aria-hidden="true" style={{verticalAlign: '-3px', marginRight: '5px'}}/>
        {t('share_a_file', lang)}
      </button>

      {showShareForm && (
        <fieldset style={{ marginTop: '1em' }}>
          <legend>{t('share_file_with_downloader', lang)}</legend>
          <form onSubmit={uploadAndShareFile}>
            <div className="form-group">
              <label htmlFor="shareFile">{t('select_file_to_share', lang)} <span className="required">*</span></label>
              <input 
                type="file" 
                className="form-control"
                id="shareFile"
                onChange={handleShareFile}
                required
              />
              {shareFile && <p style={{ marginTop: '0.5em', fontSize: '0.9em', color: '#666' }}>{t('selected', lang)}: {shareFile.name}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="downloaderEmail">{t('downloader_email', lang)} <span className="required">*</span></label>
              <span className="hint-text">{t('downloader_email_hint', lang)}</span>
              <input 
                type="email" 
                className="form-control"
                id="downloaderEmail"
                required
                value={newShare.downloaderEmail}
                onChange={e => setNewShare({...newShare, downloaderEmail: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label htmlFor="shareExpirationDays">{t('link_expiration', lang)} <span className="required">*</span></label>
              <select 
                className="form-control" 
                id="shareExpirationDays" 
                value={newShare.expirationDays}
                onChange={e => setNewShare({...newShare, expirationDays: e.target.value})}
              >
                <option value="1">{t('one_day', lang)}</option>
                <option value="7">{t('seven_days', lang)}</option>
                <option value="14">{t('fourteen_days', lang)}</option>
                <option value="30">{t('thirty_days', lang)}</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="shareCaseNumber">{t('case_number', lang)}</label>
              <span className="hint-text">{t('case_number_hint', lang)}</span>
              <input 
                type="text" 
                className="form-control"
                id="shareCaseNumber"
                value={newShare.caseNumber}
                onChange={e => setNewShare({...newShare, caseNumber: e.target.value})}
                placeholder={t('case_number_placeholder', lang)}
              />
            </div>
            <div style={{ marginTop: '1.5em' }}>
              <button className="btn btn-primary" type="submit" disabled={!shareFile || !newShare.downloaderEmail || uploadingShare}>
                {uploadingShare ? t('uploading_and_sending', lang) : t('upload_and_send_invitation', lang)}
              </button>
              <button type="button" className="btn btn-default" style={{ marginLeft: '10px' }} onClick={() => { 
                setShowShareForm(false); 
                setShareFile(null); 
                setNewShare({ downloaderEmail: '', expirationDays: '7', caseNumber: '' });
              }}>
                {t('cancel', lang)}
              </button>
            </div>
          </form>
        </fieldset>
      )}

      <h2>{t('active_requests', lang)}</h2>
      <button className="btn btn-default" onClick={fetchRequests}>
        <RefreshCw size={14} aria-hidden="true" style={{verticalAlign: '-2px', marginRight: '5px'}}/> {t('refresh', lang)}
      </button>

      {requests.length === 0 ? (
        <div className="alert alert-info" style={{ marginTop: '1em' }}>
          {t('no_requests', lang)}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t('table_request_number', lang)}</th>
              <th scope="col">{t('table_case_number', lang)}</th>
              <th scope="col">{t('table_uploader', lang)}</th>
              <th scope="col">{t('table_type', lang)}</th>
              <th scope="col">{t('table_status', lang)}</th>
              <th scope="col">{t('table_expires', lang)}</th>
              <th scope="col">{t('table_action', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.rowKey}>
                <td><strong>{req.requestNumber}</strong></td>
                <td><strong>{req.caseNumber || '--'}</strong></td>
                <td>{req.uploaderEmail}</td>
                <td>{req.requestedFileTypes.toUpperCase()}</td>
                <td>{getStatusBadge(req.status)}</td>
                <td>{new Date(req.expiresAt).toLocaleDateString()}</td>
                <td>
                  {req.blobUri ? (
                    <div>
                      {req.blobUri.split(',').map((blobName: string, idx: number) => {
                        const fileStatus = getFileStatus(req, blobName);
                        return (
                          <div key={idx} style={{ marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {fileStatus === 'Malicious' ? (
                              <button className="btn btn-danger" disabled>
                                <Download size={14} aria-hidden="true" style={{verticalAlign: '-2px'}}/> {t('download', lang)} {blobName}
                              </button>
                            ) : (
                              <button className="btn btn-success" onClick={() => handleDownload(req.rowKey, blobName)}>
                                <Download size={14} aria-hidden="true" style={{verticalAlign: '-2px'}}/> {t('download', lang)} {blobName}
                              </button>
                            )}
                            {getStatusBadge(fileStatus)}
                            {fileStatus === 'Clean' && (
                              <>
                                <button className="btn btn-secondary btn-small" onClick={() => inviteDownloader(req.rowKey, blobName)}>
                                  {t('share', lang)}
                                </button>
                                <button className="btn btn-info btn-small" onClick={() => shareToSharePoint(req.rowKey, blobName)}>
                                  {t('share_to_sharepoint', lang)}
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span>---</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: '3em' }}>{t('shared_files', lang)}</h2>
      <button className="btn btn-default" onClick={fetchShares}>
        <RefreshCw size={14} aria-hidden="true" style={{verticalAlign: '-2px', marginRight: '5px'}}/> {t('refresh', lang)}
      </button>

      {shares.length === 0 ? (
        <div className="alert alert-info" style={{ marginTop: '1em' }}>
          {t('no_shares', lang)}
        </div>
      ) : (
        <table className="table" style={{ marginTop: '1em' }}>
          <thead>
            <tr>
              <th scope="col">{t('table_request_number', lang)}</th>
              <th scope="col">{t('table_case_number', lang)}</th>
              <th scope="col">{t('table_filename', lang)}</th>
              <th scope="col">{t('table_status', lang)}</th>
              <th scope="col">{t('table_downloader', lang)}</th>
              <th scope="col">{t('table_expires', lang)}</th>
              <th scope="col">{t('table_action', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {shares.map(share => (
              <tr key={share.rowKey}>
                <td><strong>{share.requestNumber}</strong></td>
                <td><strong>{share.caseNumber || '--'}</strong></td>
                <td>{share.originalFilename}</td>
                <td>{getStatusBadge(share.status)}</td>
                <td>{share.downloaderEmail || '--'}</td>
                <td>{new Date(share.expiresAt).toLocaleDateString()}</td>
                <td>
                  {!share.downloaderEmail && share.blobUri ? (
                    <button className="btn btn-small btn-info" onClick={() => {
                      const email = window.prompt(t('downloader_email_prompt_short', lang));
                      if (email) {
                        axios.post(`${API_BASE}/shares/${share.rowKey}/invite`, { downloaderEmail: email }, { headers: { Authorization: `Bearer token` } })
                          .then(() => { alert(t('invitation_sent_short', lang)); fetchShares(); })
                          .catch(() => alert(t('failed_send_invite', lang)));
                      }
                    }}>
                      {t('invite_downloader', lang)}
                    </button>
                  ) : share.downloaderEmail ? (
                    <span style={{ color: '#666' }}>{t('invited', lang)}</span>
                  ) : (
                    <span style={{ color: '#999' }}>{t('pending_upload', lang)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
