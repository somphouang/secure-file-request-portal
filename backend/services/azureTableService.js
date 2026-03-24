const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');
const { v4: uuidv4 } = require('uuid');

const account = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'devstoreaccount1';
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
const tableName = process.env.AZURE_TABLE_NAME || 'UploadRequests';

// Use emulator by default if not specified
const tableUrl = process.env.AZURE_TABLE_URL || `http://127.0.0.1:10002/${account}`;

const credential = new AzureNamedKeyCredential(account, accountKey);
const tableClient = new TableClient(tableUrl, tableName, credential);

async function initTable() {
    try {
        await tableClient.createTable();
        console.log(`Table ${tableName} created or already exists.`);
    } catch (error) {
        if (error.statusCode !== 409) {
            console.error('Error creating table:', error);
        }
    }
}

async function createUploadRequest(requestorEmail, uploaderEmail, requestedFileTypes, secretHash, expirationDays = 7) {
    const token = uuidv4();
    const entity = {
        partitionKey: requestorEmail,
        rowKey: token,
        uploaderEmail,
        requestedFileTypes,
        status: 'Pending',
        secretHash: secretHash || '',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (expirationDays * 24 * 60 * 60 * 1000))
    };
    
    await tableClient.createEntity(entity);
    return entity;
}

async function getUploadRequest(requestorEmail, token) {
    try {
        return await tableClient.getEntity(requestorEmail, token);
    } catch (e) {
        return null;
    }
}

async function getRequestByTokenOnly(token) {
    // Queries all partitions. In production with large data, a separate mapping table might be better, or partition key could be derived.
    const entities = tableClient.listEntities({
        queryOptions: { filter: `RowKey eq '${token}'` }
    });
    
    for await (const entity of entities) {
        return entity;
    }
    return null;
}

async function updateRequestStatus(requestorEmail, token, updates) {
    try {
        const entity = await tableClient.getEntity(requestorEmail, token);
        const updatedEntity = { ...entity, ...updates };
        await tableClient.updateEntity(updatedEntity, 'Merge');
        return updatedEntity;
    } catch (error) {
        console.error('Error updating entity:', error);
        throw error;
    }
}

async function getRequestsByRequestor(requestorEmail) {
    const requests = [];
    const entities = tableClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${requestorEmail}'` }
    });
    for await (const entity of entities) {
        requests.push(entity);
    }
    return requests;
}

module.exports = {
    initTable,
    createUploadRequest,
    getUploadRequest,
    getRequestByTokenOnly,
    updateRequestStatus,
    getRequestsByRequestor
};
