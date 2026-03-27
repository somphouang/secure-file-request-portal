const axios = require('axios');

async function test() {
    try {
        console.log('Testing create request...');
        const res = await axios.post('http://localhost:3001/api/requests', {
            uploaderEmail: 'test@example.com',
            requestedFileTypes: 'pdf,txt',
            expirationDays: 7,
            secret: 'testpass123'
        }, {
            headers: {
                'x-user-email': 'somp@outlook.com'
            }
        });
        console.log('Create Request Status:', res.status);
        console.log('Create Request Data:', res.data);
    } catch (err) {
        console.error('Error creating request:', err.response?.status, err.response?.data || err.message);
    }
}
test();
