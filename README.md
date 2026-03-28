# Secure File Portal Assistant

The Secure File Portal Assistant is a full-stack Node.js application that enables internal users to request sensitive documents from external users via a secure, masked, and trackable direct-to-cloud upload portal.

## Architecture

The system utilizes an Express backend serving a React SPA frontend. Cloud infrastructure leverages Azure Storage services for blob uploads and NoSQL tracking, with GCNotify for secure email delivery and Assemblyline for malware scanning.

```mermaid
graph TD
    %% Entities
    Req[Internal Requestor]
    Uploader[External Uploader]
    
    %% Frontend
    subgraph Frontend [React SPA Vite]
        ReqUI[Requestor Dashboard]
        UpUI[Secure Upload Portal]
    end
    
    %% Backend
    subgraph Backend [Node.js Express API]
        Controller[Upload Controller]
        BlobSvc[Azure Blob Service]
        TableSvc[Azure Table Service]
    end
    
    %% External Services
    AzureAD[Azure AD / Entra ID]
    Blob[Azure Blob Storage]
    TableDB[Azure Table Storage]
    GCNotify[GCNotify API]
    Assemblyline[Assemblyline Scanner]

    %% Connections
    Req -->|Logs in| AzureAD
    AzureAD -->|Provides Token| ReqUI
    ReqUI -->|Creates Request| Controller
     Controller -->|Persists Data| TableDB
    Controller -->|Triggers Email| GCNotify
    GCNotify -->|Sends Upload Link| Uploader
    
    Uploader -->|Opens Link| UpUI
    UpUI -->|Requests SAS Token| Controller
    Controller -->|Generates SAS| BlobSvc
    BlobSvc -->|Returns scoped SAS| UpUI
    UpUI -->|Direct PUT Upload| Blob
    UpUI -->|Confirms Upload| Controller
    Controller -->|Updates Status| TableDB
    
    Controller -->|Submits to Quarantine| Assemblyline
    Assemblyline -->|Returns Scan Result| Controller
    Controller -->|Marks Clean/Malicious| TableDB
    
    ReqUI -->|Downloads Clean Files| Blob
```

## Security Posture
- **Masked Storage**: Uploaders never see the actual destination container. They are provided a short-lived (1-hour) Shared Access Signature (SAS) token permitting write-only execution to a specific generated blob name.
- **Quarantine Pipeline**: All files are placed in an isolated blob path until scanned and explicitly marked as `Clean` by Assemblyline.

## Environment Variables Configuration

The application requires environment variables for both the backend and frontend to configure integrations with Azure, Entra ID (MSAL), GCNotify, and SMTP. Create a `.env` file in both the `backend/` and `frontend/` directories (you can use the `.env.dev` and `.env.example` files as templates).

### Backend (`backend/.env`)

| Key | Description | Expected Value |
| --- | --- | --- |
| `PORT` | The port the Express API runs on. | `3001` (default) |
| `FRONTEND_URL` | Used for CORS and generating links back to the UI. | `http://localhost:5173` |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string for Azure Storage. | `UseDevelopmentStorage=true` for local Azurite emulator. |
| `AZURE_STORAGE_ACCOUNT_NAME` | The Azure storage account name. | Default is `devstoreaccount1` for Azurite. |
| `AZURE_STORAGE_ACCOUNT_KEY` | The Azure storage account key. | Emulator key for Azurite, or production key. |
| `AZURE_TABLE_NAME` | The Azure Table where requests are stored. | e.g., `UploadRequestsV2` |
| `AZURE_BLOB_CONTAINER_NAME` | The blob container for uploaded files. | e.g., `uploads` |
| `AZURE_TABLE_URL` | Direct URL to Table Storage service. | Emulator URL (local) or cloud URL (prod). |
| `AZURE_BLOB_URL` | Direct URL to Blob Storage service. | Emulator URL (local) or cloud URL (prod). |
| `GCNOTIFY_API_KEY` | Your GCNotify API Key for emails. | `mock-api-key` for dev, or real key for prod. |
| `GCNOTIFY_TEMPLATE_ID` | Your GCNotify Template ID format. | `mock-template-id` for dev, or real ID. |
| `ASSEMBLYLINE_URL` | The URL for Assemblyline malware scanning service. | e.g., `mock` for local development. |
| `MSAL_CLIENT_ID` | Entra ID (Azure AD) Client ID for backend token validation. | Your Entra ID application client ID. |
| `MSAL_TENANT_ID` | Entra ID Tenant ID. | Your Entra ID tenant ID. |
| `MSAL_REDIRECT_URI` | Redirect URI matching your Entra ID app setup. | e.g., `http://localhost:3001/auth/redirect` |
| `MAILER_ENABLED` | Flag to enable SMTP email delivery. | `true` or `false` |
| `MAILER_SMTP_ADDR` | SMTP server address. | e.g., `email-smtp.ca-central-1.amazonaws.com` |
| `MAILER_SMTP_PORT` | SMTP port. | e.g., `587` |
| `MAILER_FROM` | Sender email address for the notification emails. | e.g., `noreply@your-domain.com` |
| `MAILER_USER` | SMTP authentication user username. | Your SMTP username. |
| `MAILER_PASSWD` | SMTP authentication user password. | Your SMTP password. |

