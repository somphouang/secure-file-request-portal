const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');

const account = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'devstoreaccount1';
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
const containerName = process.env.AZURE_BLOB_CONTAINER_NAME || 'uploads';

const blobUrl = process.env.AZURE_BLOB_URL || `http://127.0.0.1:10000/${account}`;

const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);
const blobServiceClient = new BlobServiceClient(blobUrl, sharedKeyCredential);
const containerClient = blobServiceClient.getContainerClient(containerName);

async function initBlob() {
    try {
        await containerClient.createIfNotExists();
        console.log(`Blob container ${containerName} created or already exists.`);
    } catch (error) {
        console.error('Error creating blob container:', error);
    }
}

function generateUploadSasToken(blobName) {
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + 1); // Valid for 1 hour

    const sasOptions = {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("cw"), // create, write
        startsOn: new Date(),
        expiresOn: expiresOn,
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
    
    return {
        url: `${containerClient.getBlockBlobClient(blobName).url}?${sasToken}`,
        sasToken,
        blobName
    };
}

function generateDownloadSasToken(blobName) {
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + 1); // Valid for 1 hour

    const sasOptions = {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"), // read
        startsOn: new Date(),
        expiresOn: expiresOn,
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
    
    return `${containerClient.getBlockBlobClient(blobName).url}?${sasToken}`;
}

module.exports = {
    initBlob,
    generateUploadSasToken,
    generateDownloadSasToken
};
