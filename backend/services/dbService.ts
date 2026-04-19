import * as azureTableService from './azureTableService.js';
import * as awsDynamoDbService from './awsDynamoDbService.js';

export const dbService = process.env.CLOUD_PROVIDER === 'AWS' 
    ? awsDynamoDbService 
    : azureTableService;
