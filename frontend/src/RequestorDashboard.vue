<template>
  <div>
    <h1 id="main-content">{{ t('dashboard_title') }}</h1>
    
    <p>{{ t('dashboard_desc') }} {{ t('logged_in_as') }} <strong>{{ activeAccount?.username || 'admin@example.com' }}</strong>.</p>
      
    <button class="btn btn-primary" @click="showConfig = !showConfig" :aria-expanded="showConfig">
      <Plus :size="16" aria-hidden="true" style="vertical-align: -3px; margin-right: 5px;" />
      {{ t('create_request') }}
    </button>

    <fieldset v-if="showConfig">
      <legend>{{ t('req_details') }}</legend>
      <form @submit.prevent="handleCreate">
        <!-- omitted some fields for brevity, they should mirror React version -->
        <div class="form-group">
          <label for="uploaderEmail">{{ t('uploader_email') }} <span class="required">{{ t('required') }}</span></label>
          <span class="hint-text">{{ t('hint_email') }}</span>
          <input type="email" class="form-control" id="uploaderEmail" required v-model="newRequest.uploaderEmail" />
        </div>
        <div class="form-group">
           <label for="allowedTypes">{{ t('allowed_types') }} <span class="required">{{ t('required') }}</span></label>
           <span class="hint-text">{{ t('hint_types') }}</span>
           <input type="text" class="form-control" id="allowedTypes" required v-model="newRequest.requestedFileTypes" />
        </div>
        <div class="form-group">
          <label for="caseNumber">{{ t('case_number') }}</label>
          <span class="hint-text">{{ t('case_number_hint') }}</span>
          <input type="text" class="form-control" id="caseNumber" v-model="newRequest.caseNumber" :placeholder="t('case_number_placeholder')" />
        </div>
        <div class="form-group" style="display: flex; gap: 15px;">
          <div style="flex: 1;">
            <label for="identifierName">{{ t('identifier_name') || 'Identifier Name' }}</label>
            <input type="text" class="form-control" id="identifierName" v-model="newRequest.identifierName" />
          </div>
          <div style="flex: 1;">
            <label for="identifierValue">{{ t('identifier_value') || 'Identifier Value' }}</label>
            <input type="text" class="form-control" id="identifierValue" v-model="newRequest.identifierValue" />
          </div>
        </div>
        <div class="form-group">
          <label for="jsonMetadata">{{ t('json_metadata') || 'JSON Metadata' }}</label>
          <textarea class="form-control" id="jsonMetadata" v-model="newRequest.jsonMetadata" rows="3" placeholder='{"key": "value"}'></textarea>
        </div>
        <div class="form-group" style="margin-bottom: 15px;">
          <label for="allowMultiple" style="font-weight: normal;">
            <input type="checkbox" id="allowMultiple" v-model="newRequest.allowMultiple" style="margin-right: 8px;" />
            {{ t('allow_multiple') }}
          </label>
        </div>
        <div class="form-group">
           <label for="expirationDays">{{ t('link_exp') }} <span class="required">{{ t('required') }}</span></label>
           <select class="form-control" id="expirationDays" v-model="newRequest.expirationDays">
             <option value="1">1 {{ t('day') }}</option>
             <option value="7">7 {{ t('days') }}</option>
             <option value="14">14 {{ t('days') }}</option>
             <option value="30">30 {{ t('days') }}</option>
           </select>
        </div>
        <div style="margin-top: 1.5em;">
          <button class="btn btn-primary" type="submit" :disabled="loading">
            {{ loading ? '...' : t('submit') }}
          </button>
          <button type="button" class="btn btn-default" style="margin-left: 10px;" @click="showConfig = false">
            {{ t('cancel') }}
          </button>
        </div>
      </form>
    </fieldset>

    <h2>{{ t('active_requests') }}</h2>
    <button class="btn btn-default" @click="fetchRequests">
      <RefreshCw :size="14" aria-hidden="true" style="vertical-align: -2px; margin-right: 5px;" /> {{ t('refresh') }}
    </button>

    <div v-if="requests.length === 0" class="alert alert-info" style="margin-top: 1em;">
      {{ t('no_requests') }}
    </div>
    <table v-else class="table">
      <thead>
        <tr>
          <!-- basic rendering -->
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleRequestSort('requestNumber')">{{ t('table_request_number') }}{{ getSortIndicator(requestSort, 'requestNumber') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleRequestSort('caseNumber')">{{ t('table_case_number') }}{{ getSortIndicator(requestSort, 'caseNumber') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleRequestSort('identifierName')">{{ t('identifier_name') || 'Identifier Name' }}{{ getSortIndicator(requestSort, 'identifierName') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleRequestSort('identifierValue')">{{ t('identifier_value') || 'Identifier Value' }}{{ getSortIndicator(requestSort, 'identifierValue') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleRequestSort('uploaderEmail')">{{ t('table_uploader') }}{{ getSortIndicator(requestSort, 'uploaderEmail') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleRequestSort('requestedFileTypes')">{{ t('table_type') }}{{ getSortIndicator(requestSort, 'requestedFileTypes') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleRequestSort('status')">{{ t('table_status') }}{{ getSortIndicator(requestSort, 'status') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleRequestSort('expiresAt')">{{ t('table_expires') }}{{ getSortIndicator(requestSort, 'expiresAt') }}</th>
          <th scope="col">{{ t('table_action') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="req in sortedRequests" :key="req.rowKey">
          <td><strong>{{ req.requestNumber }}</strong></td>
          <td><strong>{{ req.caseNumber || '--' }}</strong></td>
          <td>{{ req.identifierName || '--' }}</td>
          <td>{{ req.identifierValue || '--' }}</td>
          <td>{{ req.uploaderEmail }}</td>
          <td>{{ req.requestedFileTypes.toUpperCase() }}</td>
          <td>
             <span class="badge" :class="getBadgeClass(req.status)">{{ req.status === 'Downloaded' ? '✓ ' : '' }}{{ translateStatus(req.status) }}</span>
          </td>
          <td>{{ new Date(req.expiresAt).toLocaleDateString() }}</td>
          <td>
             <div v-if="req.blobUri">
               <div v-for="(blobName, idx) in req.blobUri.split(',')" :key="idx" style="margin-bottom: 5px; display: flex; align-items: center; gap: 8px;">
                 <button v-if="getFileStatus(req, blobName) === 'Malicious'" class="btn btn-danger" disabled>
                   <Download :size="14" aria-hidden="true" style="vertical-align: -2px;" /> {{ t('download') }} {{ blobName }}
                 </button>
                 <button v-else-if="getFileStatus(req, blobName) !== 'Clean'" class="btn btn-secondary" disabled>
                   <Download :size="14" aria-hidden="true" style="vertical-align: -2px;" /> {{ t('download') }} {{ blobName }}
                 </button>
                 <button v-else class="btn btn-success" @click="handleDownload(req.rowKey, blobName)">
                   <Download :size="14" aria-hidden="true" style="vertical-align: -2px;" /> {{ t('download') }} {{ blobName }}
                 </button>
                 
                 <span class="badge" :class="getBadgeClass(getFileStatus(req, blobName))">
                   {{ getFileStatus(req, blobName) === 'Downloaded' ? '✓ ' : '' }}{{ translateStatus(getFileStatus(req, blobName)) }}
                 </span>

                 <template v-if="getFileStatus(req, blobName) === 'Clean'">
                   <button class="btn btn-secondary btn-small" @click="inviteDownloader(req.rowKey, blobName)">
                     {{ t('share') }}
                   </button>
                   <button class="btn btn-info btn-small" @click="shareToSharePoint(req.rowKey, blobName)">
                     {{ t('share_to_sharepoint') }}
                   </button>
                 </template>
               </div>
             </div>
             <span v-else>---</span>
          </td>
        </tr>
      </tbody>
    </table>
    <!-- Share File Section -->
    <button class="btn btn-primary" @click="showShareForm = !showShareForm" :aria-expanded="showShareForm" style="margin-left: 10px;">
      <Upload :size="16" aria-hidden="true" style="vertical-align: -3px; margin-right: 5px;"/>
      {{ t('share_a_file') }}
    </button>

    <fieldset v-if="showShareForm" style="margin-top: 1em;">
      <legend>{{ t('share_file_with_downloader') }}</legend>
      <form @submit.prevent="uploadAndShareFile">
        <div class="form-group">
          <label for="shareFile">{{ t('select_file_to_share') }} <span class="required">*</span></label>
          <input type="file" class="form-control" id="shareFile" @change="handleShareFile" required />
          <p v-if="shareFile" style="margin-top: 0.5em; font-size: 0.9em; color: #666;">{{ t('selected') }}: {{ shareFile.name }}</p>
        </div>
        <div class="form-group">
          <label for="downloaderEmail">{{ t('downloader_email') }} <span class="required">*</span></label>
          <span class="hint-text">{{ t('downloader_email_hint') }}</span>
          <input type="email" class="form-control" id="downloaderEmail" required v-model="newShare.downloaderEmail" />
        </div>
        <div class="form-group">
          <label for="shareExpirationDays">{{ t('link_expiration') }} <span class="required">*</span></label>
          <select class="form-control" id="shareExpirationDays" v-model="newShare.expirationDays">
            <option value="1">{{ t('one_day') }}</option>
            <option value="7">{{ t('seven_days') }}</option>
            <option value="14">{{ t('fourteen_days') }}</option>
            <option value="30">{{ t('thirty_days') }}</option>
          </select>
        </div>
        <div style="margin-top: 1.5em;">
          <button class="btn btn-primary" type="submit" :disabled="!shareFile || !newShare.downloaderEmail || uploadingShare">
            {{ uploadingShare ? t('uploading_and_sending') : t('upload_and_send_invitation') }}
          </button>
          <button type="button" class="btn btn-default" style="margin-left: 10px;" @click="showShareForm = false; shareFile = null">
            {{ t('cancel') }}
          </button>
        </div>
      </form>
    </fieldset>

    <h2 style="margin-top: 3em;">{{ t('shared_files') }}</h2>
    <button class="btn btn-default" @click="fetchShares">
      <RefreshCw :size="14" aria-hidden="true" style="vertical-align: -2px; margin-right: 5px;" /> {{ t('refresh') }}
    </button>

    <div v-if="shares.length === 0" class="alert alert-info" style="margin-top: 1em;">
      {{ t('no_shares') }}
    </div>
    <table v-else class="table" style="margin-top: 1em;">
      <thead>
        <tr>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleShareSort('requestNumber')">{{ t('table_request_number') }}{{ getSortIndicator(shareSort, 'requestNumber') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleShareSort('caseNumber')">{{ t('table_case_number') }}{{ getSortIndicator(shareSort, 'caseNumber') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleShareSort('identifierName')">{{ t('identifier_name') || 'Identifier Name' }}{{ getSortIndicator(shareSort, 'identifierName') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleShareSort('identifierValue')">{{ t('identifier_value') || 'Identifier Value' }}{{ getSortIndicator(shareSort, 'identifierValue') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleShareSort('originalFilename')">{{ t('table_filename') }}{{ getSortIndicator(shareSort, 'originalFilename') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleShareSort('status')">{{ t('table_status') }}{{ getSortIndicator(shareSort, 'status') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleShareSort('downloaderEmail')">{{ t('table_downloader') }}{{ getSortIndicator(shareSort, 'downloaderEmail') }}</th>
          <th scope="col" style="cursor: pointer; user-select: none;" @click="handleShareSort('expiresAt')">{{ t('table_expires') }}{{ getSortIndicator(shareSort, 'expiresAt') }}</th>
          <th scope="col">{{ t('table_action') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="share in sortedShares" :key="share.rowKey">
          <td><strong>{{ share.requestNumber }}</strong></td>
          <td><strong>{{ share.caseNumber || '--' }}</strong></td>
          <td>{{ share.identifierName || '--' }}</td>
          <td>{{ share.identifierValue || '--' }}</td>
          <td>{{ share.originalFilename }}</td>
          <td><span class="badge" :class="getBadgeClass(share.status)">{{ share.status === 'Downloaded' ? '✓ ' : '' }}{{ translateStatus(share.status) }}</span></td>
          <td>{{ share.downloaderEmail || '--' }}</td>
          <td>{{ new Date(share.expiresAt).toLocaleDateString() }}</td>
          <td>
            <button v-if="!share.downloaderEmail && share.blobUri" class="btn btn-small btn-info" @click="inviteDownloader(share.rowKey)">
              {{ t('invite_downloader') }}
            </button>
            <span v-else-if="share.downloaderEmail" style="color: #666;">{{ t('invited') }}</span>
            <span v-else style="color: #999;">{{ t('pending_upload') }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, computed } from 'vue';
import axios from 'axios';
import { Plus, Download, RefreshCw, Upload } from 'lucide-vue-next';
import { useLanguage, t as tRoot } from './i18n';
import { PublicClientApplication } from '@azure/msal-browser';

const API_BASE = 'http://localhost:3001/api';
const msal = inject<PublicClientApplication>('msal')!;
const { lang } = useLanguage();

const t = (key: string) => tRoot(key);
const activeAccount = ref(msal.getAllAccounts()[0] || null);

const requests = ref<any[]>([]);
const shares = ref<any[]>([]);
const showConfig = ref(false);
const showShareForm = ref(false);
const newRequest = ref({ 
  uploaderEmail: '', 
  requestedFileTypes: 'pdf,xlsx',
  expirationDays: '7',
  allowMultiple: false,
  caseNumber: '',
  identifierName: '',
  identifierValue: '',
  jsonMetadata: ''
});
const loading = ref(false);

type SortDirection = 'asc' | 'desc';
interface SortConfig<T> { key: keyof T | ''; direction: SortDirection }

const requestSort = ref<SortConfig<any>>({ key: '', direction: 'asc' });
const shareSort = ref<SortConfig<any>>({ key: '', direction: 'asc' });

const handleRequestSort = (key: string) => {
  if (requestSort.value.key === key) requestSort.value.direction = requestSort.value.direction === 'asc' ? 'desc' : 'asc';
  else requestSort.value = { key, direction: 'asc' };
};

const handleShareSort = (key: string) => {
  if (shareSort.value.key === key) shareSort.value.direction = shareSort.value.direction === 'asc' ? 'desc' : 'asc';
  else shareSort.value = { key, direction: 'asc' };
};

const getSortIndicator = (config: SortConfig<any>, key: string) => {
  if (config.key === key) return config.direction === 'asc' ? ' ↑' : ' ↓';
  return '';
};

const sortedRequests = computed(() => {
  let sortableItems = [...requests.value];
  if (requestSort.value.key !== '') {
    sortableItems.sort((a, b) => {
      const aVal = a[requestSort.value.key as string] || '';
      const bVal = b[requestSort.value.key as string] || '';
      if (aVal < bVal) return requestSort.value.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return requestSort.value.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return sortableItems;
});

const sortedShares = computed(() => {
  let sortableItems = [...shares.value];
  if (shareSort.value.key !== '') {
    sortableItems.sort((a, b) => {
      const aVal = a[shareSort.value.key as string] || '';
      const bVal = b[shareSort.value.key as string] || '';
      if (aVal < bVal) return shareSort.value.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return shareSort.value.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return sortableItems;
});

const getAxiosConfig = async () => {
  if (activeAccount.value) {
    try {
      const response = await msal.acquireTokenSilent({
        scopes: ["User.Read"],
        account: activeAccount.value
      });
      return { headers: { Authorization: `Bearer ${response.accessToken}` } };
    } catch (e) {
      return { headers: { 'x-user-email': activeAccount.value.username } };
    }
  }
  return {};
};

const fetchRequests = async () => {
  try {
    const config = await getAxiosConfig();
    const { data } = await axios.get(`${API_BASE}/requests`, config);
    requests.value = data;
  } catch (error) {
    console.error('Failed to fetch requests', error);
  }
};

const shareFile = ref<File | null>(null);
const uploadingShare = ref(false);
const newShare = ref({ 
  downloaderEmail: '', 
  expirationDays: '7',
  caseNumber: '',
  identifierName: '',
  identifierValue: '',
  jsonMetadata: ''
});

const translateStatus = (status: string) => {
  switch(status) {
    case 'Pending': return t('status_pending');
    case 'Uploaded': return t('status_uploaded');
    case 'Scanning': return t('status_scanning');
    case 'Clean': return t('status_clean');
    case 'Malicious': return t('status_malicious');
    case 'Awaiting Download': return t('status_awaiting_download');
    case 'Downloaded': return t('status_downloaded');
    case 'Ready': return t('status_ready');
    default: return status;
  }
};

const getBadgeClass = (status: string) => {
  switch(status) {
    case 'Pending': return 'badge-warning';
    case 'Uploaded': return 'badge-info';
    case 'Scanning': return 'badge-primary';
    case 'Clean': return 'badge-success';
    case 'Ready': return 'badge-success';
    case 'Malicious': return 'badge-danger';
    case 'Awaiting Download': return 'badge-secondary';
    case 'Downloaded': return 'badge-success';
    default: return 'badge-info';
  }
};

const getFileStatus = (req: any, blobName: string) => {
  if (!req.fileStatuses) return req.status;
  try { return JSON.parse(req.fileStatuses)[blobName] || req.status; } catch { return req.status; }
};

const fetchShares = async () => {
  try {
    const config = await getAxiosConfig();
    const { data } = await axios.get(`${API_BASE}/shares`, config);
    shares.value = data;
  } catch (error) {
    console.error('Failed to fetch shares', error);
  }
};

const inviteDownloader = async (token: string, blobName?: string) => {
  const downloaderEmail = window.prompt(t('downloader_email_prompt'));
  if (!downloaderEmail) return;

  const expirationInput = window.prompt(t('share_expiration_days_prompt'), '7');
  if (!expirationInput) return;

  const expirationDays = parseInt(expirationInput, 10);
  if (isNaN(expirationDays) || expirationDays < 1) {
    alert(t('invalid_expiration_days'));
    return;
  }

  try {
    const config = await getAxiosConfig();
    await axios.post(`${API_BASE}/requests/${token}/invite-downloader`, { 
      downloaderEmail,
      blobName,
      expirationDays
    }, config);
    alert(t('invitation_sent'));
    fetchShares();
  } catch (error) {
    console.error('Failed to send downloader invite', error);
    alert(t('failed_send_invite'));
  }
};

const shareToSharePoint = async (token: string, blobName?: string) => {
  try {
    const config = await getAxiosConfig();
    const { data } = await axios.get(`${API_BASE}/requests/${token}/download${blobName ? `?filename=${encodeURIComponent(blobName)}` : ''}`, config);
    const fileResponse = await axios.get(data.url, { responseType: 'blob' });
    const fileBlob = fileResponse.data;
    
    const tokenResponse = await msal.acquireTokenSilent({
      scopes: ["https://graph.microsoft.com/Files.ReadWrite.All", "https://graph.microsoft.com/Sites.ReadWrite.All"],
      account: activeAccount.value!
    });
    
    const sharePointUrl = `https://graph.microsoft.com/v1.0/sites/root/drive/root:/${encodeURIComponent(blobName || 'uploaded-file')}`;
    
    await axios.put(sharePointUrl, fileBlob, {
      headers: {
        'Authorization': `Bearer ${tokenResponse.accessToken}`,
        'Content-Type': fileBlob.type || 'application/octet-stream'
      }
    });
    
    alert(t('file_uploaded_sharepoint'));
  } catch (error) {
    console.error('Failed to share to SharePoint', error);
    alert(t('failed_upload_sharepoint'));
  }
};

const handleShareFile = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    shareFile.value = target.files[0];
  }
};

const uploadAndShareFile = async () => {
  if (!shareFile.value || !newShare.value.downloaderEmail) return;
  uploadingShare.value = true;
  try {
    const config = await getAxiosConfig();
    const sasRes = await axios.post(
      `${API_BASE}/shares/upload`,
      { 
        filename: shareFile.value.name,
        expirationDays: parseInt(newShare.value.expirationDays),
        caseNumber: newShare.value.caseNumber,
        identifierName: newShare.value.identifierName,
        identifierValue: newShare.value.identifierValue,
        jsonMetadata: newShare.value.jsonMetadata
      },
      config
    );
    const { url, blobName, token } = sasRes.data;

    await axios.put(url, shareFile.value, {
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': shareFile.value.type || 'application/octet-stream'
      }
    });

    await axios.post(`${API_BASE}/shares/confirm`, { token, blobName, filename: shareFile.value.name }, config);
    await axios.post(`${API_BASE}/shares/${token}/invite`, { downloaderEmail: newShare.value.downloaderEmail }, config);

    alert(t('file_uploaded_invitation_sent'));
    shareFile.value = null;
    newShare.value = { downloaderEmail: '', expirationDays: '7', caseNumber: '', identifierName: '', identifierValue: '', jsonMetadata: '' };
    showShareForm.value = false;
    fetchShares();
  } catch (error) {
    console.error('Upload error', error);
    alert(t('failed_upload_invitation'));
  } finally {
    uploadingShare.value = false;
  }
};

const handleCreate = async () => {
  loading.value = true;
  try {
    const config = await getAxiosConfig();
    await axios.post(`${API_BASE}/requests`, newRequest.value, config);
    showConfig.value = false;
    fetchRequests();
  } catch (error) {
    console.error('Failed to create request', error);
    alert(t('error_creating_request'));
  } finally {
    loading.value = false;
  }
};

const handleDownload = async (token: string, blobName?: string) => {
  try {
    const config = await getAxiosConfig();
    const { data } = await axios.get(`${API_BASE}/requests/${token}/download${blobName ? `?filename=${encodeURIComponent(blobName)}` : ''}`, config);
    window.open(data.url, '_blank');
  } catch (error: any) {
    alert('Failed to get download link.');
  }
};

onMounted(() => {
  fetchRequests();
  fetchShares();
});
</script>
