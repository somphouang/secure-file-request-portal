# Requestor-Uploader Assistant

The Requestor-Uploader Assistant is a full-stack Node.js application that enables internal users to request sensitive documents from external users via a secure, masked, and trackable direct-to-cloud upload portal.

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

## Setup Instructions
Please refer to the enclosed walkthrough artifacts or run locally via:
1. `cd backend && node server.js`
2. `cd frontend && npm run dev`

## UI Demo
![Frontend UI Demo](file:///C:/Users/somp/.gemini/antigravity/brain/8213afba-9ecc-4070-8023-5313511b1742/goc_accessible_ui_demo_1774314412863.webp)

### Bilingual Support (English/French)
![French Toggle Demo](file:///C:/Users/somp/.gemini/antigravity/brain/8213afba-9ecc-4070-8023-5313511b1742/bilingual_french_demo_1774315542233.webp)

*Note: In the demo above, mock API failures may occur if the local Azurite Azure Storage Emulator is not running, but the UI is fully functional.*


## Demo

![Secure File Request Portal Login](image.png)

![Portail Sécurisé de Demande de Fichiers](image-1.png)

Federated User Login via Entra ID 
![Requestor Dashboard](image-2.png)

Creating new Request
![Request Details](image-3.png)

French Language Support
![Détails de la demande](image-4.png)

