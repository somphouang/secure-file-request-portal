<template>
  <div>
    <h1 v-if="status === 'loading'" id="main-content">{{ t('loading') }}</h1>
    <div v-else-if="status === 'already_uploaded'" class="alert alert-success">
      <h2 style="margin-top: 0">{{ t('fulfilled') }}</h2>
      <p>{{ t('fulfilled_desc') }}</p>
    </div>
    <div v-else-if="status === 'error'" class="alert alert-danger">
      <h2 style="margin-top: 0">{{ t('invalid_link') }}</h2>
      <p>{{ t('invalid_link_desc') }}</p>
    </div>
    <div v-else-if="status === 'success'" class="alert alert-success">
      <h2 style="margin-top: 0">{{ t('success') }}</h2>
      <p>{{ t('success_desc') }}</p>
    </div>
    <div v-else>
      <h1 id="main-content">{{ t('portal_title') }}</h1>
      <p>{{ t('portal_desc') }}</p>
      
      <div v-if="requestInfo?.caseNumber" style="margin-bottom: 1em; padding: 1em; background-color: #f0f0f0; border-left: 4px solid #0066cc;">
        <strong>{{ t('case_number_label') }}</strong> {{ requestInfo.caseNumber }}
      </div>

      <fieldset v-if="status === 'ready'">
        <legend>{{ t('auth_req') }}</legend>
        <p>{{ t('auth_req_desc') }}</p>
        <div v-if="secretError" class="alert alert-danger" role="alert">{{ secretError }}</div>
        <form @submit.prevent="handleAuthenticate">
          <div class="form-group">
            <label for="secretInput">{{ t('secret') }}</label>
            <input type="password" id="secretInput" class="form-control" v-model="secret" required />
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="submit" class="btn btn-primary">{{ t('access_portal') }}</button>
            <button type="button" class="btn btn-default" @click="handleSend2fa" :disabled="cooldown > 0">
              {{ cooldown > 0 ? `Wait ${cooldown}s` : 'Send Passcode' }}
            </button>
          </div>
        </form>
      </fieldset>

      <fieldset v-if="status === 'authenticated' || status === 'uploading'">
        <legend>{{ t('upload_doc') }}</legend>

        <div v-if="requestInfo?.blobUri && !requestInfo?.allowMultiple" class="alert alert-success" style="margin-bottom: 1.5em;">
          <strong>{{ t('upload_complete_single_file') }}</strong>
        </div>
        
        <div v-if="requestInfo?.blobUri && requestInfo?.allowMultiple" class="alert alert-info" style="margin-bottom: 1.5em;">
          <strong>{{ t('files_uploaded_for_request') }}</strong>
          <ul style="margin: 0.5em 0 0; padding-left: 1.5em;">
            <li v-for="(blob, idx) in requestInfo.blobUri.split(',')" :key="idx">{{ blob }}</li>
          </ul>
          <p style="margin-top: 0.5em;">{{ t('upload_more_files_allowed') }}</p>
        </div>

        <div v-if="!requestInfo?.blobUri || requestInfo?.allowMultiple">
          <p><strong>{{ t('allowed_file_types') }}</strong> {{ requestInfo?.requestedFileTypes }}</p>
          <p><strong>Max File Size:</strong> {{ requestInfo?.maxFileSize || 50 }} MB</p>
          
          <div 
            class="dropzone"
            @click="fileInputRef?.click()"
            @dragover.prevent
            @drop.prevent="handleDrop"
            role="button"
            tabindex="0"
            :aria-label="t('click_drag')"
            @keydown.enter="fileInputRef?.click()"
            @keydown.space="fileInputRef?.click()"
          >
            <UploadCloud :size="48" class="dropzone-icon" aria-hidden="true" />
            <p v-if="file" class="dropzone-text">{{ t('selected') }} {{ file.name }} ({{ (file.size / 1024 / 1024).toFixed(2) }} MB)</p>
            <p v-else class="dropzone-text">{{ t('click_drag') }}</p>
            <input 
              type="file" 
              ref="fileInputRef" 
              style="display: none;" 
              @change="handleFileChange"
              :accept="allowedAcceptExts" 
              aria-hidden="true"
              tabindex="-1"
            />
          </div>
          
          <div v-if="fileError" class="alert alert-danger" role="alert" style="margin-top: 1em;">
            {{ fileError }}
          </div>

          <div style="margin-top: 2em; display: flex; gap: 10px;">
            <button class="btn btn-primary" :disabled="!file || status === 'uploading'" @click="handleUpload">
              {{ status === 'uploading' ? t('encrypting') : t('submit_doc') }}
            </button>
            <button v-if="requestInfo?.allowMultiple && requestInfo?.blobUri" type="button" class="btn btn-default" @click="handleDone">
              Complete Multiple Uploads
            </button>
          </div>
        </div>
      </fieldset>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { UploadCloud } from 'lucide-vue-next';
