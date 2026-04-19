# Secure File Portal Assistant

The Secure File Portal Assistant is a full-stack Node.js application that enables internal users to request sensitive documents from external users via a secure, masked, and trackable direct-to-cloud upload portal.

## Architecture

The system utilizes an Express backend and serving a Vue 3 SPA frontend (built with Vite and TypeScript). Cloud infrastructure leverages Azure Storage services for blob uploads and NoSQL tracking, with GCNotify for secure email delivery and Assemblyline for malware scanning.

```mermaid
graph TD
    %% Entities
    Req[Internal Requestor]
    Uploader[External Uploader]
    
    %% Frontend
    subgraph Frontend [Vue 3 SPA Vite]
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

## Key Features

### 1. **Secure Upload Request Workflow**
- Internal requestors create upload requests and send secure links to external uploaders
- Auto-generated passcodes included in email notifications
- Direct cloud upload with short-lived (1-hour) SAS tokens
- No file storage on intermediate servers
- Automated malware scanning with Assemblyline integration

### 2. **Direct File Share & Download Workflow** (New)
- Requestors can directly upload files and invite external downloaders
- Auto-generated, encrypted passcodes for download access
- Separate from traditional upload requests
- Download completion tracking with automatic status updates
- Bilingual email notifications with download links

### 3. **Request Number Tracking** (New)
- Every upload request and file share gets a unique 16-character request number
- Format: `RQ-[timestamp-base36][random-base36]` (truncated to 16 chars)
- Algorithm: Timestamp converted to base36 uppercase + 8-char random base36 uppercase, prefixed with "RQ-"
- Included in all email subjects and bodies for reference
- Central tracking for compliance and auditing
- Example: `RQ-VR3KLY8ZA0G9J2X`

### 4. **Download Completion Tracking** (New)
- Automatic status updates when downloader completes file download
- Status progression: `Pending` → `Uploaded` → `Scanning` → `Clean` → `Awaiting Download` → `Downloaded`
- Requestor can see real-time download confirmation
- Includes timestamp of when download was completed

### 5. **Conditional File Sharing** (New)
- **Share Button Visibility**: "Share" button only appears next to individual files that have been scanned and marked as "Clean"
- **Status-Based Access**: Requestors cannot share files that are still scanning, pending, or marked as malicious
- **Per-File Sharing**: When multiple files are uploaded, each clean file can be shared individually
- **Shared Files Tracking**: Shared files appear in the "Shared Files" table with proper expiration dates and status tracking

### 5. **Bilingual Support**
- Full English and French interface
- All email templates available in both languages
- Case numbers and tracking info preserved across languages

### 6. **Automated Uploader Passcodes** (New)
- **Auto-Generated Secrets**: Uploader requests now automatically generate 18-character encrypted passcodes
- **No Manual Entry**: Requestors no longer need to manually create or remember secrets
- **Secure Hashing**: Passcodes are bcrypt-hashed before storage, plaintext only in emails
- **Format**: Alphanumeric characters (similar to downloader passcodes but 18 chars vs 8 chars)

### 7. **True 2FA Security with Cooldown** (New)
- **Time-of-Use Delivery**: Passcodes are *no longer* sent alongside the initial URL link to external users. Instead, when external users access the portal link, they must actively click "Send Passcode" to receive their secure code.
- **6-Digit Secure Codes**: Uploader and Downloader 2FA codes are now short, 6-digit numeric codes generated on-the-fly to ensure faster data entry and improved user experience.
- **1-Minute Timeout Enforcement**: To prevent email spamming or API abuse, requesting a 2FA code disables the "Send Passcode" button and institutes a strict 60-second cooldown timer. The server rejects 2FA requests made within 1 minute of a previous code delivery.

### 8. **Multi-File Upload**
- Requestors can allow uploaders to submit multiple files in a single request
- Checkbox option in request creation
- Individual file scanning with aggregated status
- Uploader experience varies based on requestor's configuration

### 9. **SharePoint Integration** (New)
- **One-Click Upload**: "Share to SharePoint" button appears next to clean files only
- **Entra ID Authentication**: Uses the requestor's Microsoft 365 identity and token acquisition via MSAL
- **Microsoft Graph API**: Secure file upload to the user’s default SharePoint root drive
- **Permission Requirements**: Requires delegated Graph permissions `Files.ReadWrite.All` and `Sites.ReadWrite.All`
- **Default Location**: Uploads to the root Documents library of the user's default SharePoint site
- **Important User Requirements**:
  - The requestor must be signed in with a Microsoft 365 account that has write access to the SharePoint site and default document library
  - The AAD app registration must be granted consent for `Files.ReadWrite.All` and `Sites.ReadWrite.All`
  - If the requestor does not have SharePoint write privileges for the default site, the upload will fail
  - The feature depends on valid MSAL tokens being acquired silently; if the user has not signed in or consented, the Graph upload request will not succeed

#### SharePoint permissions and failure explanation
When the UI shows:

> Failed to upload file to SharePoint. Please check your permissions.

This generally means one of the following:
- The signed-in requestor account does not have permission to create files in the SharePoint site/document library being targeted
- The Microsoft Graph scopes required by the frontend/backend app have not been granted or consented (`Files.ReadWrite.All`, `Sites.ReadWrite.All`)
- The Entra ID login token could not be acquired or is missing the expected audience/tenant claims
- The SharePoint root document library is not accessible for this user or tenant

To be successful, the requestor should:
- Confirm they are logged in with the correct Microsoft 365 account
- Ensure the account belongs to the same tenant configured in `MSAL_TENANT_ID`
- Confirm the app registration is configured with delegated permissions for `Files.ReadWrite.All` and `Sites.ReadWrite.All`
- Ensure admin consent has been granted for those scopes if required by tenant policy
- Verify they can manually upload a file to the target SharePoint site using the same account

If this error persists, check the backend logs for a Graph API error response and verify the app registration + SharePoint access configuration.

### 9. **Role-Based Security**
- **Requestor**: Authenticated via Azure AD/Entra ID, creates requests and invites
- **Uploader**: Public access via secure token, no authentication required
- **Downloader**: Public access via secure token and passcode, no authentication required
- **Zero Trust**: All requests validated with time-limited tokens

### 10. **Audit & Compliance**
- All transactions tracked with case numbers
- Status lifecycle preserved for regulatory compliance
- Email delivery logs include recipient, timestamp, and case number
- Download completion timestamps recorded

### 11. **Requestor Groups & Access Control** (New)
- Introduced requestor groups handling to manage permissions more effectively
- Enhanced access control and improved user flows across the portal

### 12. **Enhanced Validation & Localization** (New)
- Comprehensive localization improvements for the file upload and download workflows
- Added stronger validation checks to guarantee robust secure file transfers

### 13. **Security & Offline Deployment Enhancements** (New)
- **Zero-Vulnerability Baseline**: Both frontend and backend dependencies have been migrated to the latest secured `axios` package (v1.15.1+), completely eliminating critical SSRF vulnerabilities and guaranteeing a clean `npm audit` across all layers.
- **Robust Frontend Builds**: The Vite compile process is now fully stabilized with default `.env` injections out-of-the-box, ensuring `npm run dev` and `npm run build` execute flawlessly for new developers.
- **AL4 Offline Air-Gapped Deployment**: Introducing the new `assemblyline4/` directory containing complete automation for disconnected environments. Users can now run `pack-online.sh` on an internet-connected host to bundle all CCCS AL4 containers, and seamlessly deploy them onto strict offline networks (Ubuntu/RHEL) using the automated `deploy-offline.yml` Ansible playbook or native scripts.

## Request Number Generation Algorithm

The system generates unique request numbers using the following algorithm:

1. **Timestamp Component**: `Date.now().toString(36).toUpperCase()`
   - Converts current Unix timestamp to base36 representation
   - Uses uppercase letters for consistency

2. **Random Component**: `Math.random().toString(36).substring(2, 10).toUpperCase()`
   - Generates 8-character random string in base36
   - Removes first 2 characters (`0.`) from Math.random() output
   - Uses uppercase for consistency

3. **Prefix**: `RQ-` (Request identifier)

4. **Concatenation & Truncation**: `RQ-${timestamp}${random}`.substring(0, 16)
   - Combines prefix, timestamp, and random components
   - Truncates to exactly 16 characters to ensure consistency

**Example Generation**:
- Timestamp: `Date.now()` = 1703123456789
- Base36: `VR3KLY8Z`
- Random: `A0G9J2X`
- Result: `RQ-VR3KLY8ZA0G9J2X` (truncated to 16 chars)

## Detailed Workflow

### Upload Request Flow
1. **Request Creation**: Requestor creates upload request with optional manual case number
2. **Auto-Generation**: System generates unique RQ-* request number
3. **Email Dispatch**: Bilingual email sent with request number, optional case number, and secure upload link
4. **File Upload**: Uploader receives email, enters portal, uploads file(s)
5. **SAS Token**: Backend generates time-limited write-only SAS token for secure cloud upload
6. **Malware Scanning**: Files quarantined and sent to Assemblyline for scanning
- **Status Updates**: Request status progresses: Pending → Uploaded → Scanning → Clean/Malicious
- **Security Restrictions**: Malicious files cannot be downloaded or shared; download buttons are disabled and appear red
- **Individual File Status**: Multi-file uploads track status per file, allowing clean files to be downloaded while malicious ones are blocked
8. **File Access**: Clean files become available for download or sharing

### File Share Flow
1. **File Selection**: Requestor selects clean file from completed upload request
2. **Share Creation**: System generates new RQ-* request number and optional case number
3. **Passcode Generation**: Auto-generates 8-character encrypted download passcode
4. **Email Notification**: Downloader receives secure link with passcode
5. **Download Access**: Downloader enters passcode and downloads file
6. **Completion Tracking**: System records download timestamp and updates status

### Status Lifecycle
- **Upload Requests**: `Pending` → `Uploaded` → `Scanning` → `Clean`/`Malicious` → `Awaiting Download` → `Downloaded`
- **Security Enforcement**: Files marked as `Malicious` cannot be downloaded or shared; UI shows disabled red buttons
- **File Shares**: `Ready` → `Awaiting Download` → `Downloaded` (only created from clean files)

## Security Posture
- **Masked Storage**: Uploaders never see the actual destination container. They are provided a short-lived (1-hour) Shared Access Signature (SAS) token permitting write-only execution to a specific generated blob name.
- **Quarantine Pipeline**: All files are placed in an isolated blob path until scanned and explicitly marked as `Clean` by Assemblyline.
- **Passcode Security**: Passcodes are auto-generated (8 characters), bcrypt-hashed in storage, and sent only in email plaintext

## Environment Variables Configuration

The application requires environment variables for both the backend and frontend to configure integrations with Azure, Entra ID (MSAL), GCNotify, Assemblyline, and SMTP. Create a `.env` file in both the `backend/` and `frontend/` directories by copying from the existing `.env.example` templates.

### Backend (`backend/.env`)

| Key | Description | Expected Value |
| --- | --- | --- |
| `PORT` | The port the Express API runs on. | `3001` (default) |
| `FRONTEND_URL` | Used for CORS and generating links back to the UI. | `http://localhost:5173` |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string for Azure Storage. | `UseDevelopmentStorage=true` for local Azurite emulator. |
| `AZURE_STORAGE_ACCOUNT_NAME` | The Azure storage account name. | Default is `devstoreaccount1` for Azurite. |
| `AZURE_STORAGE_ACCOUNT_KEY` | The Azure storage account key. | Emulator key for Azurite, or production key. |
| `AZURE_TABLE_NAME` | The Azure Table where upload requests are stored. | e.g., `UploadRequestsV2` |
| `AZURE_SHARE_TABLE_NAME` | The Azure Table where download share records are stored. | `DownloadShares` |
| `AZURE_BLOB_CONTAINER_NAME` | The blob container for uploaded files. | e.g., `uploads` |
| `AZURE_TABLE_URL` | Direct URL to Table Storage service. | Emulator URL (local) or cloud URL (prod). |
| `AZURE_BLOB_URL` | Direct URL to Blob Storage service. | Emulator URL (local) or cloud URL (prod). |
| `GCNOTIFY_API_KEY` | Your GCNotify API Key for emails. | `mock-api-key` for dev, or real key for prod. |
| `GCNOTIFY_TEMPLATE_ID` | Your GCNotify Template ID format. | `mock-template-id` for dev, or real ID. |
| `ASSEMBLYLINE_URL` | The URL for Assemblyline malware scanning service. | e.g., `mock` for local development. |
| `MSAL_CLIENT_ID` | Entra ID (Azure AD) Client ID for backend token validation. | Your Entra ID application client ID. |
| `MSAL_TENANT_ID` | Entra ID Tenant ID. | Your Entra ID tenant ID. |
| `MSAL_EXPECTED_AUD` | Optional expected JWT audience claim. | Defaults to `MSAL_CLIENT_ID` if unset. |
| `MSAL_REDIRECT_URI` | Redirect URI matching your Entra ID app setup. | e.g., `http://localhost:3001/auth/redirect` |
| `MAILER_ENABLED` | Flag to enable SMTP email delivery. | `true` or `false` |
| `MAILER_SMTP_ADDR` | SMTP server address. | e.g., `email-smtp.ca-central-1.amazonaws.com` |
| `MAILER_SMTP_PORT` | SMTP port. | e.g., `587` |
| `MAILER_FROM` | Sender email address for the notification emails. | e.g., `noreply@your-domain.com` |
| `MAILER_USER` | SMTP authentication user username. | Your SMTP username. |
| `MAILER_PASSWD` | SMTP authentication user password. | Your SMTP password. |
| `API_BASE_URL` | Base API URL used for e2e tests and backend fallback. | `http://localhost:3001` (default) |
| `AZURITE_URL` | Azurite local emulation URL. | `http://127.0.0.1:10000` (default) |
The backend auth middleware validates the frontend Entra ID JWT by checking the tenant (`tid`), issuer (`iss`), client/app ID (`appid` or `azp`), and audience (`aud`) claims. `MSAL_EXPECTED_AUD` can be used to override the default audience validation value.

