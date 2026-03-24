import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Download, RefreshCw } from 'lucide-react';

import { useMsal } from "@azure/msal-react";
import { useLanguage, t } from './i18n';

const API_BASE = 'http://localhost:3001/api';

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

  const [requests, setRequests] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [newRequest, setNewRequest] = useState({ 
    uploaderEmail: '', 
    requestedFileTypes: 'pdf,xlsx',
    expirationDays: '7',
    secret: ''
  });
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    fetchRequests();
  }, [accounts]); 

  const fetchRequests = async () => {
    try {
      const config = await getAxiosConfig();
      const { data } = await axios.get(`${API_BASE}/requests`, config);
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch requests', error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const config = await getAxiosConfig();
      await axios.post(`${API_BASE}/requests`, newRequest, config);
      setShowConfig(false);
      setNewRequest({ uploaderEmail: '', requestedFileTypes: 'pdf,xlsx', expirationDays: '7', secret: '' });
      fetchRequests();
    } catch (error) {
      console.error('Failed to create request', error);
      alert('Error creating request. See console.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (token) => {
    try {
      const config = await getAxiosConfig();
      const { data } = await axios.get(`${API_BASE}/requests/${token}/download`, config);
      window.open(data.url, '_blank');
    } catch (error) {
      alert('Failed to get download link or file is not clean.');
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Pending': return <span className="badge badge-warning">{status}</span>;
      case 'Uploaded': return <span className="badge badge-info">{status}</span>;
      case 'Scanning': return <span className="badge badge-primary">{status}</span>;
      case 'Clean': return <span className="badge badge-success">{status}</span>;
      case 'Malicious': return <span className="badge badge-danger">{status}</span>;
      default: return <span className="badge">{status}</span>;
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
            <div className="form-group">
              <label htmlFor="secret">{t('secret', lang)} <span className="required">{t('required', lang)}</span></label>
              <span className="hint-text">{t('hint_secret', lang)}</span>
              <input 
                type="text" 
                className="form-control"
                id="secret"
                required
                value={newRequest.secret}
                onChange={e => setNewRequest({...newRequest, secret: e.target.value})}
              />
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
                <td>{req.uploaderEmail}</td>
                <td>{req.requestedFileTypes.toUpperCase()}</td>
                <td>{getStatusBadge(req.status)}</td>
                <td>{new Date(req.expiresAt).toLocaleDateString()}</td>
                <td>
                  {req.status === 'Clean' ? (
                    <button className="btn btn-success" onClick={() => handleDownload(req.rowKey)}>
                      <Download size={14} aria-hidden="true" style={{verticalAlign: '-2px', marginRight: '5px'}}/> {t('download', lang)}
                    </button>
                  ) : (
                    <span>---</span>
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
