import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";
import { LanguageProvider } from "./i18n";

const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </MsalProvider>
    </React.StrictMode>
  );
}).catch(e => {
  console.error("Failed to initialize MSAL:", e);
});
