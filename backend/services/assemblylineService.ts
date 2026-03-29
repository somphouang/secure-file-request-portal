import { updateRequestStatus, getUploadRequest } from './azureTableService.js';
import { generateDownloadSasToken } from './azureBlobService.js';
import axios from 'axios';

const assemblylineUrl = process.env.ASSEMBLYLINE_URL || 'mock';

// Simulates submitting a file to Assemblyline and polling for results
export async function scanFile(requestorEmail: string, token: string, blobName: string): Promise<boolean> {
    if (assemblylineUrl === 'mock') {
        console.log(`[ASSEMBLYLINE] Mock scanning started for ${blobName} (token: ${token})`);
        
        let req = await getUploadRequest(requestorEmail, token);
        let statuses = req?.fileStatuses ? JSON.parse(req.fileStatuses) : {};
        statuses[blobName] = 'Scanning';

        // Update status to Scanning
        await updateRequestStatus(requestorEmail, token, { status: 'Scanning', fileStatuses: JSON.stringify(statuses) });

        // Simulate scan delay (10 seconds)
        setTimeout(async () => {
            // Randomly decide clean or malicious for mock (90% clean)
            const isClean = Math.random() > 0.1;
            const finalStatus = isClean ? 'Clean' : 'Malicious';
            
            req = await getUploadRequest(requestorEmail, token);
            statuses = req?.fileStatuses ? JSON.parse(req.fileStatuses) : {};
            statuses[blobName] = finalStatus;

            const anyMalicious = Object.values(statuses).includes('Malicious');
            const overallStatus = anyMalicious ? 'Malicious' : 'Clean';
            
            console.log(`[ASSEMBLYLINE] Mock scanning finished for ${blobName}. Result: ${finalStatus}`);
            await updateRequestStatus(requestorEmail, token, { status: overallStatus, fileStatuses: JSON.stringify(statuses) });
        }, 10000);

        return true;
    }

    // In a real implementation:
    try {
        const fileUrl = generateDownloadSasToken(blobName);
        console.log(`[ASSEMBLYLINE] Submitting to Assemblyline4: ${assemblylineUrl}`);
        
        let req = await getUploadRequest(requestorEmail, token);
        let statuses = req?.fileStatuses ? JSON.parse(req.fileStatuses) : {};
        statuses[blobName] = 'Scanning';
        await updateRequestStatus(requestorEmail, token, { status: 'Scanning', fileStatuses: JSON.stringify(statuses) });

        // Submit to Assemblyline V4 API using URL extraction
        const submitRes = await axios.post(`${assemblylineUrl}/api/v4/submit/`, {
            name: blobName,
            params: {
                description: `Scan for Upload Request ${token}`
            },
            url: fileUrl
        }, {
            headers: {
                'x-user': process.env.AL_USER || 'admin',
                'x-apikey': process.env.AL_APIKEY || 'dev-api-key',
            }
        });

        const sid = submitRes.data.api_response.sid;
        console.log(`[ASSEMBLYLINE] Submission successful. SID: ${sid}`);

        // Poll for result
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await axios.get(`${assemblylineUrl}/api/v4/submission/${sid}/`, {
                    headers: {
                        'x-user': process.env.AL_USER || 'admin',
                        'x-apikey': process.env.AL_APIKEY || 'dev-api-key',
                    }
                });
                
                if (statusRes.data.api_response.state === 'completed') {
                    clearInterval(pollInterval);
                    const isMalicious = statusRes.data.api_response.max_score >= 1000;
                    const finalStatus = isMalicious ? 'Malicious' : 'Clean';
                    
                    console.log(`[ASSEMBLYLINE] Real scan finished for ${blobName}. Result: ${finalStatus}`);
                    
                    req = await getUploadRequest(requestorEmail, token);
                    statuses = req?.fileStatuses ? JSON.parse(req.fileStatuses) : {};
                    statuses[blobName] = finalStatus;

                    const anyMalicious = Object.values(statuses).includes('Malicious');
                    const overallStatus = anyMalicious ? 'Malicious' : 'Clean';
                    
                    await updateRequestStatus(requestorEmail, token, { status: overallStatus, fileStatuses: JSON.stringify(statuses) });
                }
            } catch (err: any) {
                if (err.response?.status !== 404) {
                    console.error('AL Poll Error:', err.message);
                }
            }
        }, 5000);

        return true;
    } catch (e: any) {
        console.error('Real Assemblyline integration failed:', e.message);
        return false;
    }
}
