const { TableClient } = require('@azure/data-tables');
require('dotenv').config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
const tableName = 'TestTableFailing';

async function test() {
    const client = TableClient.fromConnectionString(connectionString, tableName, {
        allowInsecureConnection: true
    });

    try {
        await client.createTable();
        
        const failingEntity = {
            partitionKey: "somp@outlook.com",
            rowKey: "test-token-uuid",
            uploaderEmail: "test@example.com",
            requestedFileTypes: "pdf,xlsx",
            status: "Pending",
            secretHash: "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789abcdefghijk",
            createdAt: new Date(),
            expiresAt: new Date()
        };

        console.log('Inserting failing entity candidate...');
        await client.createEntity(failingEntity);
        console.log('Success! The entity itself is fine.');

    } catch (err) {
        console.error('Test failed:', JSON.stringify(err, null, 2));
    }
}

test();
