const axios = require('axios');

async function testUI() {
    try {
        console.log('Testing create request...');
        const res = await axios.post('http://localhost:3001/api/requests', {
            "uploaderEmail": "test-upload@example.com",
            "requestedFileTypes": "pdf",
            "expirationDays": "7",
            "secret": "pass"
        }, {
            headers: {
                'x-user-email': 'somp@outlook.com'
            }
        });
        console.log('Status:', res.status);
    } catch (err) {
        console.error('Error:', err.response?.status, err.response?.data || err.message);
    }
}
testUI();
