const axios = require('axios');

async function checkList() {
    try {
        console.log('Fetching active requests for somp@outlook.com...');
        const res = await axios.get('http://localhost:3001/api/requests', {
            headers: { 'x-user-email': 'somp@outlook.com' }
        });
        console.log('Active Requests List:');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Error fetching list:', err.message);
    }
}
checkList();
