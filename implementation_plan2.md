# Secure File Portal Assistant Implementation Plan

This plan details the implementation of a full-stack Node.js application that allows internal users (requestors) to request files from external users (uploaders) securely.

## User Review Required

> [!IMPORTANT]
> Please review the architecture and technology choices:
> - **Frontend**: Clean, custom React + Vanilla CSS implementation of the Government of Canada design system (WCAG 2.1 AA accessible, dropping the legacy WET4 jQuery template for stability).
> - **Backend**: Node.js with Express.js.
> - **Database**: Azure Table Storage (tracking requests, bcrypt-hashed secrets, and dynamic expiration dates).
> - **Storage**: Azure Blob Storage (for file uploads, utilizing short-lived SAS tokens).
> - **Auth**: Azure Identity / MSAL for Managed Identity / Entra ID login for the requestor.
> - **Notification**: GCNotify API for sending the email link to the uploader.
> - **Security**: Uploader forms now require a secret passcode (hashed in DB) to initiate the SAS token exchange.

Please let me know if you would like any changes to this stack. For development/testing, do you have mock credentials for Azure/GCNotify/Assemblyline, or should I implement mocked services for them initially so you can test the flow locally?

## Proposed Architecture

### Backend (API)
- Uses `express` to serve API routes.
- Integrates `@azure/storage-blob` to generate scoped SAS tokens, allowing the frontend to upload directly to Azure securely without exposing the primary container.
- Integrates `@azure/data-tables` to maintain state (pending, uploaded, scanning, clean, malicious) and store file hashes for record-keeping.
- Exposes an endpoint to trigger GCNotify emails (`axios`).
- Integrates with Assemblyline for malware vetting.

### Frontend (UI)
- A React application with beautiful Vanilla CSS styling (glassmorphism, modern typography, animations).
- **Requestor View**: Login button (Managed Identity), Dashboard to see past requests and their statuses, and a form to create a new file request (specifying allowed file types, uploader email).
- **Uploader View**: Accessed via the unique emailed link. Shows what files are requested, allows drag-and-drop upload directly to Azure Blob using the backend-provided SAS token, and displays a confirmation once successfully uploaded.

## Database Schema (Azure Table Storage)
- **Table**: `UploadRequests`
  - `PartitionKey`: RequestorEmail
  - `RowKey`: UniqueRequestToken (UUID)
  - `UploaderEmail`: String
  - `RequestedFileTypes`: String (e.g., "pdf,xlsx")
  - [Status](file:///c:/Users/somp/dev/requestor-uploder-assistant/frontend/src/RequestorDashboard.jsx#58-68): String (Pending -> Uploaded -> Scanning -> Clean | Malicious)
  - `SecretHash`: String (bcrypt hash of the upload passcode)
  - `BlobUri`: String
  - `FileHash`: String
  - `CreatedAt`: DateTime
  - `ExpiresAt`: DateTime (Dynamic: 1 hour to 30 days)

## Verification Plan

### Automated/Local Tests
- Implemented with temporary mock services for external dependencies if actual keys aren't provided, to ensure the UI and backend logic are flawless.

### Manual Verification
1. User logs in (Requestor).
2. Requestor creates a request for an email address, specifying PDF files.
3. System records to Azure Table and sends GCNotify email.
4. Uploader opens the specific link.
5. Uploader uploads a PDF. Backend provides a SAS token; file uploads to Blob Storage.
6. Backend updates state to 'Uploaded', triggers Assemblyline scan.
7. Upon 'Clean' result, Requestor can download the file.
