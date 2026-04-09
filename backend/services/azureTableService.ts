import { TableClient, AzureNamedKeyCredential, TableEntityResult, TableEntity } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
const tableName = process.env.AZURE_TABLE_NAME || 'UploadRequests';

const tableClient = TableClient.fromConnectionString(connectionString, tableName, {
    allowInsecureConnection: true
});

const shareTableName = process.env.AZURE_SHARE_TABLE_NAME || 'DownloadShares';

const shareTableClient = TableClient.fromConnectionString(connectionString, shareTableName, {
    allowInsecureConnection: true
});

export interface UploadRequestRecord {
    uploaderEmail: string;
    requestedFileTypes: string;
    status: string;
    secretHash: string;
    createdAt: Date;
    expiresAt: Date;
    blobUri?: string;
    fileHash?: string;
    allowMultiple?: boolean;
    maxFileSize?: number;
    fileStatuses?: string;
    isClosed?: boolean;
    downloaderEmail?: string;
    downloadSecretHash?: string;
    requestNumber: string;
    caseNumber?: string;
    sharedForDownload?: boolean;
    downloadCompletedAt?: Date;
    requestorGroups?: string;
    last2faSentAt?: Date;
    identifierName?: string;
    identifierValue?: string;
    jsonMetadata?: string;
}

export interface DownloadShareRecord {
    status: string;
    blobUri?: string;
    originalFilename: string;
    createdAt: Date;
    expiresAt: Date;
    downloadSecretHash?: string;
    downloaderEmail?: string;
    requestNumber: string;
    caseNumber?: string;
    downloadCompletedAt?: Date;
    last2faSentAt?: Date;
    identifierName?: string;
    identifierValue?: string;
    jsonMetadata?: string;
}

export type UploadRequest = TableEntity<UploadRequestRecord>;
export type DownloadShare = TableEntity<DownloadShareRecord>;

export async function initTable(): Promise<void> {
    try {
        await tableClient.createTable();
        console.log(`Table ${tableName} created or already exists.`);
    } catch (error: any) {
        if (error.statusCode !== 409) {
            console.error('Error creating table:', error);
        }
    }

    try {
        await shareTableClient.createTable();
        console.log(`Table ${shareTableName} created or already exists.`);
    } catch (error: any) {
        if (error.statusCode !== 409) {
            console.error('Error creating share table:', error);
        }
    }
}

export function generateRequestNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `RQ-${timestamp}${random}`.substring(0, 16);
}

export async function createUploadRequest(
    requestorEmail: string, 
    uploaderEmail: string, 
    requestedFileTypes: string, 
    secretHash?: string, 
    expirationDays: number = 7,
    allowMultiple: boolean = false,
    maxFileSize: number = 50,
    manualCaseNumber?: string,
    requestorGroups?: string,
    identifierName?: string,
    identifierValue?: string,
    jsonMetadata?: string
): Promise<Partial<UploadRequest>> {
    const token = uuidv4();
    const requestNumber = generateRequestNumber();
    const entity: any = {
        partitionKey: requestorEmail,
        rowKey: token,
        uploaderEmail,
        requestedFileTypes,
        status: 'Pending',
        secretHash: secretHash || '',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (expirationDays * 24 * 60 * 60 * 1000)),
        allowMultiple,
        maxFileSize,
        requestNumber,
        caseNumber: manualCaseNumber || '',
        identifierName: identifierName || '',
        identifierValue: identifierValue || '',
        jsonMetadata: jsonMetadata || ''
    };
    if (requestorGroups) {
        entity.requestorGroups = requestorGroups;
    }
    
    console.log('Inserting entity:', JSON.stringify(entity, null, 2));

    try {
        await tableClient.createEntity(entity);
    } catch (error: any) {
        console.error('Error in createEntity:', JSON.stringify(error, null, 2));
        throw error;
    }
    return entity;
}

