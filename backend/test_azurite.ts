import { TableClient } from '@azure/data-tables';
import 'dotenv/config';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
const tableName = 'TestTable';

async function test() {
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
        console.log('Entity created successfully');

        const complexEntity = {
            partitionKey: 'complexPartition',
            rowKey: 'complexRow',
            email: 'test@example.com',
            date: new Date().toISOString(),
            num: 123
        };

        await client.createEntity(complexEntity);
        console.log('Complex entity created successfully');

    } catch (err: any) {
        console.error('Test failed:', JSON.stringify(err, null, 2));
    }
}

test();
