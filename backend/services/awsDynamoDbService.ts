import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { UploadRequestRecord, DownloadShareRecord } from './azureTableService.js';

const region = process.env.AWS_REGION || 'us-east-1';
const uploadRequestsTableName = process.env.AWS_DYNAMODB_TABLE_NAME || 'UploadRequests';
const downloadSharesTableName = process.env.AWS_DYNAMODB_SHARE_TABLE_NAME || 'DownloadShares';

const ddbClient = new DynamoDBClient({
    region,
    ...(process.env.AWS_ENDPOINT_URL 
        ? { 
            endpoint: process.env.AWS_ENDPOINT_URL,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
            }
          } 
        : {})
});

const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export async function initTable(): Promise<void> {
    const createTableIfNotExists = async (tableName: string) => {
        try {
            await ddbClient.send(new DescribeTableCommand({ TableName: tableName }));
            console.log(`DynamoDB Table ${tableName} already exists.`);
        } catch (error: any) {
            if (error.name === 'ResourceNotFoundException') {
                try {
                    await ddbClient.send(new CreateTableCommand({
                        TableName: tableName,
                        AttributeDefinitions: [
                            { AttributeName: 'partitionKey', AttributeType: 'S' },
                            { AttributeName: 'rowKey', AttributeType: 'S' }
                        ],
                        KeySchema: [
                            { AttributeName: 'partitionKey', KeyType: 'HASH' },
                            { AttributeName: 'rowKey', KeyType: 'RANGE' }
                        ],
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    }));
                    console.log(`DynamoDB Table ${tableName} created.`);
                } catch (err2: any) {
                    console.error(`Error creating DynamoDB table ${tableName}:`, err2);
                }
            } else {
                console.error(`Error describing DynamoDB table ${tableName}:`, error);
            }
        }
    };

    await createTableIfNotExists(uploadRequestsTableName);
    await createTableIfNotExists(downloadSharesTableName);
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
): Promise<any> {
    const token = uuidv4();
    const requestNumber = generateRequestNumber();
    const entity: any = {
        partitionKey: requestorEmail,
        rowKey: token,
        uploaderEmail,
        requestedFileTypes,
        status: 'Pending',
        secretHash: secretHash || '',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (expirationDays * 24 * 60 * 60 * 1000)).toISOString(),
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
    
    await ddbDocClient.send(new PutCommand({
        TableName: uploadRequestsTableName,
        Item: entity
    }));
    
    return entity;
}

export async function getAllUploadRequests(): Promise<any[]> {
    const result = await ddbDocClient.send(new ScanCommand({
        TableName: uploadRequestsTableName
    }));
    return result.Items || [];
}

export async function getUploadRequest(requestorEmail: string, token: string): Promise<any | null> {
    const result = await ddbDocClient.send(new GetCommand({
        TableName: uploadRequestsTableName,
        Key: { partitionKey: requestorEmail, rowKey: token }
    }));
    return result.Item || null;
}

export async function getRequestByTokenOnly(token: string): Promise<any | null> {
    // Note: DDB scan is less efficient without an index, but kept for compatibility.
    const result = await ddbDocClient.send(new ScanCommand({
        TableName: uploadRequestsTableName,
        FilterExpression: 'rowKey = :token',
        ExpressionAttributeValues: { ':token': token }
    }));
    return result.Items?.[0] || null;
}

export async function updateRequestStatus(requestorEmail: string, token: string, updates: any): Promise<any> {
    // Simplistic merge: fetch, update, put
    const item = await getUploadRequest(requestorEmail, token);
    if (!item) throw new Error('Not found');
    
    // Fix dates if passing Date objects
    const formattedUpdates = { ...updates };
    for (const [k, v] of Object.entries(formattedUpdates)) {
        if (v instanceof Date) formattedUpdates[k] = v.toISOString();
    }
    
    const updated = { ...item, ...formattedUpdates };
    await ddbDocClient.send(new PutCommand({
        TableName: uploadRequestsTableName,
        Item: updated
    }));
    return updated;
}

export async function getRequestsByRequestor(requestorEmail: string): Promise<any[]> {
    const result = await ddbDocClient.send(new QueryCommand({
        TableName: uploadRequestsTableName,
        KeyConditionExpression: 'partitionKey = :pk',
        ExpressionAttributeValues: { ':pk': requestorEmail }
    }));
    return result.Items || [];
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
): Promise<any> {
    const requestNumber = generateRequestNumber();
    const entity: any = {
        partitionKey: requestorEmail,
        rowKey: token,
        status: blobUri ? 'Ready' : 'Pending',
        originalFilename,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (expirationDays * 24 * 60 * 60 * 1000)).toISOString(),
        requestNumber,
        caseNumber: manualCaseNumber || '',
        identifierName: identifierName || '',
        identifierValue: identifierValue || '',
        jsonMetadata: jsonMetadata || ''
    };
    if (blobUri) {
        entity.blobUri = blobUri;
    }

    await ddbDocClient.send(new PutCommand({
        TableName: downloadSharesTableName,
        Item: entity
    }));
    return entity;
}

export async function getDownloadShare(requestorEmail: string, token: string): Promise<any | null> {
    const result = await ddbDocClient.send(new GetCommand({
        TableName: downloadSharesTableName,
        Key: { partitionKey: requestorEmail, rowKey: token }
    }));
    return result.Item || null;
}

export async function updateDownloadShare(requestorEmail: string, token: string, updates: any): Promise<any> {
    const item = await getDownloadShare(requestorEmail, token);
    if (!item) throw new Error('Not found');
    
    const formattedUpdates = { ...updates };
    for (const [k, v] of Object.entries(formattedUpdates)) {
        if (v instanceof Date) formattedUpdates[k] = v.toISOString();
    }
    
    const updated = { ...item, ...formattedUpdates };
    await ddbDocClient.send(new PutCommand({
        TableName: downloadSharesTableName,
        Item: updated
    }));
    return updated;
}

export async function getDownloadSharesByRequestor(requestorEmail: string): Promise<any[]> {
    const result = await ddbDocClient.send(new QueryCommand({
        TableName: downloadSharesTableName,
        KeyConditionExpression: 'partitionKey = :pk',
        ExpressionAttributeValues: { ':pk': requestorEmail }
    }));
    return result.Items || [];
}

export async function getDownloadShareByToken(token: string): Promise<any | null> {
    const result = await ddbDocClient.send(new ScanCommand({
        TableName: downloadSharesTableName,
        FilterExpression: 'rowKey = :token',
        ExpressionAttributeValues: { ':token': token }
    }));
    return result.Items?.[0] || null;
}
