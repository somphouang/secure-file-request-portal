import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { dbService } from './services/dbService.js';
import { storageService } from './services/storageService.js';
import * as uploadController from './controllers/uploadController.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import yaml from 'yaml';
import path from 'path';

// Extend Express Request to include user context
declare global {
    namespace Express {
        interface Request {
            user?: {
                preferred_username: string;
                roles?: string[];
                groups?: string[];
            };
        }
    }
}

const app = express();
app.use(cors());
app.use(express.json());

// Load and serve Swagger
try {
    const yamlPath = fs.existsSync(path.resolve(__dirname, 'swagger.yaml'))
        ? path.resolve(__dirname, 'swagger.yaml')
        : path.resolve(__dirname, '../swagger.yaml');
        
    const file = fs.readFileSync(yamlPath, 'utf8');
    const swaggerDocument = yaml.parse(file);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
    console.warn('Swagger YAML file could not be loaded, skipping UI docs.', e);
}

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
process.on('exit', (code) => {
    console.log(`Process exiting with code: ${code}`);
});

// Auth Middleware
const expectedTenantId = process.env.MSAL_TENANT_ID;
const expectedClientId = process.env.MSAL_CLIENT_ID;
const expectedAudience = process.env.MSAL_EXPECTED_AUD || process.env.MSAL_CLIENT_ID;

const base64UrlDecode = (value: string) => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(value.length + (4 - value.length % 4) % 4, '=');
    return Buffer.from(padded, 'base64').toString('utf8');
};

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization bearer token required' });
    }

    const token = authHeader.split(' ')[1];
    const parts = token.split('.');
    if (parts.length !== 3) {
        return res.status(401).json({ error: 'Invalid authorization token format' });
    }

    let decoded: any;
    try {
        decoded = JSON.parse(base64UrlDecode(parts[1]));
    } catch (e) {
        console.error('Invalid token payload', e);
        return res.status(401).json({ error: 'Invalid authorization token payload' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && now >= decoded.exp) {
        return res.status(401).json({ error: 'Authorization token expired' });
    }
    if (decoded.nbf && now < decoded.nbf) {
        return res.status(401).json({ error: 'Authorization token not yet valid' });
    }

    if (expectedTenantId) {
        if (!decoded.tid || decoded.tid !== expectedTenantId) {
            return res.status(401).json({ error: 'Invalid tenant in authorization token' });
        }
        if (!decoded.iss || !decoded.iss.includes(expectedTenantId)) {
            return res.status(401).json({ error: 'Invalid issuer in authorization token' });
        }
    }

    if (!expectedClientId) {
        return res.status(500).json({ error: 'Backend configuration error: MSAL_CLIENT_ID is not set' });
    }

    const tokenClientId = decoded.appid || decoded.azp;
    if (!tokenClientId || tokenClientId !== expectedClientId) {
        return res.status(401).json({ error: 'Invalid client/app ID in authorization token' });
    }

    if (expectedAudience) {
        const audValues = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
        if (!audValues.includes(expectedAudience)) {
            return res.status(401).json({ error: 'Invalid audience in authorization token' });
        }
    }

    const preferredUsername = decoded.preferred_username || decoded.upn || decoded.unique_name || decoded.email || decoded.sub;
    if (!preferredUsername) {
        return res.status(401).json({ error: 'Authorization token does not contain a valid user identity' });
    }

    const roles = Array.isArray(decoded.roles)
        ? decoded.roles.map((value: any) => value.toString())
        : decoded.roles ? [decoded.roles.toString()] : [];

    const groups = Array.isArray(decoded.groups)
        ? decoded.groups.map((value: any) => value.toString())
        : decoded.groups ? [decoded.groups.toString()] : [];

    req.user = {
        preferred_username: preferredUsername,
        roles,
        groups
    };
    next();
};

app.post('/api/requests', authMiddleware, uploadController.createRequest);
app.get('/api/requests', authMiddleware, uploadController.listRequestorUploads);
app.get('/api/requests/:token/download', authMiddleware, uploadController.generateDownloadSas);
app.post('/api/requests/:token/invite-downloader', authMiddleware, uploadController.inviteDownloader);

// File sharing endpoints
app.post('/api/shares/upload', authMiddleware, uploadController.uploadFileForSharing);
app.post('/api/shares/confirm', authMiddleware, uploadController.confirmShareUpload);
app.get('/api/shares', authMiddleware, uploadController.getDownloadShares);
app.post('/api/shares/:token/invite', authMiddleware, uploadController.inviteDownloaderToShare);

app.get('/api/public/requests/:token', uploadController.getRequestInfo);
app.post('/api/public/requests/:token/send-uploader-2fa', uploadController.sendUploader2fa);
app.post('/api/public/requests/:token/send-downloader-2fa', uploadController.sendDownloader2fa);
app.post('/api/public/requests/:token/validate-secret', uploadController.validateSecret);
app.post('/api/public/requests/:token/validate-download', uploadController.validateDownloadSecret);
app.get('/api/public/requests/:token/download', uploadController.generateDownloadSasForDownloader);
app.post('/api/public/requests/:token/mark-download-complete', uploadController.markDownloadComplete);
app.post('/api/public/requests/:token/sas', uploadController.generateUploadSas);
app.post('/api/public/requests/:token/confirm', uploadController.confirmUpload);
app.post('/api/public/requests/:token/complete', uploadController.closeRequest);

app.get('/api/public/shares/:token', uploadController.getShareInfo);
app.post('/api/public/shares/:token/send-download-2fa', uploadController.sendShareDownloader2fa);
app.post('/api/public/shares/:token/validate-download', uploadController.validateShareDownloadSecret);
app.get('/api/public/shares/:token/download', uploadController.generateShareDownloadSas);
app.post('/api/public/shares/:token/mark-download-complete', uploadController.markShareDownloadComplete);

const port = process.env.PORT || 3001;

(async () => {
    try {
        console.log('Initializing Azure services...');
        await dbService.initTable();
        await storageService.initBlob();
        
        app.listen(port, () => {
            console.log(`Backend server running on port ${port}`);
        });

        // Heartbeat to keep process alive in some environments
        setInterval(() => {
            // console.log('Heartbeat...');
        }, 60000);

    } catch (err) {
        console.error('Failed to initialize Azure services:', err);
        process.exit(1);
    }
})();