export async function getAllUploadRequests(): Promise<UploadRequest[]> {
    const requests: UploadRequest[] = [];
    const entities = tableClient.listEntities<UploadRequest>();
    for await (const entity of entities) {
        requests.push(entity);
    }
    return requests;
}

export async function getUploadRequest(requestorEmail: string, token: string): Promise<UploadRequest | null> {
    try {
        return await tableClient.getEntity<UploadRequest>(requestorEmail, token);
    } catch (e) {
        return null;
    }
}

export async function getRequestByTokenOnly(token: string): Promise<UploadRequest | null> {
    const entities = tableClient.listEntities<UploadRequest>({
        queryOptions: { filter: `RowKey eq '${token}'` }
    });
    
    for await (const entity of entities) {
        return entity;
    }
    return null;
}

export async function updateRequestStatus(requestorEmail: string, token: string, updates: Partial<UploadRequest>): Promise<UploadRequest> {
    try {
        const entity = await tableClient.getEntity<UploadRequest>(requestorEmail, token);
        const updatedEntity = { ...entity, ...updates };
        await tableClient.updateEntity(updatedEntity, 'Merge');
        return updatedEntity;
    } catch (error) {
        console.error('Error updating entity:', error);
        throw error;
    }
}

export async function getRequestsByRequestor(requestorEmail: string): Promise<UploadRequest[]> {
    const requests: UploadRequest[] = [];
    const entities = tableClient.listEntities<UploadRequest>({
        queryOptions: { filter: `PartitionKey eq '${requestorEmail}'` }
    });
    for await (const entity of entities) {
        requests.push(entity);
    }
    return requests;
}

export async function createDownloadShare(
    requestorEmail: string,
    token: string,
    blobName: string,
    originalFilename: string,
    expirationDays: number = 7,
    manualCaseNumber?: string,
    blobUri?: string,
    identifierName?: string,
    identifierValue?: string,
    jsonMetadata?: string
): Promise<Partial<DownloadShare>> {
    const requestNumber = generateRequestNumber();
    const entity: any = {
        partitionKey: requestorEmail,
        rowKey: token,
        status: blobUri ? 'Ready' : 'Pending',
        originalFilename,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (expirationDays * 24 * 60 * 60 * 1000)),
        requestNumber,
        caseNumber: manualCaseNumber || '',
        identifierName: identifierName || '',
        identifierValue: identifierValue || '',
        jsonMetadata: jsonMetadata || ''
    };
    if (blobUri) {
        entity.blobUri = blobUri;
    }

    try {
        await shareTableClient.createEntity(entity);
        return entity;
    } catch (error: any) {
        console.error('Error creating share entity:', error);
        throw error;
    }
}

export async function getDownloadShare(requestorEmail: string, token: string): Promise<DownloadShare | null> {
    try {
        return await shareTableClient.getEntity<DownloadShare>(requestorEmail, token);
    } catch (e) {
        return null;
    }
}

export async function updateDownloadShare(requestorEmail: string, token: string, updates: Partial<DownloadShare>): Promise<DownloadShare> {
    try {
        const entity = await shareTableClient.getEntity<DownloadShare>(requestorEmail, token);
        const updatedEntity = { ...entity, ...updates };
        await shareTableClient.updateEntity(updatedEntity, 'Merge');
        return updatedEntity;
    } catch (error) {
        console.error('Error updating share entity:', error);
        throw error;
    }
}

export async function getDownloadSharesByRequestor(requestorEmail: string): Promise<DownloadShare[]> {
    const shares: DownloadShare[] = [];
    const entities = shareTableClient.listEntities<DownloadShare>({
        queryOptions: { filter: `PartitionKey eq '${requestorEmail}'` }
    });
    for await (const entity of entities) {
        shares.push(entity);
    }
    return shares;
}

export async function getDownloadShareByToken(token: string): Promise<DownloadShare | null> {
    const entities = shareTableClient.listEntities<DownloadShare>({
        queryOptions: { filter: `RowKey eq '${token}'` }
    });
    
    for await (const entity of entities) {
        return entity;
    }
    return null;
}

