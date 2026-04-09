import { createApp } from 'vue'
import './index.css'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router'
import { PublicClientApplication, Configuration } from "@azure/msal-browser"
import { msalConfig } from "./authConfig"

import RequestorDashboard from './RequestorDashboard.vue'
import UploaderView from './UploaderView.vue'
import DownloaderView from './DownloaderView.vue'
import ShareDownloadView from './ShareDownloadView.vue'

const msalInstance = new PublicClientApplication(msalConfig as Configuration)

msalInstance.initialize().then(() => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: RequestorDashboard },
      { path: '/upload/:token', component: UploaderView },
      { path: '/download/:token', component: DownloaderView },
      { path: '/download-share/:token', component: ShareDownloadView },
      { path: '/:pathMatch(.*)*', redirect: '/' }
    ]
  })

  const app = createApp(App)
  app.use(router)
  app.provide('msal', msalInstance)
  app.mount('#app')
}).catch(e => {
  console.error("Failed to initialize MSAL:", e);
})
