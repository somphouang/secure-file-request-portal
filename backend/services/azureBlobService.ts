import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
const containerName = process.env.AZURE_BLOB_CONTAINER_NAME || 'uploads';

const account = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'devstoreaccount1';
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString, {
    retryOptions: { maxTries: 3 },
    // Use an older API version for Azurite compatibility
    // @ts-ignore
    serviceVersion: '2023-11-03'
});
const containerClient = blobServiceClient.getContainerClient(containerName);

export async function initBlob(): Promise<void> {
    try {
        await containerClient.createIfNotExists();
        console.log(`Blob container ${containerName} created or already exists.`);
    } catch (err: any) {
        if (err.message && err.message.includes('not supported by Azurite')) {
            console.warn(`Warning: Azurite API version error ignored during local dev init for container ${containerName}. Ensure you ran Azurite with --skipApiVersionCheck`);
        } else {
            console.error(`Error creating blob container: ${err.message}`, err);
            throw err;
        }
    }
}

export function generateUploadSasToken(blobName: string) {
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

export function generateDownloadSasToken(blobName: string) {
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
