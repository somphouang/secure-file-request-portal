import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as azureTableService from '../services/azureTableService.js';
import * as azureBlobService from '../services/azureBlobService.js';
import * as gcNotifyService from '../services/gcNotifyService.js';
import * as assemblylineService from '../services/assemblylineService.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const createRequest = async (req: Request, res: Response) => {
    try {
        const { uploaderEmail, requestedFileTypes, expirationDays, secret, allowMultiple } = req.body;
        let requestorEmail = req.user?.preferred_username || req.body.requestorEmail || 'admin@example.com';
        
        // Remove characters forbidden in Azure Table keys: / \ # ? 
        requestorEmail = requestorEmail.replace(/[\/\\#\?]/g, '_');

        if (!uploaderEmail) {
            return res.status(400).json({ error: 'uploaderEmail required' });
        }

        let secretHash = '';
        if (secret) {
            secretHash = await bcrypt.hash(secret, 10);
        }

        const entity = await azureTableService.createUploadRequest(
            requestorEmail, 
            uploaderEmail, 
            requestedFileTypes || 'pdf,xlsx',
            secretHash,
            parseInt(expirationDays as string, 10) || 7,
            allowMultiple === true
        );
        
        const uploadLink = `${FRONTEND_URL}/upload/${entity.rowKey}`;
        
        // Send email
        await gcNotifyService.sendUploadRequestEmail(uploaderEmail, requestorEmail, uploadLink, secret, allowMultiple === true);

        res.status(201).json({
            message: 'Upload request created.',
            token: entity.rowKey,
            request: entity
        });
    } catch (error: any) {
        console.error('Error creating request:', error.message, error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

export const getRequestInfo = async (req: Request, res: Response) => {
    try {
        const token = req.params.token as string;
        const request = await azureTableService.getRequestByTokenOnly(token);
        
        if (!request || (request.expiresAt && new Date(request.expiresAt) < new Date())) {
            return res.status(404).json({ error: 'Upload request not found or expired.' });
        }

        res.json({
            uploaderEmail: request.uploaderEmail,
            requestedFileTypes: request.requestedFileTypes,
            status: request.status,
            requiresSecret: !!request.secretHash,
            blobUri: request.blobUri || null,
            allowMultiple: request.allowMultiple || false,
            isClosed: request.isClosed || false
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const validateSecret = async (req: Request, res: Response) => {
    try {
        const token = req.params.token as string;
        const { secret } = req.body;
        const request = await azureTableService.getRequestByTokenOnly(token);
        
        if (!request || (request.expiresAt && new Date(request.expiresAt) < new Date())) {
            return res.status(404).json({ error: 'Not found or expired' });
        }
        
        if (request.secretHash) {
            if (!secret) return res.status(401).json({ error: 'Secret required' });
            const isValid = await bcrypt.compare(secret, request.secretHash);
            if (!isValid) return res.status(401).json({ error: 'Invalid secret' });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const generateUploadSas = async (req: Request, res: Response) => {
    try {
        const token = req.params.token as string;
        const { filename, secret } = req.body;

        const request = await azureTableService.getRequestByTokenOnly(token);
        
        if (!request || (request.expiresAt && new Date(request.expiresAt) < new Date())) {
            return res.status(404).json({ error: 'Not found or expired' });
        }
        // Validate secret
        if (request.secretHash) {
            if (!secret) return res.status(401).json({ error: 'Secret required' });
            const isValid = await bcrypt.compare(secret, request.secretHash);
            if (!isValid) return res.status(401).json({ error: 'Invalid secret' });
        }

        const ext = filename ? (filename as string).split('.').pop() : 'bin';
        const blobName = `${token}-${Date.now()}.${ext}`;

        const sasInfo = azureBlobService.generateUploadSasToken(blobName);
        res.json(sasInfo);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const confirmUpload = async (req: Request, res: Response) => {
    try {
        const token = req.params.token as string;
        const { blobName } = req.body;

        const request = await azureTableService.getRequestByTokenOnly(token);
        if (!request) return res.status(404).json({ error: 'Not found' });

        await azureTableService.updateRequestStatus(request.partitionKey!, token, {
            status: 'Uploaded',
            blobUri: request.blobUri ? `${request.blobUri},${blobName}` : blobName
        });

        // Trigger Assemblyline scan
        assemblylineService.scanFile(request.partitionKey!, token, blobName);

        res.json({ message: 'Upload confirmed. Processing file.', status: 'Uploaded' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const closeRequest = async (req: Request, res: Response) => {
    try {
        const token = req.params.token as string;
        const request = await azureTableService.getRequestByTokenOnly(token);
        
        if (!request) return res.status(404).json({ error: 'Not found' });
        
        await azureTableService.updateRequestStatus(request.partitionKey!, token, {
            isClosed: true
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const listRequestorUploads = async (req: Request, res: Response) => {
    try {
        let requestorEmail = req.user?.preferred_username || (req.query.email as string) || 'admin@example.com';
        requestorEmail = requestorEmail.replace(/[\/\\#\?]/g, '_');
        
        const requests = await azureTableService.getRequestsByRequestor(requestorEmail);
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const generateDownloadSas = async (req: Request, res: Response) => {
    try {
        const token = req.params.token as string;
        const filename = req.query.filename as string;
        let requestorEmail = req.user?.preferred_username || (req.query.email as string) || 'admin@example.com';
        requestorEmail = requestorEmail.replace(/[\/\\#\?]/g, '_');

        const request = await azureTableService.getUploadRequest(requestorEmail, token);
        
        if (!request) return res.status(404).json({ error: 'Not found or not authorized' });
        // Instead of strict Clean check, we check if there are files
        if (!request.blobUri) return res.status(404).json({ error: `No files uploaded.` });

        const targetBlob = filename || request.blobUri.split(',')[0];
        const sasUrl = azureBlobService.generateDownloadSasToken(targetBlob);
        res.json({ url: sasUrl });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