### Frontend (`frontend/.env`)

| Key | Description | Expected Value |
| --- | --- | --- |
| `VITE_API_BASE_URL` | The URL where the frontend expects the backend API. | `http://localhost:3001/api` |
| `VITE_MSAL_CLIENT_ID` | Entra ID Client ID for frontend MSAL authentication. | Your Entra ID application client ID. |
| `VITE_MSAL_TENANT_ID` | Entra ID Tenant ID. | Your Entra ID tenant ID. |
| `VITE_MSAL_REDIRECT_URI` | Redirect URI after successful frontend login. | e.g., `http://localhost:5173/` |

### Frontend Runtime Environment Injection

The Vue 3 frontend utilizes `@import-meta-env/unplugin` to allow loading frontend environment variables robustly at runtime from the statically built `dist/` folder (enabling a "Build Once, Run Anywhere" strategy). This allows Docker containers or static servers to hot-swap API routes or tenant IDs on standard pre-compiled bundles without triggering a new `vite build`.

To run environment injections dynamically on your built static dist folder before standing up the static web serve:

```bash
# Build the TypeScript / Vue 3 Vite distribution
npm run build

# Inject runtime variables into the compiled static index boundary
npx import-meta-env -x .env -p dist/index.html

# Serve the pre-compiled, environment-aware distribution
npm run serve
```

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

