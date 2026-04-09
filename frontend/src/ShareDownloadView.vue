<template>
  <div>
    <div v-if="status === 'loading'">{{ t('loading') }}</div>
    <div v-else>
      <h1>{{ t('download_portal_title') }}</h1>
      
      <div v-if="status === 'error'" class="alert alert-danger">
        <h2>{{ t('invalid_link') }}</h2>
        <p>{{ error }}</p>
      </div>

      <fieldset v-if="status === 'auth'">
        <legend>{{ t('verify_access') }}</legend>
        <p>{{ t('shared_file_auth_desc') }}</p>
        <form @submit.prevent="validateSecret">
          <div class="form-group">
            <label for="downloadSecret">{{ t('passcode_label') }}</label>
            <input 
              id="downloadSecret" 
              class="form-control" 
              type="password" 
              required 
              v-model="secret" 
              :placeholder="t('passcode_placeholder')"
            />
          </div>
          <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
          <div style="display: flex; gap: 10px;">
            <button type="submit" class="btn btn-primary">{{ t('verify') }}</button>
            <button type="button" class="btn btn-default" @click="handleSend2fa" :disabled="cooldown > 0">
              {{ cooldown > 0 ? `Wait ${cooldown}s` : 'Send Passcode' }}
            </button>
          </div>
        </form>
      </fieldset>

      <fieldset v-if="status === 'ready' && shareInfo">
        <legend>{{ t('download_file') }}</legend>
        <div v-if="shareInfo?.caseNumber" style="margin-bottom: 1em; padding: 1em; background-color: #f0f0f0; border-left: 4px solid #0066cc;">
          <strong>{{ t('case_number_label') }}</strong> {{ shareInfo.caseNumber }}
        </div>
        <p><strong>{{ t('file_label') }}</strong> {{ shareInfo.originalFilename }}</p>
        <button v-if="shareInfo.blobUri" class="btn btn-success" @click="handleDownload">
          {{ t('download') }} {{ shareInfo.originalFilename }}
        </button>
        <div v-else class="alert alert-warning">{{ t('file_not_ready') }}</div>
      </fieldset>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { useLanguage, t as tRoot } from './i18n';

const API_BASE = 'http://localhost:3001/api/public';
const route = useRoute();
const { lang } = useLanguage();

const t = (key: string) => tRoot(key);
const token = route.params.token as string;

const shareInfo = ref<any>(null);
const status = ref('loading');
const secret = ref('');
const error = ref('');
const cooldown = ref(0);

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
  if (!token) return;
  axios.get(`${API_BASE}/shares/${token}`)
    .then((res) => {
      shareInfo.value = res.data;
      if (res.data.hasDownloadSecret) {
        status.value = 'auth';
      } else {
        status.value = 'ready';
      }
    })
    .catch(() => {
      status.value = 'error';
      error.value = t('share_access_error');
    });
});

const validateSecret = async () => {
  if (!token) return;

  try {
    await axios.post(`${API_BASE}/shares/${token}/validate-download`, { secret: secret.value });
    status.value = 'ready';
    error.value = '';
  } catch (err: any) {
    status.value = 'auth';
    error.value = t('invalid_passcode');
  }
};

const handleSend2fa = async () => {
  try {
    await axios.post(`${API_BASE}/shares/${token}/send-download-2fa`);
    cooldown.value = 60;
    error.value = '';
    alert('2FA Passcode sent to your email.');
  } catch (err: any) {
    if (err.response?.status === 429) {
      error.value = 'Please wait 1 minute before requesting another code.';
    } else {
      error.value = 'Failed to send 2FA code.';
    }
  }
};

const handleDownload = async () => {
  if (!token) return;
  try {
    const q = status.value === 'auth' ? '' : `?secret=${encodeURIComponent(secret.value)}`;
    const { data } = await axios.get<{ url: string }>(`${API_BASE}/shares/${token}/download${q}`);
    window.open(data.url, '_blank');
    
    setTimeout(async () => {
      try {
        await axios.post(`${API_BASE}/shares/${token}/mark-download-complete`, { secret: secret.value });
      } catch (err) {
        console.error('Error marking download complete', err);
      }
    }, 1000);
  } catch (err) {
    error.value = 'Failed to generate download link.';
  }
};
</script>
