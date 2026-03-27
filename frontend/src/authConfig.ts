import { Configuration, PopupRequest } from "@azure/msal-browser";

export const msalConfig: Configuration = {
    auth: {
        // Defaults fall back to placeholders if environment variables aren't injected at runtime
        clientId: (import.meta as any).env.VITE_MSAL_CLIENT_ID || 'enter-your-entra-id-client-id-here',
        authority: `https://login.microsoftonline.com/${(import.meta as any).env.VITE_MSAL_TENANT_ID || 'common'}`,
        redirectUri: (import.meta as any).env.VITE_MSAL_REDIRECT_URI || 'http://localhost:5173/'
    },
    cache: {
        cacheLocation: "sessionStorage",
    }
};

export const loginRequest: PopupRequest = {
    scopes: ["User.Read"]
};
