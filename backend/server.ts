import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initTable } from './services/azureTableService.js';
import { initBlob } from './services/azureBlobService.js';
import * as uploadController from './controllers/uploadController.js';

// Extend Express Request to include user context
declare global {
    namespace Express {
        interface Request {
            user?: {
                preferred_username: string;
            };
        }
    }
}

const app = express();
app.use(cors());
app.use(express.json());

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
process.on('exit', (code) => {
    console.log(`Process exiting with code: ${code}`);
});

// Auth Middleware Mock
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            req.user = { preferred_username: decoded.preferred_username || decoded.upn || decoded.unique_name || 'msaluser@example.com' };
            return next();
        } catch (e) {
            console.error('Invalid token format', e);
        }
    }
    req.user = { preferred_username: (req.headers['x-user-email'] as string) || 'admin@example.com' };
    next();
};

app.post('/api/requests', authMiddleware, uploadController.createRequest);
app.get('/api/requests', authMiddleware, uploadController.listRequestorUploads);
app.get('/api/requests/:token/download', authMiddleware, uploadController.generateDownloadSas);
app.get('/api/public/requests/:token', uploadController.getRequestInfo);
app.post('/api/public/requests/:token/validate-secret', uploadController.validateSecret);
app.post('/api/public/requests/:token/sas', uploadController.generateUploadSas);
app.post('/api/public/requests/:token/confirm', uploadController.confirmUpload);
app.post('/api/public/requests/:token/complete', uploadController.closeRequest);

const port = process.env.PORT || 3001;

(async () => {
    try {
        console.log('Initializing Azure services...');
        await initTable();
        await initBlob();
        
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
