require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initTable } = require('./services/azureTableService');
const { initBlob } = require('./services/azureBlobService');
const uploadController = require('./controllers/uploadController');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Azure resources on startup
(async () => {
    await initTable();
    await initBlob();
})();

// Simple Auth Middleware Mock
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            // For full production, use azure-jwt-verify or passport-azure-ad to validate signatures.
            // Here we decode the token to extract the asserted user context from Entra ID.
            const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            req.user = { preferred_username: decoded.preferred_username || decoded.upn || decoded.unique_name || 'msaluser@example.com' };
            return next();
        } catch (e) {
            console.error('Invalid token format', e);
        }
    }
    // Fallback for mocked local dev without MSAL token
    req.user = { preferred_username: req.headers['x-user-email'] || 'admin@example.com' };
    next();
};

// --- Requestor Endpoints (Require Auth) ---
app.post('/api/requests', authMiddleware, uploadController.createRequest);
app.get('/api/requests', authMiddleware, uploadController.listRequestorUploads);
app.get('/api/requests/:token/download', authMiddleware, uploadController.generateDownloadSas);

// --- Uploader Endpoints (Public APIs relying on unguessable unique Tokens) ---
app.get('/api/public/requests/:token', uploadController.getRequestInfo);
app.post('/api/public/requests/:token/validate-secret', uploadController.validateSecret);
app.post('/api/public/requests/:token/sas', uploadController.generateUploadSas);
app.post('/api/public/requests/:token/confirm', uploadController.confirmUpload);

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
});