### Frontend (`frontend/.env`)

| Key | Description | Expected Value |
| --- | --- | --- |
| `VITE_API_BASE_URL` | The URL where the frontend expects the backend API. | `http://localhost:3001/api` |
| `VITE_MSAL_CLIENT_ID` | Entra ID Client ID for frontend MSAL authentication. | Your Entra ID application client ID. |
| `VITE_MSAL_TENANT_ID` | Entra ID Tenant ID. | Your Entra ID tenant ID. |
| `VITE_MSAL_REDIRECT_URI` | Redirect URI after successful frontend login. | e.g., `http://localhost:5173/` |

## Setup Instructions
Please refer to the enclosed walkthrough artifacts or run locally via:

### Azurite (Local Azure Storage Emulator)
To test the file upload functionality locally, you need the Azure Storage Emulator running.
You can run a Docker container for Azurite via Ubuntu WSL:

1. Open Ubuntu WSL.
2. Install docker engine with command:
   ```bash
   sudo curl -sSL https://get.docker.com | sh
   ```
3. Run the Azurite container:
   ```bash
   sudo docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite azurite --skipApiVersionCheck --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0
   ```

### Running the Application
1. **Backend**:
   `cd backend && npm run build && npm start`
2. **Frontend**:
   `cd frontend && npm run dev`

# Secure File Portal Verification Walkthrough

The Secure File Portal Assistant application is now completely developed. It includes the React frontend, the Express backend, and mock services for Azure Storage, Azure Data Tables, GCNotify, and Assemblyline to allow for complete local verification without requiring cloud keys immediately.

## Application Components Completed

- **Frontend (`/frontend`)**: React application using Vite, stylized with modern glassmorphism Vanilla CSS.
  - `RequestorDashboard.jsx`: Displays your active requests, their statuses, and allows creating a new upload link.
  - `UploaderView.jsx`: The secure upload portal for external users. Generates short-lived Azure Blob SAS tokens in the background to handle direct and masked file uploads.
- **Backend (`/backend`)**: Express API server.
  - `server.js`: Web server and mocked authentication middleware.
  - `azureBlobService.js`: Scoped SAS token generator.
  - `azureTableService.js`: Lightweight NoSQL tracking for request stages and file lifecycle tracking.
  - `gcNotifyService.js`: Wrapper for GCNotify emails (currently mocks to console limit API usage during testing).
  - `assemblylineService.js`: Simulates a 10-second quarantine and scan, marking the file clean automatically.

## How to Test and Verify

Since Azure Table storage is configured to use the local Emulator by default, you will need the Azure Storage Emulator (Azurite) running if you don't provide actual `.env` keys.

0. Start the Azurite container (Optional see above).
```
sudo docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite azurite --skipApiVersionCheck --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0

```
1. **Start the Backend**:
```powershell
cd backend
npm install
npm run build
npm start
```

2. **Start the Frontend**:
```powershell
cd frontend
npm install
npm run dev
```

