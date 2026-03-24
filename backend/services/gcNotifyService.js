const axios = require('axios');

const gcNotifyApiKey = process.env.GCNOTIFY_API_KEY || 'mock-api-key';
const templateId = process.env.GCNOTIFY_TEMPLATE_ID || 'mock-template-id';

async function sendUploadRequestEmail(uploaderEmail, requestorEmail, uploadLink) {
    if (gcNotifyApiKey === 'mock-api-key') {
        console.log('----------------------------------------------------');
        console.log(`[MOCK EMAIL SENT VIA GCNOTIFY]`);
        console.log(`To: ${uploaderEmail}`);
        console.log(`From: ${requestorEmail}`);
        console.log(`Link: ${uploadLink}`);
        console.log('----------------------------------------------------');
        return true;
    }

    try {
        const response = await axios.post(
            'https://api.notification.canada.ca/v2/notifications/email',
            {
                email_address: uploaderEmail,
                template_id: templateId,
                personalisation: {
                    requestor: requestorEmail,
                    upload_link: uploadLink
                }
            },
            {
                headers: {
                    'Authorization': `ApiKey-v1 ${gcNotifyApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error sending GCNotify email:', error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    sendUploadRequestEmail
};
