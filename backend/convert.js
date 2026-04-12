const fs = require('fs');
const jsFiles = ['check_list.js', 'createContainer.js', 'forceCreateContainer.js', 'test_api.js', 'test_azurite.js', 'test_azurite_failing.js', 'test_e2e.js', 'test_flow.js', 'test_ui.js'];

jsFiles.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');

        // Convert single quotes holding http://localhost:3001 to backticks
        content = content.replace(/'http:\/\/localhost:3001(.*?)'/g, '`http://localhost:3001$1`');

        // Replace the string
        let replacement = '${process.env.API_BASE_URL || "http://localhost:3001"}';
        content = content.replace(/http:\/\/localhost:3001/g, replacement);

        // Imports
        content = content.replace(/(const|let|var) axios = require\('axios'\);/g, "import axios from 'axios';");
        content = content.replace(/(const|let|var) fs = require\('fs'\);/g, "import * as fs from 'fs';");
        content = content.replace(/(const|let|var) path = require\('path'\);/g, "import * as path from 'path';");
        content = content.replace(/(const|let|var) crypto = require\('crypto'\);/g, "import * as crypto from 'crypto';");
        content = content.replace(/const \{ BlobServiceClient, StorageSharedKeyCredential \} = require\("@azure\/storage-blob"\);/g, "import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';");

        fs.writeFileSync(file.replace('.js', '.ts'), content);
        fs.unlinkSync(file);
    }
});
