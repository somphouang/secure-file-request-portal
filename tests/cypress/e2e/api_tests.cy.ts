/// <reference types="cypress" />

describe('Backend E2E Flows', () => {
    const API_BASE_URL = Cypress.env('API_BASE_URL') || 'http://localhost:3001';

    it('Complete E2E Request and Upload Flow', () => {
        // 1. Create request
        cy.request({
            method: 'POST',
            url: `${API_BASE_URL}/api/requests`,
            headers: { 'x-user-email': 'somp@outlook.com' },
            body: {
                uploaderEmail: 'test-starter@example.com',
                requestedFileTypes: 'pdf,txt',
                expirationDays: "7",
                secret: 'pass'
            }
        }).then((response) => {
            expect(response.status).to.eq(200);
            const token = response.body.token;
            expect(token).to.exist;

            // 2. Validate secret
            cy.request({
                method: 'POST',
                url: `${API_BASE_URL}/api/public/requests/${token}/validate-secret`,
                body: { secret: 'pass' }
            }).then((valRes) => {
                expect(valRes.status).to.eq(200);

                // 3. Get SAS link
                cy.request({
                    method: 'POST',
                    url: `${API_BASE_URL}/api/public/requests/${token}/sas`,
                    body: { filename: 'test.txt', secret: 'pass' }
                }).then((sasRes) => {
                    expect(sasRes.status).to.eq(200);
                    const sasUrl = sasRes.body.url;
                    const blobName = sasRes.body.blobName;

                    // 4. Upload to blob via SAS
                    cy.request({
                        method: 'PUT',
                        url: sasUrl,
                        headers: {
                            'x-ms-blob-type': 'BlockBlob',
                            'Content-Type': 'text/plain'
                        },
                        body: 'test content'
                    }).then((uploadRes) => {
                        // Azure blob returns 201 Created on put
                        expect(uploadRes.status).to.be.oneOf([200, 201]);

                        // 5. Confirm upload
                        cy.request({
                            method: 'POST',
                            url: `${API_BASE_URL}/api/public/requests/${token}/confirm`,
                            body: { blobName: blobName }
                        }).then((confirmRes) => {
                            expect(confirmRes.status).to.eq(200);

                            // 6. Refresh List
                            cy.request({
                                method: 'GET',
                                url: `${API_BASE_URL}/api/requests`,
                                headers: { 'x-user-email': 'somp@outlook.com' }
                            }).then((listRes) => {
                                expect(listRes.status).to.eq(200);
                                const reqItem = listRes.body.find((r: any) => r.rowKey === token);
                                expect(reqItem).to.exist;
                            });
                        });
                    });
                });
            });
        });
    });

    it('UI Flow Creation Test', () => {
        cy.request({
            method: 'POST',
            url: `${API_BASE_URL}/api/requests`,
            headers: { 'x-user-email': 'somp@outlook.com' },
            body: {
                uploaderEmail: "test-upload@example.com",
                requestedFileTypes: "pdf",
                expirationDays: "7",
                secret: "pass"
            }
        }).then((res) => {
            expect(res.status).to.eq(200);
        });
    });
});