## API Endpoints

### New Endpoints (Download Completion Tracking)

#### Mark Upload Download Complete
```
POST /api/public/requests/:token/mark-download-complete
```
Called automatically by the downloader's browser after initiating file download.
- **Purpose**: Records download completion and updates status to "Downloaded"
- **Parameters**: Token (from download URL)
- **Response**: `{ success: true, downloadCompletedAt: timestamp }`
- **Status Updates**: `Awaiting Download` → `Downloaded`

#### Mark Share Download Complete
```
POST /api/public/shares/:token/mark-download-complete
```
Called automatically when a file share downloader completes download.
- **Purpose**: Records completion for file shares and updates status
- **Parameters**: Token (from share download URL)
- **Response**: `{ success: true, downloadCompletedAt: timestamp }`
- **Status Updates**: `Awaiting Download` → `Downloaded`

### Existing Core Endpoints

#### Requestor - Create Upload Request
```
POST /api/requests
```
Creates a new upload request with auto-generated 18-character passcode.
- **Body**: `{ uploaderEmail: string, requestedFileTypes?: string, expirationDays?: number, allowMultiple?: boolean }`
- **Auto-Generated**: 18-character alphanumeric passcode (bcrypt-hashed for storage)
- **Response**: `{ message, token, caseNumber, request }`
- **Email**: Contains upload link and auto-generated passcode

