import axios from 'axios';
import * as crypto from 'crypto';

const account = 'devstoreaccount1';
const key = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

async function createContainer() {
    try {
        const d = new Date().toUTCString();
        const strToSign = `PUT\n\n\n0\n\n\n\n\n\n\n\n\nx-ms-date:${d}\nx-ms-version:2020-04-08\n/${account}/uploads\nrestype:container`;
        
        const sig = crypto.createHmac('sha256', Buffer.from(key, 'base64')).update(strToSign).digest('base64');
        const auth = `SharedKey ${account}:${sig}`;

        await axios.put(`http://127.0.0.1:10000/${account}/uploads?restype=container`, null, {
            headers: {
                'x-ms-date': d,
                'x-ms-version': '2020-04-08',
                'Authorization': auth,
                'Content-Length': '0'
            }
        });
        console.log('Container created');
    } catch (e) {
        if (e.response?.status === 409) console.log('Container already exists');
        else console.error('Error:', e.response?.data || e.message);
    }
}
createContainer();