import { useLanguage, t as tRoot } from './i18n';

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/public` : 'http://localhost:3001/api/public';
const route = useRoute();
const { lang } = useLanguage();

const t = (key: string) => tRoot(key);
const token = route.params.token as string;

const allowedAcceptExts = computed(() => {
  if (!requestInfo.value?.requestedFileTypes) return '*';
  return requestInfo.value.requestedFileTypes.split(',').map((ext: string) => `.${ext.trim()}`).join(',');
});

const requestInfo = ref<any>(null);
const file = ref<File | null>(null);
const status = ref('loading');
const secret = ref('');
const secretError = ref('');
const fileError = ref('');
const cooldown = ref(0);
const fileInputRef = ref<HTMLInputElement | null>(null);

let cooldownTimer: number | undefined;

watch(cooldown, (newVal) => {
  if (cooldownTimer) clearTimeout(cooldownTimer);
  if (newVal > 0) {
    cooldownTimer = setTimeout(() => cooldown.value--, 1000) as unknown as number;
  }
});

onUnmounted(() => {
  if (cooldownTimer) clearTimeout(cooldownTimer);
});

onMounted(() => {
  axios.get(`${API_BASE}/requests/${token}`)
    .then(res => {
      requestInfo.value = res.data;
      if (res.data.isClosed || (res.data.blobUri && !res.data.allowMultiple)) {
        status.value = 'already_uploaded';
      } else {
        status.value = res.data.requiresSecret ? 'ready' : 'authenticated';
      }
    })
    .catch(() => {
      status.value = 'error';
    });
});

const handleAuthenticate = async () => {
  secretError.value = '';
  try {
    await axios.post(`${API_BASE}/requests/${token}/validate-secret`, { secret: secret.value });
    if (requestInfo.value?.isClosed || (requestInfo.value?.blobUri && !requestInfo.value?.allowMultiple)) {
      status.value = 'already_uploaded';
    } else {
      status.value = 'authenticated';
    }
  } catch (err) {
    secretError.value = t('invalid_link_desc');
  }
};

const handleSend2fa = async () => {
  try {
    await axios.post(`${API_BASE}/requests/${token}/send-uploader-2fa`);
    cooldown.value = 60;
    secretError.value = '';
    alert('2FA Passcode sent to your email.');
  } catch (err: any) {
    if (err.response?.status === 429) {
      secretError.value = 'Please wait 1 minute before requesting another code.';
    } else {
      secretError.value = 'Failed to send 2FA code.';
    }
  }
};

const handleDrop = (e: DragEvent) => {
  if (e.dataTransfer?.files[0]) {
    checkAndSetFile(e.dataTransfer.files[0]);
  }
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    checkAndSetFile(target.files[0]);
  }
};

const checkAndSetFile = (selectedFile: File) => {
  const allowedExtensions = requestInfo.value?.requestedFileTypes
    ?.split(',')
    .map((ext: string) => ext.trim().toLowerCase().replace(/^[\.]/, ''))
    .filter(Boolean) || [];
  const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';

  if (allowedExtensions.length > 0 && fileExt && !allowedExtensions.includes(fileExt)) {
    file.value = null;
    fileError.value = `Invalid file type. Allowed: ${requestInfo.value?.requestedFileTypes}`;
    return;
  }

  const maxSizeInBytes = (requestInfo.value?.maxFileSize || 50) * 1024 * 1024;
  if (selectedFile.size > maxSizeInBytes) {
    file.value = null;
    fileError.value = `File size exceeds the maximum allowed limit of ${requestInfo.value?.maxFileSize || 50} MB.`;
    return;
  }

  file.value = selectedFile;
  fileError.value = '';
};

const handleUpload = async () => {
  if (!file.value) return;
  status.value = 'uploading';

  try {
    const sasRes = await axios.post<{ url: string, blobName: string }>(`${API_BASE}/requests/${token}/sas`, { filename: file.value.name, secret: secret.value });
    const { url, blobName } = sasRes.data;

    await axios.put(url, file.value, {
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.value.type || 'application/octet-stream'
      }
    });

    await axios.post(`${API_BASE}/requests/${token}/confirm`, { blobName });

    const res = await axios.get(`${API_BASE}/requests/${token}`);
    requestInfo.value = res.data;
    file.value = null;
    
    if (!res.data.allowMultiple) {
      status.value = 'success';
    } else {
      status.value = 'authenticated';
    }
  } catch (error) {
    console.error('Upload error', error);
    status.value = 'error';
  }
};

const handleDone = async () => {
  try {
    if (!window.confirm(t('confirm_complete_upload'))) {
      return;
    }
    await axios.post(`${API_BASE}/requests/${token}/complete`);
    status.value = 'already_uploaded';
  } catch (error) {
    console.error('Complete error', error);
    status.value = 'error';
  }
};
</script>