3. **Verify the Flow**:
   - Open your browser to `http://localhost:5173`.
   - You will see the Requestor Dashboard. Click **`New Request`**.
   - Input an email address and click **`Create & Send Email`**.
   - In your *Backend terminal*, you will see a mock GCNotify log with the upload link.
   - Copy that link, and open it in a new tab (this is the Uploader's view).
   - Drop a PDF or XLSX file into the zone and hit **`Submit`**.
   - The file will upload immediately to Blob Storage.
   - Go back to the Requestor Dashboard and click **`Refresh`**. You will see it listed as `Scanning`.
   - Wait 10 seconds, refresh again, and it will say `Clean` with a Download button!

> [!TIP]
> To hook up real Azure services and GCNotify, create a `.env` file in the `backend/` directory with:
> - `AZURE_STORAGE_ACCOUNT_NAME`
> - `AZURE_STORAGE_ACCOUNT_KEY`
> - `GCNOTIFY_API_KEY`

### Verification

Triggered an immediate mock upload with a sample `test.txt` via an API pipeline mimicking exactly what the React UI does, testing the full lifecycle:

1. Generated a new request via `POST /api/requests`.
2. Grabbed the upload link generated.
3. Authenticated the Uploader page with the secret `passcode`.
4. Acquired the one-time short-lived upload SAS token `(/api/public/requests/.../sas)`.
5. Transferred `test.txt` explicitly into the uploads Blob container payload.
6. Instructed the backend to trigger confirmation `(/confirm)`.
7. Refreshed the dashboard list `(GET /requests)`: Validated that the status successfully flipped to `Scanning`.
8. After 10 simulated seconds of the Assemblyline pipeline timeout, I refreshed the list again, and it successfully transitioned to Clean!

"Refresh list" button logic natively leverages this `fetchRequests` mapped call, so clicking it will completely and accurately update the screen statuses without needing to reload the entire Web UI.


## UI Demo

Bilingual Support (English/French)

### Demo

![Secure File Request Portal Login](img/image.png)

![Portail Sécurisé de Demande de Fichiers](img/image-1.png)

Federated User Login via Entra ID 
![Requestor Dashboard](img/image-2.png)

Creating new Request
![Request Details](img/image-3.png)

French Language Support
![Détails de la demande](img/image-4.png)



Test send request and view status
![alt text](img/viewstatus-en.png)
![alt text](img/viewstatus-multi-en.png)


French Language Support status
![alt text](img/viewstatus-fr.png)


Upload document
![alt text](img/documentupload-en.png)

Document has been uploaded
![alt text](img/documentuploadfulfilled-en.png)

French Language Support Document has been uploaded
![alt text](img/documentuploadfulfilled-fr.png)


Email from Requestor in bilingual
![alt text](img/requestor_email_en_fr.png)

Uploading document following the email received:
![alt text](img/uploading_passcode_en.png)

Uploading document following the email received in French:
![alt text](img/uploading_passcode_fr.png)

Uploading file in English:
![alt text](img/uploading_file_en.png)

Uploading file in French:
![alt text](img/uploading_file_fr.png)


Successfully uploaded file from uploader in English and Requestor showing clean status ready for download:
![alt text](img/successful_uploaded_en.png)

Successfully uploaded file from uploader in French and Requestor showing clean status ready for download:
![alt text](img/successful_uploaded_fr.png)



### Troubleshooting Logs

Azure Storage Emulator logs:
```
> sudo docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite azurite --skipApiVersionCheck --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0
```

Running locally in the WSL 2 with volume mount to host's C drive to persist data across restarts:
```
$ sudo docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 -v /mnt/c/Users/<yourUserNameHere>/azuritedata:/data mcr.microsoft.com/azure-storage/azurite azurite --skipApiVersionCheck --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0


Azurite Blob service is starting at http://0.0.0.0:10000
Azurite Blob service is successfully listening at http://0.0.0.0:10000
Azurite Queue service is starting at http://0.0.0.0:10001
Azurite Queue service is successfully listening at http://0.0.0.0:10001
Azurite Table service is starting at http://0.0.0.0:10002
Azurite Table service is successfully listening at http://0.0.0.0:10002
172.17.0.1 - - [28/Mar/2026:22:34:25 +0000] "POST /devstoreaccount1/Tables HTTP/1.1" 201 -
172.17.0.1 - - [28/Mar/2026:22:34:25 +0000] "PUT /devstoreaccount1/uploads?restype=container HTTP/1.1" 201 -
172.17.0.1 - - [28/Mar/2026:22:34:25 +0000] "PUT /devstoreaccount1/?restype=service&comp=properties HTTP/1.1" 202 -
172.17.0.1 - - [28/Mar/2026:22:34:49 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=PartitionKey%20eq%20%27live.com_somp%40outlook.com%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:34:51 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=PartitionKey%20eq%20%27live.com_somp%40outlook.com%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:35:04 +0000] "POST /devstoreaccount1/UploadRequestsV2 HTTP/1.1" 204 -
172.17.0.1 - - [28/Mar/2026:22:35:05 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=PartitionKey%20eq%20%27live.com_somp%40outlook.com%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:35:14 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:35:14 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:35:20 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:35:25 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:35:25 +0000] "OPTIONS /devstoreaccount1/uploads/a9813be7-7d2e-45d9-b391-32e9bb668e1c-1774737326040.pdf?sv=2026-02-06&st=2026-03-28T22%3A35%3A26Z&se=2026-03-28T23%3A35%3A26Z&sr=b&sp=cw&sig=aSW8YiznC2djk%2BbACh0YnPNIs8wirHNfUhnlYElTi%2Bo%3D HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:35:25 +0000] "PUT /devstoreaccount1/uploads/a9813be7-7d2e-45d9-b391-32e9bb668e1c-1774737326040.pdf?sv=2026-02-06&st=2026-03-28T22%3A35%3A26Z&se=2026-03-28T23%3A35%3A26Z&sr=b&sp=cw&sig=aSW8YiznC2djk%2BbACh0YnPNIs8wirHNfUhnlYElTi%2Bo%3D HTTP/1.1" 403 -
172.17.0.1 - - [28/Mar/2026:22:38:20 +0000] "POST /devstoreaccount1/Tables HTTP/1.1" 409 -
172.17.0.1 - - [28/Mar/2026:22:38:20 +0000] "PUT /devstoreaccount1/uploads?restype=container HTTP/1.1" 409 -
172.17.0.1 - - [28/Mar/2026:22:38:20 +0000] "PUT /devstoreaccount1/?restype=service&comp=properties HTTP/1.1" 202 -
172.17.0.1 - - [28/Mar/2026:22:38:27 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=PartitionKey%20eq%20%27live.com_somp%40outlook.com%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:27 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=PartitionKey%20eq%20%27live.com_somp%40outlook.com%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:36 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:36 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:42 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:47 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:47 +0000] "OPTIONS /devstoreaccount1/uploads/a9813be7-7d2e-45d9-b391-32e9bb668e1c-1774737527633.pdf?sv=2026-02-06&st=2026-03-28T22%3A23%3A47Z&se=2026-03-28T23%3A38%3A47Z&sr=b&sp=cw&sig=ZpHy6wKc41vO7m9n0QQQ4cX8EJ1%2B%2BxR46dhlCO0JikA%3D HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:47 +0000] "PUT /devstoreaccount1/uploads/a9813be7-7d2e-45d9-b391-32e9bb668e1c-1774737527633.pdf?sv=2026-02-06&st=2026-03-28T22%3A23%3A47Z&se=2026-03-28T23%3A38%3A47Z&sr=b&sp=cw&sig=ZpHy6wKc41vO7m9n0QQQ4cX8EJ1%2B%2BxR46dhlCO0JikA%3D HTTP/1.1" 201 -
172.17.0.1 - - [28/Mar/2026:22:38:47 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:47 +0000] "GET /devstoreaccount1/UploadRequestsV2(PartitionKey='live.com_somp%40outlook.com',RowKey='a9813be7-7d2e-45d9-b391-32e9bb668e1c') HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:47 +0000] "PATCH /devstoreaccount1/UploadRequestsV2(PartitionKey='live.com_somp%40outlook.com',RowKey='a9813be7-7d2e-45d9-b391-32e9bb668e1c') HTTP/1.1" 204 -
172.17.0.1 - - [28/Mar/2026:22:38:47 +0000] "GET /devstoreaccount1/UploadRequestsV2(PartitionKey='live.com_somp%40outlook.com',RowKey='a9813be7-7d2e-45d9-b391-32e9bb668e1c') HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:47 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=RowKey%20eq%20%27a9813be7-7d2e-45d9-b391-32e9bb668e1c%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:47 +0000] "PATCH /devstoreaccount1/UploadRequestsV2(PartitionKey='live.com_somp%40outlook.com',RowKey='a9813be7-7d2e-45d9-b391-32e9bb668e1c') HTTP/1.1" 204 -
172.17.0.1 - - [28/Mar/2026:22:38:57 +0000] "GET /devstoreaccount1/UploadRequestsV2(PartitionKey='live.com_somp%40outlook.com',RowKey='a9813be7-7d2e-45d9-b391-32e9bb668e1c') HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:38:57 +0000] "PATCH /devstoreaccount1/UploadRequestsV2(PartitionKey='live.com_somp%40outlook.com',RowKey='a9813be7-7d2e-45d9-b391-32e9bb668e1c') HTTP/1.1" 204 -
172.17.0.1 - - [28/Mar/2026:22:39:07 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=PartitionKey%20eq%20%27live.com_somp%40outlook.com%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:39:07 +0000] "GET /devstoreaccount1/UploadRequestsV2()?$filter=PartitionKey%20eq%20%27live.com_somp%40outlook.com%27 HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:40:27 +0000] "GET /devstoreaccount1/UploadRequestsV2(PartitionKey='live.com_somp%40outlook.com',RowKey='a9813be7-7d2e-45d9-b391-32e9bb668e1c') HTTP/1.1" 200 -
172.17.0.1 - - [28/Mar/2026:22:40:27 +0000] "GET /devstoreaccount1/uploads/a9813be7-7d2e-45d9-b391-32e9bb668e1c-1774737527633.pdf?sv=2026-02-06&st=2026-03-28T22%3A25%3A27Z&se=2026-03-28T23%3A40%3A27Z&sr=b&sp=r&sig=fntfVsOQORk63AGQP74p6E%2B3k4dli1SDRTq2jCjnBeg%3D HTTP/1.1" 200 537702
172.17.0.1 - - [28/Mar/2026:22:40:27 +0000] "GET /favicon.ico HTTP/1.1" 400 -

```

Backend logs:
```
> cd .\backend\ && npm install && npm run build && npm start

up to date, audited 482 packages in 848ms

90 packages are looking for funding
  run `npm fund` for details

2 vulnerabilities (1 moderate, 1 high)

To address all issues, run:
  npm audit fix

Run `npm audit` for details.

> backend@1.0.0 build
> tsc


> backend@1.0.0 start
> node dist/server.js

Initializing Azure services...
Table UploadRequestsV2 created or already exists.
Blob container uploads created or already exists.
CORS properties set for Blob Storage.
Backend server running on port 3001
[ASSEMBLYLINE] Mock scanning started for a9813be7-7d2e-45d9-b391-32e9bb668e1c-1774737527633.pdf (token: a9813be7-7d2e-45d9-b391-32e9bb668e1c)
[ASSEMBLYLINE] Mock scanning finished for a9813be7-7d2e-45d9-b391-32e9bb668e1c-1774737527633.pdf. Result: Clean
```

Frontend logs:
```
> cd .\frontend\ && npm install && npm run dev

up to date, audited 482 packages in 848ms

90 packages are looking for funding
  run `npm fund` for details

2 vulnerabilities (1 moderate, 1 high)

To address all issues, run:
  npm audit fix

Run `npm audit` for details.

> frontend@1.0.0 dev
> vite


  VITE v7.2.4  ready in 1578 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://[IP_ADDRESS]
  ➜  Network: http://[IP_ADDRESS]  
```

