import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { PublicClientApplication, Configuration } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";
import { LanguageProvider } from "./i18n";

const msalInstance = new PublicClientApplication(msalConfig as Configuration);

msalInstance.initialize().then(() => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </MsalProvider>
      </React.StrictMode>
    );
  }
}).catch(e => {
  console.error("Failed to initialize MSAL:", e);
});
