import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'uploads-bucket';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

const s3Client = new S3Client({
    region,
    ...(process.env.AWS_ENDPOINT_URL 
        ? { 
            endpoint: process.env.AWS_ENDPOINT_URL, 
            forcePathStyle: true,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
            }
          } 
        : {})
});

export async function initBlob(): Promise<void> {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log(`S3 bucket ${bucketName} already exists.`);
    } catch (err: any) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
            try {
                await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
                console.log(`S3 bucket ${bucketName} created.`);
            } catch (err2: any) {
                console.error(`Error creating S3 bucket: ${err2.message}`);
            }
        } else {
            console.error(`Error checking S3 bucket: ${err.message}`, err);
        }
    }

    try {
        // Set CORS rules to allow the browser to PUT blobs directly
        await s3Client.send(new PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ['*'],
                        AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
                        AllowedOrigins: [frontendUrl],
                        ExposeHeaders: ['ETag'],
                        MaxAgeSeconds: 3600
                    }
                ]
            }
        }));
        console.log('CORS properties set for S3 Bucket.');
    } catch (err: any) {
        console.error(`Error setting CORS on S3 Bucket: ${err.message}`, err);
    }
}

export async function generateUploadSasToken(blobName: string) {
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: blobName
    });

    // Valid for 1 hour
    const sasTokenStr = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Extracted exactly like azure format to conform to existing frontend needs
    return {
        url: sasTokenStr, // The presigned URL includes everything needed to PUT
        sasToken: "presigned", // Not used exactly the same but maintained for schema matching
        blobName,
        cloudProvider: 'AWS'
    };
}

export async function generateDownloadSasToken(blobName: string) {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: blobName
    });

    // Valid for 1 hour
    const sasTokenStr = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    return sasTokenStr;
}
