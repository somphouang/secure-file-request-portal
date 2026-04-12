import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

async function testE2E() {
    try {
        console.log('1. Creating request...');
        const createRes = await axios.post(`${process.env.API_BASE_URL || "http://localhost:3001"}/api/requests`, {
            uploaderEmail: 'test-starter@example.com',
            requestedFileTypes: 'pdf,txt',
            expirationDays: "7",
            secret: 'pass'
        }, { headers: { 'x-user-email': 'somp@outlook.com' } });
        
        const token = createRes.data.token;
        console.log('Token created:', token);

        console.log('2. Uploader view validates secret...');
        await axios.post(`${process.env.API_BASE_URL || "http://localhost:3001"}/api/public/requests/${token}/validate-secret`, {
            secret: 'pass'
        });
        
        console.log('3. Getting SAS link for test.txt...');
        const sasRes = await axios.post(`${process.env.API_BASE_URL || "http://localhost:3001"}/api/public/requests/${token}/sas`, {
            filename: 'test.txt',
            secret: 'pass'
        });
        
        const sasUrl = sasRes.data.url;
        const blobName = sasRes.data.blobName;

        console.log('4. Uploading local test.txt to Blob using SAS directly...');
        // Let's read the file from frontend directory
        const txtFile = fs.readFileSync(path.join(__dirname, '../frontend/test.txt'));
        await axios.put(sasUrl, txtFile, {
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': 'text/plain'
            }
        });
        console.log('Blob uploaded successfully');
        
        console.log('5. Confirming upload with backend (Triggers Assemblyline)...');
        await axios.post(`${process.env.API_BASE_URL || "http://localhost:3001"}/api/public/requests/${token}/confirm`, {
            blobName: blobName
        });
        
        console.log('6. UI Dashboard: clicking Refresh List...');
        const listRes = await axios.get(`${process.env.API_BASE_URL || "http://localhost:3001"}/api/requests`, {
            headers: { 'x-user-email': 'somp@outlook.com' }
        });
        
        const requestFromList = listRes.data.find(r => r.rowKey === token);
        console.log(`Status in list after refresh: ${requestFromList.status}`);

    } catch (err) {
        console.error('Flow failed:', err.response?.data || err.message);
    }
}
testE2E();
