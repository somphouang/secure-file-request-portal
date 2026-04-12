import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// We have to mock the azure tables to test the controller without a real DB running
jest.mock('../services/azureTableService.js', () => {
    const mockEntities: Record<string, any> = {};
    return {
        createUploadRequest: jest.fn((reqE, uplE, reqTypes, secH, expD) => {
            const token = 'mock-1234';
            const entity = {
                partitionKey: reqE, rowKey: token, uploaderEmail: uplE, requestedFileTypes: reqTypes,
                status: 'Pending', secretHash: secH, expiresAt: new Date(Date.now() + 86400000)
            };
            mockEntities[token] = entity;
            return Promise.resolve(entity);
        }),
        getRequestByTokenOnly: jest.fn((token: any) => Promise.resolve(mockEntities[token])),
        updateRequestStatus: jest.fn(() => Promise.resolve())
    };
});
jest.mock('../services/gcNotifyService.js', () => ({
    sendUploadRequestEmail: jest.fn(() => Promise.resolve())
}));

jest.mock('uuid', () => ({ v4: () => 'mocked-uuid-1234' }));

jest.mock('bcryptjs', () => ({
    hash: jest.fn(() => Promise.resolve('mocked-hash')),
    compare: jest.fn((secret) => Promise.resolve(secret === 'MySecretPasscode'))
}));

import * as uploadController from '../controllers/uploadController.js';

// Create test app wrapper
const app = express();
app.use(express.json());
app.post('/api/requests', (req: Request, res: Response, next: NextFunction) => {
    req.user = { preferred_username: 'test@example.com' };
    next();
}, uploadController.createRequest);

app.post('/api/public/requests/:token/validate-secret', uploadController.validateSecret);

describe('Backend API', () => {
    let currentToken = '';

    it('should create an upload request with a secret', async () => {
        const res = await request(app)
            .post('/api/requests')
            .send({
                uploaderEmail: 'up@ex.com',
                requestedFileTypes: 'pdf',
                secret: 'MySecretPasscode',
                expirationDays: 5
            });
        
        expect(res.statusCode).toEqual(201);
        expect(res.body.token).toBeDefined();
        currentToken = res.body.token;
    });

    it('should fail to validate secret with incorrect password', async () => {
        const res = await request(app)
            .post(`/api/public/requests/${currentToken}/validate-secret`)
            .send({ secret: 'WrongPassword' });
        
        expect(res.statusCode).toEqual(401);
    });

    it('should succeed to validate secret with correct password', async () => {
        const res = await request(app)
            .post(`/api/public/requests/${currentToken}/validate-secret`)
            .send({ secret: 'MySecretPasscode' });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
    });
});