#### Requestor - Create File Share Upload
```
POST /api/shares/upload
```
Initiates file upload for direct sharing with downloader. Now accepts expiration days.
- **Body**: `{ filename: string, expirationDays?: number }` (defaults to 7)
- **Response**: `{ token, url, blobName }`

#### Requestor - Invite Downloader from Upload
```
POST /api/requests/:token/invite-downloader
```
Creates a new share record from an uploaded file and sends download invitation. Only works when file status is "Clean".
- **Body**: `{ downloaderEmail: string, blobName?: string }`
- **Response**: `{ message, shareToken, caseNumber }`
- **Requirements**: File must be scanned and marked as "Clean"
- **Creates**: New entry in DownloadShares table with expiration tracking

#### Uploader - Get Request Details
```
GET /api/public/requests/:token
```
Public endpoint for uploader to access request details.

#### Uploader - Request SAS Token
```
GET /api/public/requests/:token/sas
```
Returns time-limited, write-only SAS token for secure upload.

#### Uploader - Confirm Upload
```
POST /api/public/requests/:token/confirm
```
Confirms file upload and triggers malware scanning.

#### Downloader - Access File Share
```
GET /api/public/shares/:token
```
Public endpoint for downloader to access share details.

#### Downloader - Validate Passcode
```
POST /api/public/shares/:token/validate-passcode
```
Validates the passcode and returns download SAS token.
- **Body**: `{ passcode: string }`

#### Downloader - Get Download SAS
```
GET /api/public/shares/:token/sas
```
Returns time-limited, read-only SAS token for secure download.

#### Requestor - Refresh Request List
```
GET /api/requests
```
Authenticated endpoint to list all user's requests with current statuses.

# Secure File Portal Verification Walkthrough

The Secure File Portal Assistant application is now completely developed. It includes the Vue 3 frontend, the Express backend, and mock services for Azure Storage, Azure Data Tables, GCNotify, and Assemblyline to allow for complete local verification without requiring cloud keys immediately.

## Application Components Completed

- **Frontend (`/frontend`)**: Vue 3 application built with Vite and TypeScript, stylized with modern glassmorphism Vanilla CSS.
  - `RequestorDashboard.vue`: Displays your active requests, their statuses, and allows creating a new upload link.
  - `UploaderView.vue`: The secure upload portal for external users. Generates short-lived Azure Blob SAS tokens in the background to handle direct and masked file uploads.
