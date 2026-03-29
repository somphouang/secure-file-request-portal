import { TableClient, AzureNamedKeyCredential, TableEntityResult, TableEntity } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
const tableName = process.env.AZURE_TABLE_NAME || 'UploadRequests';

const tableClient = TableClient.fromConnectionString(connectionString, tableName, {
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
    fileStatuses?: string;
    isClosed?: boolean;
}

export type UploadRequest = TableEntity<UploadRequestRecord>;

export async function initTable(): Promise<void> {
    try {
        await tableClient.createTable();
        console.log(`Table ${tableName} created or already exists.`);
    } catch (error: any) {
        if (error.statusCode !== 409) {
            console.error('Error creating table:', error);
        }
    }
}

export async function createUploadRequest(
    requestorEmail: string, 
    uploaderEmail: string, 
    requestedFileTypes: string, 
    secretHash?: string, 
    expirationDays: number = 7,
    allowMultiple: boolean = false
): Promise<Partial<UploadRequest>> {
    const token = uuidv4();
    const entity: any = {
        partitionKey: requestorEmail,
        rowKey: token,
        uploaderEmail,
        requestedFileTypes,
        status: 'Pending',
        secretHash: secretHash || '',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (expirationDays * 24 * 60 * 60 * 1000)),
        allowMultiple
    };
    
    console.log('Inserting entity:', JSON.stringify(entity, null, 2));

    try {
        await tableClient.createEntity(entity);
    } catch (error: any) {
        console.error('Error in createEntity:', JSON.stringify(error, null, 2));
        throw error;
    }
    return entity;
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
