<template>
  <div>
    <!-- GoC Header Shell -->
    <header>
      <div class="goc-header-top">
        <div class="container" style="display: flex; justify-content: flex-end; align-items: center;">
          <div style="margin-right: 15px;">
            <span v-if="activeAccount" style="font-size: 0.9em; color: #333;">
              {{ t('logged_in_as') }} <strong>{{ activeAccount.username }}</strong>
              <button 
                @click="handleLogout" 
                class="btn btn-default" 
                style="padding: 0.2em 0.8em; margin-left: 10px; font-size: 0.85em; font-weight: bold;"
              >
                {{ t('logout') }}
              </button>
            </span>
          </div>
          <a href="#" :lang="lang === 'en' ? 'fr' : 'en'" @click.prevent="toggleLang" style="color: #284162; font-size: 1em; text-decoration: underline;">
            {{ t('lang_toggle') }}
          </a>
        </div>
      </div>
      
      <div class="container goc-brand-bar">
        <a href="/" class="goc-logo" :aria-label="t('goc')">
          <img 
            :src="lang === 'fr' 
              ? 'https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/assets/sig-blk-fr.svg' 
              : 'https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/assets/sig-blk-en.svg'" 
            :alt="t('goc')"
            style="height: 32px; width: auto;"
          />
        </a>
      </div>
      
      <nav class="goc-navbar" aria-label="Site menu">
        <div class="container">
          {{ t('app_title') }}
        </div>
      </nav>
      
      <nav class="goc-breadcrumbs" aria-label="Breadcrumb">
        <div class="container">
          <a href="#">{{ t('canada_ca') }}</a> &gt; <span>{{ t('app_title') }}</span>
        </div>
      </nav>
    </header>

    <main class="container main-content">
      <router-view v-if="isAuthenticated || isPublicRoute"></router-view>
      <div v-else style="padding: 4em 0; text-align: center;">
        <h1 id="main-content" style="border: none;">{{ t('login_req') }}</h1>
        <p style="font-size: 1.2em;">{{ t('login_desc') }}</p>
        <button class="btn btn-primary" @click="handleLogin" style="margin-top: 2em; font-size: 1.2em; padding: 10px 30px;">
          {{ t('sign_in') }}
        </button>
      </div>
    </main>

    <footer style="background-color: #26374a; color: white; padding: 4em 0 2em 0; margin-top: 4em;">
      <div class="container">
        <nav aria-label="Footer menu">
          <h2 style="font-size: 1.2em; margin: 0 0 15px 0; border: none; color: white;">{{ t('about') }}</h2>
          <ul style="list-style: none; display: flex; gap: 30px; margin: 0; padding: 0; border-bottom: 1px solid #4d5d6c; padding-bottom: 2em; margin-bottom: 2em; flex-wrap: wrap;">
            <li><a href="#" style="color: white; text-decoration: none;">{{ t('contact') }}</a></li>
            <li><a href="#" style="color: white; text-decoration: none;">{{ t('departments') }}</a></li>
            <li><a href="#" style="color: white; text-decoration: none;">{{ t('public_service') }}</a></li>
          </ul>
        </nav>
        
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
          <nav aria-label="Terms menu">
            <ul style="list-style: none; display: flex; gap: 30px; margin: 0; padding: 0; flex-wrap: wrap;">
              <li><a href="#" style="color: #fff; text-decoration: none;">{{ t('social') }}</a></li>
              <li><a href="#" style="color: #fff; text-decoration: none;">{{ t('mobile') }}</a></li>
              <li><a href="#" style="color: #fff; text-decoration: none;">{{ t('about_site') }}</a></li>
              <li><a href="#" style="color: #fff; text-decoration: none;">{{ t('terms') }}</a></li>
              <li><a href="#" style="color: #fff; text-decoration: none;">{{ t('privacy') }}</a></li>
            </ul>
          </nav>
          <div style="margin-left: auto;">
            <img 
              src="https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/assets/wmms-blk.svg" 
              alt="Symbol of the Government of Canada" 
              style="height: 35px; filter: brightness(0) invert(1);" 
            />
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { inject, ref, computed, onMounted } from 'vue';
import { PublicClientApplication } from '@azure/msal-browser';
import { useLanguage, t as tRoot } from './i18n';
import { loginRequest } from './authConfig';
import { useRoute } from 'vue-router';
import './App.css';

const msal = inject<PublicClientApplication>('msal')!;
const { lang, setLang } = useLanguage();
const route = useRoute();

const activeAccount = ref(msal.getAllAccounts()[0] || null);

const t = (key: string) => tRoot(key);

const toggleLang = () => {
  setLang(lang.value === 'en' ? 'fr' : 'en');
};

const handleLogin = () => {
  msal.loginRedirect(loginRequest).catch(e => console.error(e));
};

const handleLogout = () => {
  msal.logoutRedirect({ postLogoutRedirectUri: "/" }).catch(e => console.error(e));
};

const isPublicRoute = computed(() => {
  return route.path.startsWith('/upload') || route.path.startsWith('/download');
});

const isAuthenticated = computed(() => !!activeAccount.value);

onMounted(() => {
  msal.handleRedirectPromise().then(() => {
    activeAccount.value = msal.getAllAccounts()[0] || null;
  });
});
</script>