- **Backend (`/backend`)**: Express API server.
  - `server.js`: Web server and mocked authentication middleware.
  - `azureBlobService.js`: Scoped SAS token generator.
  - `azureTableService.js`: Lightweight NoSQL tracking for request stages and file lifecycle tracking.
  - `gcNotifyService.js`: Wrapper for GCNotify emails (currently mocks to console limit API usage during testing).
  - `assemblylineService.js`: Simulates a 10-second quarantine and scan, marking the file clean automatically.

1. Automated Uploader Passcodes ✅
   - **Frontend Changes**: Removed Secret Field from the uploader request form
     - Eliminated the manual secret input field
     - Removed secret from newRequest state object
     - Requestors now only enter uploader email, file types, expiration, and multi-file option
   - **Backend Changes**: Auto-Generation of Secrets
     - Added auto-generation function that creates 18-character alphanumeric secrets
     - Secrets are bcrypt-hashed before storage
     - Auto-generated secret is sent in the uploader invitation email
   - **Security Benefits**:
     - Consistent Security: Same bcrypt hashing as downloader passcodes
     - No Manual Errors: Eliminates typos or weak manual passcodes
     - 18-Character Length: Stronger than the 8-character downloader passcodes
     - Seamless UX: Requestors don't need to think about or remember secrets
2. SharePoint Integration ✅
   - **Frontend Changes**: Added SharePoint upload capability
     - New "Share to SharePoint" button next to the "Share" button for clean files
     - Integrated with Microsoft Graph API for SharePoint uploads
     - Uses requestor's existing MSAL token with expanded scopes
   - **Microsoft Graph API Integration**:
     - One-Click Upload: Downloads clean file from Azure Blob Storage
     - Seamless SSO: Uses requestor's Entra ID token (no additional login required)
     - Default Location: Uploads to root Documents library of user's default SharePoint site
     - Required Permissions: `Files.ReadWrite.All` and `Sites.ReadWrite.All` scopes
   - **Error Handling**: Clear error messages for permission or connectivity issues
   - **Technical Validation**:
     - ✅ TypeScript Compilation: No errors in frontend or backend
     - ✅ Build Success: Both projects build successfully
     - ✅ Security Audit: 0 high/critical vulnerabilities
     - ✅ API Integration: Microsoft Graph API properly integrated
   - **User Experience Flow**:
     - File uploaded and scanned → Status: "Clean"
     - Requestor sees "Share" and "Share to SharePoint" buttons
     - Click "Share to SharePoint" → File automatically uploaded to SharePoint
     - Success confirmation displayed

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

### Assemblyline V4 API Integration


### 1. **Individual File Status in the Requestor Dashboard**
- I added a new property `fileStatuses` to the Azure Table Data Schema (`azureTableService.ts`), which acts as a lightweight JSON string to map specific file blobs to their individual scanning status (`Clean`, `Malicious`, etc).
- I updated the **Requestor Dashboard UI** (`RequestorDashboard.tsx`) so that each downloaded blob maps and correlates directly against its own individual badge within that JSON payload. 
- The `assemblylineService.ts` now securely manages checking `req.fileStatuses` and correctly updates only the scanned file, while calculating whether the overarching request status should be rolled to `Malicious` or kept as `Clean`. 

### 2. **AssemblyLine4 Docker Engine Integration (Local Test)**
- **Hooked Backend up to AL4 API**: I modified your mocked `assemblylineService.ts` fallback. When you are ready to switch from mock behavior, populate your `.env` to point `ASSEMBLYLINE_URL` (instead of "mock") to your AL4 service route. The backend service will extract Azure SAS Blob URIs automatically, pass them into your AL4 instance using an HTTP `POST /api/v4/submit/`, and synchronously poll the submission ticket queue to retrieve valid results locally without mocking functionality. 

