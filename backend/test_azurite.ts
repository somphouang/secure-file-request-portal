const { TableClient } = require('@azure/data-tables');
require('dotenv').config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
const tableName = 'TestTableJS';

async function test() {
    console.log('Using connection string:', connectionString);
    const client = TableClient.fromConnectionString(connectionString, tableName, {
        allowInsecureConnection: true
    });

    try {
        await client.createTable();
        console.log('Table created or exists');

        const entity = {
            partitionKey: 'testPartition',
            rowKey: 'testRow',
            testProp: 'hello'
        };

        await client.createEntity(entity);
        console.log('Simple entity created successfully');

        const complexEntity = {
            partitionKey: 'complexPartition',
            rowKey: 'complexRow',
            email: 'test@example.com',
            date: new Date(),
            num: 123
        };

        await client.createEntity(complexEntity);
        console.log('Complex entity created successfully');

    } catch (err) {
        console.error('Test failed:', JSON.stringify(err, null, 2));
    }
}

test();
