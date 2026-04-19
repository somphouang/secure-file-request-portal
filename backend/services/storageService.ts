import * as azureBlobService from './azureBlobService.js';
import * as awsS3Service from './awsS3Service.js';

export const storageService = process.env.CLOUD_PROVIDER === 'AWS' 
    ? awsS3Service 
    : azureBlobService;