**Steps to deploy CCCS Assemblyline 4 locally (WSL/Ubuntu):**
To run the full suite, the official [CCCS Installation Guide](https://cybercentrecanada.github.io/assemblyline4_docs/installation/appliance/docker/) requires utilizing their composed deployment repository to guarantee appropriate service meshing. Run the following on your local Docker engine host (e.g., WSL terminal):

> **Deploying offline?** For strict, air-gapped network deployments without internet access, utilize the scripts and playbook provided inside the `assemblyline4/` directory at the root of this repo. Refer to `assemblyline4/README.md` for explicit offline steps.

1. **Configure Docker to use larger address pools:**
   ```bash
   sudo sysctl -w vm.max_map_count=262144
   ```

2. **Download the Assemblyline Docker Compose repository:**
   ```bash
   git clone https://github.com/CybercentreCanada/assemblyline-docker-compose.git al4-local
   cd al4-local
   ```

3. **Create your HTTPS certificates:**
   ```bash
   openssl req -nodes -x509 -newkey rsa:4096 -keyout config/nginx.key -out config/nginx.crt -days 365 -subj "/C=CA/ST=Ontario/L=Ottawa/O=CCCS/CN=assemblyline.local"
   ```

4. **Pull necessary Docker containers:**
   ```bash
   sudo docker compose pull --ignore-buildable
   sudo env COMPOSE_BAKE=true docker compose build
   sudo docker compose -f bootstrap-compose.yaml pull
   ```

5. **Deploy the CCCS Appliance:**
   ```bash
   sudo docker compose up -d --wait
   sudo docker compose -f bootstrap-compose.yaml up
   ```

**Once it's running:** Access the local AL4 UI at `https://localhost` with the default `.env` credentials (`admin`/`admin`). Make sure your App Backend `.env` points to this hostname: `ASSEMBLYLINE_URL=https://localhost`.

*Note: Since the backend is running `node dist/server.js` and not actively watching `.ts` files on edit, you'll need to restart your terminal process (`Ctrl+C`, then `cd .\backend\ && npm install && npm run build && npm start`) for these modifications to take effect.*

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

### Demo Frontend & Backend

The following new screenshots were added in chronological order by creation date. Each file shows a recent frontend or backend screen capture for uploader, requestor, multi-file, share, and downloader workflows.

- ![Portail Sécurisé de Demande de Fichiers](img/image-1.png)

- ![Secure File Request Portal Login](img/image.png)

- ![New uploader request form - English](img/new-uploader-request-en.png) `new-uploader-request-en.png` – English new uploader request creation form.

- ![New uploader request form - French](img/new-uploader-request-fr.png) `new-uploader-request-fr.png` – French new uploader request creation form.

- ![Active uploader request pending - English](img/active-uploader-request-pending-en.png) `active-uploader-request-pending-en.png` – English requestor dashboard showing an active uploader request in pending state.

- ![Active uploader request pending - French](img/active-uploader-request-pending-fr.png) `active-uploader-request-pending-fr.png` – French requestor dashboard showing an active uploader request in pending state.

- ![New share file for downloader - English](img/new-share-file-for-downloader-en.png) `new-share-file-for-downloader-en.png` – English shared-file request view after a new downloader share is created.

- ![New share file for downloader - French](img/new-share-file-for-downloader-fr.png) `new-share-file-for-downloader-fr.png` – French shared-file request view after a new downloader share is created.

- ![Downloader invite sent - English](img/file-uploaded-downloader-invite-sent-en.png) `file-uploaded-downloader-invite-sent-en.png` – English screen confirming the downloader invite was sent.

- ![Share file list ready - English](img/share-file-list-ready-en.png) `share-file-list-ready-en.png` – English requestor view of ready file shares in the dashboard.

- ![Downloader request email - French](img/downloader-request-email-fr.png) `downloader-request-email-fr.png` – French email shown when a downloader is invited to access a shared file.

- ![Uploader secret passcode page - English](img/uploader-link-secret-passcode-en.png) `uploader-link-secret-passcode-en.png` – English uploader page showing the generated secret passcode for upload.

- ![Uploader secret passcode page - French](img/uploader-link-secret-passcode-fr.png) `uploader-link-secret-passcode-fr.png` – French uploader page showing the generated secret passcode.

- ![Uploader link upload page - English](img/uploader-link-uploadfile-en.png) `uploader-link-uploadfile-en.png` – English uploader view displaying the secure upload link and instructions.

- ![Uploader link upload page - French](img/uploader-link-uploadfile-fr.png) `uploader-link-uploadfile-fr.png` – French uploader view displaying the secure upload link and instructions.

- ![Example PDF upload - French](img/upload-examplepdf-fr.png) `upload-examplepdf-fr.png` – French uploader screen demonstrating PDF upload guidance.

- ![Example PDF upload - English](img/upload-examplepdf-en.png) `upload-examplepdf-en.png` – English uploader screen demonstrating PDF upload guidance.

- ![Uploader success - English](img/uploader-uploaded-success-en.png) `uploader-uploaded-success-en.png` – English confirmation screen for a successful uploader upload.

- ![Uploader success - French](img/uploader-uploaded-success-fr.png) `uploader-uploaded-success-fr.png` – French confirmation screen for a successful uploader upload.

- ![Uploaded file malicious status - English](img/file-uploaded-status-malicious-en.png) `file-uploaded-status-malicious-en.png` – English requestor screen showing a file that was marked malicious.

- ![Uploaded file malicious status - French](img/file-uploaded-status-malicious-fr.png) `file-uploaded-status-malicious-fr.png` – French requestor screen showing a file that was marked malicious.

- ![Downloader email - English](img/file-downloader-email-en.png) `file-downloader-email-en.png` – English email sent to the downloader with link and passcode instructions.

- ![Downloader email - French](img/file-downloader-email-fr.png) `file-downloader-email-fr.png` – French email sent to the downloader with link and passcode instructions.

- ![Downloader download page - English](img/file-downloader-downloadpage-en.png) `file-downloader-downloadpage-en.png` – English downloader page with the download action and passcode fields.

- ![Downloader download page - French](img/file-downloader-downloadpage-fr.png) `file-downloader-downloadpage-fr.png` – French downloader page with download action and passcode entry.

- ![Downloader downloaded status - English](img/file-downloader-downloaded-status-en.png) `file-downloader-downloaded-status-en.png` – English downloader page after the file has been successfully downloaded.

- ![Downloader downloaded status - French](img/file-downloader-downloaded-status-fr.png) `file-downloader-downloaded-status-fr.png` – French downloader page showing the completed download status.

- ![Requestor multi-file request form - English](img/requestor-upload-multifile-en.png) `requestor-upload-multifile-en.png` – English requestor screen for creating a multi-file upload request.

- ![Requestor multi-file request form - French](img/requestor-upload-multifile-fr.png) `requestor-upload-multifile-fr.png` – French requestor screen for creating a multi-file upload request.

- ![Requestor multi-file email - French](img/requestor-upload-multifile-email-fr.png) `requestor-upload-multifile-email-fr.png` – French version of the multi-file upload request email.

- ![Requestor multi-file email link - English](img/requestor-upload-multifile-email-link-upload-en.png) `requestor-upload-multifile-email-link-upload-en.png` – English version of the multi-file upload request email with the upload link.

- ![Multi-file email upload link - French](img/requestor-upload-multifile-email-link-upload-fr.png) `requestor-upload-multifile-email-link-upload-fr.png` – French email containing the upload link for a multi-file request.

- ![Multi-file upload first file progress - English](img/requestor-upload-multifile-email-link-uploading-1-en.png) `requestor-upload-multifile-email-link-uploading-1-en.png` – English requestor email showing first file upload progress for a multi-file request.

- ![Multi-file upload first file progress - French](img/requestor-upload-multifile-email-link-uploading-1-fr.png) `requestor-upload-multifile-email-link-uploading-1-fr.png` – French requestor email showing first file upload progress.

- ![Multi-file upload progress email - English](img/requestor-upload-multifile-email-link-uploading-2-en.png) `requestor-upload-multifile-email-link-uploading-2-en.png` – English requestor email showing second file upload in progress.

- ![Multi-file upload progress email - French](img/requestor-upload-multifile-email-link-uploading-2-fr.png) `requestor-upload-multifile-email-link-uploading-2-fr.png` – French requestor email with the second file upload in progress.

- ![Multi-file email complete - French](img/requestor-upload-multifile-email-link-uploading-2-complete-fr.png) `requestor-upload-multifile-email-link-uploading-2-complete-fr.png` – French requestor email showing the second upload completion.

- ![Multi-file email upload complete - English](img/requestor-upload-multifile-email-link-uploading-2-complete-en.png) `requestor-upload-multifile-email-link-uploading-2-complete-en.png` – Requestor email view showing the second file upload completed in a multi-file request.

- ![Multi-file email fulfilment - English](img/requestor-upload-multifile-email-link-uploading-2-fulfil-en.png) `requestor-upload-multifile-email-link-uploading-2-fulfil-en.png` – English email view with the second multi-file upload fulfilment state.

- ![Multi-file email fulfilment - French](img/requestor-upload-multifile-email-link-uploading-2-fulfil-fr.png) `requestor-upload-multifile-email-link-uploading-2-fulfil-fr.png` – French email view for the second multi-file upload fulfilment.

- ![Multi-file share ready - English](img/uploaded-multifile-share-ready-1-en.png) `uploaded-multifile-share-ready-1-en.png` – English multi-file share ready screen showing a file prepared for download.

- ![Multi-file share ready - French](img/uploaded-multifile-share-ready-1-fr.png) `uploaded-multifile-share-ready-1-fr.png` – French multi-file share ready screen showing a share-ready entry.

- ![File share details - English](img/uploaded-file-share-en.png) `uploaded-file-share-en.png` – English-language shared file detail and status screen.

- ![File share details - French](img/uploaded-file-share-fr.png) `uploaded-file-share-fr.png` – French-language view of shared file details and download status.

- ![File share success - French](img/uploaded-file-share-success-fr.png) `uploaded-file-share-success-fr.png` – French confirmation page after a shared file is prepared.

- ![File share success - English](img/uploaded-file-share-success-en.png) `uploaded-file-share-success-en.png` – Confirmation that a shared file invitation was created successfully.

---

#### Case Number Format Reference
Request numbers follow the format: `RQ-[timestamp-base36][random-base36]` (truncated to 16 chars)
- Algorithm: Current timestamp converted to base36 uppercase, concatenated with 8-character random string in base36 uppercase, prefixed with "RQ-", and truncated to exactly 16 characters
- Example: `RQ-VR3KLY8ZA0G9J2X`
- Length: 16 characters maximum
- Included in: Email subjects, email bodies, and all audit logs
- Purpose: Unique tracking for compliance, auditing, and support reference

---

## Feature Comparison Table

| Feature | Traditional Upload Request | Direct File Share |
|---------|---------------------------|-------------------|
| **Initiated By** | Requestor | Requestor |
| **Recipient Role** | Uploader (receives upload link) | Downloader (receives download link) |
| **Action Required** | Upload a file | Download a pre-uploaded file |
| **Security** | SAS token write-only, auto-generated 18-char passcode | Passcode + secure download link |
| **Email Delivery** | GCNotify/SMTP | GCNotify/SMTP |
| **Tracking** | Request number, status progression | Request number, download completion |
| **Expiration** | Configurable (1,7,14,30 days) | Configurable (1,7,14,30 days) |
| **Status** | Pending → Uploaded → Scanning → Clean/Malicious (with security restrictions) | Ready → Awaiting Download → Downloaded |
| **File Storage** | Azure Blob Storage | Azure Blob Storage |
| **Metadata** | UploadRequests table | DownloadShares table |
| **Sharing Condition** | Only when file status = "Clean" | Only when file status = "Clean" |
| **SharePoint Integration** | Available for clean files | N/A |

---

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

### Amazon SES - SMTP Configuration

The error you are encountering is a standard restriction imposed by Amazon Web Services (AWS) called **SES Sandbox Mode**.

When you first set up an Amazon SES account, it is placed in a sandbox environment to prevent fraud and abuse. While your account is in this sandbox, **you are only allowed to send emails to and from addresses that you have explicitly verified** in the AWS Console. 

Since `soundmos@gmail.com` hasn't been verified in your AWS account, SES blocks the outgoing email and throws the `Message rejected: Email address is not verified` error.

### How to fix it:

You have two options depending on what you are trying to accomplish right now:

#### Option 1: Quick Fix for Testing (Verify the specific email)
If you just want to test the portal with a few distinct email addresses (like `soundmos@gmail.com`), you need to verify them as identities:
1. Log into your **AWS Management Console**.
2. Navigate to **Amazon Simple Email Service (SES)**.
3. Make sure you are in the correct region (in your case, **`ca-central-1`** / Canada (Central)).
4. On the left sidebar, click **Identities** (under Configuration).
5. Click **Create identity**, select **Email address**, and enter `soundmos@gmail.com`.
6. Click **Create identity**. AWS will send a verification email with a link to that address. 
7. Once you click the link in that email, the identity is verified, and your application will successfully transmit SES SMTP emails to it.

#### Option 2: Long-term Fix (Move out of the SES Sandbox)
If you are ready for production and want the ability to send requests to *any* uploader's email address dynamically without verifying them beforehand, you must request AWS to remove the sandbox restriction:
1. In the **SES Console**, go to your **Account dashboard**.
2. Under the "Account details" section, look for a banner or button that says **Request production access** (or "Edit your account details" to move out of the sandbox).
3. Fill out the application form explaining your use case (e.g., "This application is a secure file upload portal for the Government of Canada, and we need to send temporary upload links to external citizens and businesses").
4. Submit the request. AWS usually approves these requests within 24 hours. Once approved, your application can send emails to any valid address globally.

### API Routes Reference

#### Protected Endpoints (Requires Microsoft Entra ID Bearer Token):
* `POST /api/requests` - Create a new upload request for an external user.
* `GET /api/requests` - Retrieve all upload requests for your team.
* `GET /api/requests/:token/download` - Get Azure SAS to download an uploaded file.
* `POST /api/requests/:token/invite-downloader` - Invite an external downloader to a submitted file.
* `POST /api/shares/upload` - Request a SAS to upload a new direct file share.
* `POST /api/shares/confirm` - Confirm completion of a direct file share.
* `GET /api/shares` - Retrieve your direct file shares.
* `POST /api/shares/:token/invite` - Send a file share access email to a downloader.

#### Public Endpoints (Uploader/Downloader Interfaces):
* `GET /api/public/requests/:token` - Get basic info/validation of an upload request.
* `POST /api/public/requests/:token/send-uploader-2fa` - Email a 6-digit uploader 2FA code.
* `POST /api/public/requests/:token/send-downloader-2fa` - Email a 6-digit downloader 2FA code.
* `POST /api/public/requests/:token/validate-secret` - Authorize an uploader using 2FA.
* `POST /api/public/requests/:token/validate-download` - Authorize a downloader using 2FA.
* `POST /api/public/requests/:token/sas` - Generate Azure SAS to directly upload a mapped file.
* `POST /api/public/requests/:token/confirm` - Confirm a new file was uploaded into Azure.
* `GET /api/public/requests/:token/download` - Get SAS URL for downloading a file securely.
* `POST /api/public/requests/:token/mark-download-complete` - Mark a secure file as successfully downloaded.
* `GET /api/public/shares/:token` - Get basic info of a file share map.
* `POST /api/public/shares/:token/send-download-2fa` - Trigger 2FA to a share recipient.
* `POST /api/public/shares/:token/validate-download` - Authorize a share recipient using 2FA.
* `GET /api/public/shares/:token/download` - Create SAS URL for the share.
* `POST /api/public/shares/:token/mark-download-complete` - Mark share download map as completely downloaded.