import axios from 'axios';

async function testFlow() {
    try {
        console.log('1. Creating request...');
        const createRes = await axios.post(`${process.env.API_BASE_URL || "http://localhost:3001"}/api/requests`, {
            uploaderEmail: 'test2@example.com',
            requestedFileTypes: 'pdf',
            expirationDays: 7,
            secret: 'testpass'
        }, { headers: { 'x-user-email': 'somp@outlook.com' } });
        
        const token = createRes.data.token;
        console.log('Token:', token);

        console.log('2. Validating secret...');
        await axios.post(`${process.env.API_BASE_URL || "http://localhost:3001"}/api/public/requests/${token}/validate-secret`, {
            secret: 'testpass'
        });
        console.log('Secret valid.');

        console.log('3. Getting SAS link...');
        const sasRes = await axios.post(`${process.env.API_BASE_URL || "http://localhost:3001"}/api/public/requests/${token}/sas`, {
            filename: 'testfile.pdf',
            secret: 'testpass'
        });
        
        const sasUrl = sasRes.data.url;
        const blobName = sasRes.data.blobName;
        console.log('SAS URL obtained. Blob Name:', blobName);

        console.log('4. Uploading to Blob using SAS directly...');
        // Mock a 1KB pdf file memory upload
        const fakePdf = Buffer.alloc(1024, 'a');
        await axios.put(sasUrl, fakePdf, {
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': 'application/pdf'
            }
        });
        console.log('Blob uploaded successfully');
        
        console.log('5. Confirming upload with backend...');
        await axios.post(`${process.env.API_BASE_URL || "http://localhost:3001"}/api/public/requests/${token}/confirm`, {
            blobName: blobName
        });
        console.log('Upload Confirmed! Flow works.');

    } catch (err) {
        console.error('Flow failed:', err.response?.data || err.message);
    }
}
testFlow();
