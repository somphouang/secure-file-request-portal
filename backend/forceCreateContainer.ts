import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

const account = 'devstoreaccount1';
const accountKey = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

// Monkey patch the API version in the request pipeline
const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);
const pipeline = require("@azure/core-rest-pipeline").createPipelineFromOptions({});
pipeline.addPolicy({
    name: 'SetApiVersion',
    sendRequest: (req, next) => {
        req.headers.set("x-ms-version", "2020-04-08"); // Old version supported by azurite by default
        return next(req);
    }
}, { phase: 'Sign' }); // Ensure it's signed after header is set? Wait, Signed handles all headers. Let's do phase 'Serialize'.

async function createC() {
    const defaultPipeline = require("@azure/storage-blob").newPipeline(sharedKeyCredential);
    defaultPipeline.addPolicy({
        name: 'ApiVersionDowngrade',
        sendRequest: (req, next) => {
            req.headers.set("x-ms-version", "2020-04-08");
            return next(req);
        }
    }, { phase: 'Serialize' });

    const client = new BlobServiceClient("http://127.0.0.1:10000/devstoreaccount1", defaultPipeline);
    const container = client.getContainerClient("uploads");
    try {
        await container.createIfNotExists();
        console.log("Container 'uploads' created successfully!");
    } catch (e) {
        console.error("Failed:", e.message);
    }
}
createC();
