import axios from 'axios';
import nodemailer from 'nodemailer';

const gcNotifyApiKey = process.env.GCNOTIFY_API_KEY || 'mock-api-key';
const templateId = process.env.GCNOTIFY_TEMPLATE_ID || 'mock-template-id';

// Mailer Config from .env
const mailerEnabled = process.env.MAILER_ENABLED === 'true';
const smtpAddr = process.env.MAILER_SMTP_ADDR || '';
const smtpPort = parseInt(process.env.MAILER_SMTP_PORT || '587', 10);
const mailerFrom = process.env.MAILER_FROM || '';
const mailerUser = process.env.MAILER_USER || '';
const mailerPasswd = process.env.MAILER_PASSWD || '';

export async function sendUploadRequestEmail(uploaderEmail: string, requestorEmail: string, uploadLink: string, allowMultiple?: boolean, requestNumber?: string, caseNumber?: string): Promise<any> {
    const subject = `Secure File Request from ${requestorEmail}${requestNumber ? ` [${requestNumber}]` : ''}${caseNumber ? ` [${caseNumber}]` : ''}`;
    let text = `You have been asked to upload a file by\n${requestorEmail}\n`;
    if (requestNumber) text += `\nRequest Number: ${requestNumber}\n`;
    if (caseNumber) text += `\nCase Number: ${caseNumber}\n`;
    text += `\nPlease use the following link to upload:\n${uploadLink}\n`;
    let html = `<p>You have been asked to upload a file by<br><strong>${requestorEmail}</strong></p>`;
    if (requestNumber) html += `<p>Request Number: <strong>${requestNumber}</strong></p>`;
    if (caseNumber) html += `<p>Case Number: <strong>${caseNumber}</strong></p>`;
    html += `<p>Please use the following link to upload:<br><a href="${uploadLink}">${uploadLink}</a></p>`;

    // French implementation
    text += `\n---\n\nVous avez été invité à télécharger un fichier par\n${requestorEmail}\n\nVeuillez utiliser le lien suivant pour le téléchargement :\n${uploadLink}\n`;
    html += `<hr><p>Vous avez été invité à télécharger un fichier par<br><strong>${requestorEmail}</strong></p>
             <p>Veuillez utiliser le lien suivant pour le téléchargement :<br><a href="${uploadLink}">${uploadLink}</a></p>`;

    if (allowMultiple) {
        text += `\nNote: You are allowed to upload multiple files for this request.\n`;
        text += `Remarque : Vous êtes autorisé à télécharger plusieurs fichiers pour cette demande.\n`;
        html += `<p><em>Note: You are allowed to upload multiple files for this request.</em></p>`;
        html += `<p><em>Remarque : Vous êtes autorisé à télécharger plusieurs fichiers pour cette demande.</em></p>`;
    }

    if (mailerEnabled) {
        // Send to the specified uploader email
        const targetEmail = uploaderEmail;

        const transporter = nodemailer.createTransport({
            host: smtpAddr,
            port: smtpPort,
            secure: smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: mailerUser,
                pass: mailerPasswd,
            },
        });

        try {
            const info = await transporter.sendMail({
                from: mailerFrom,
                to: targetEmail, // Sending to uploaderEmail properly
                subject: subject,
                text: text,
                html: html,
            });
            console.log(`[SMTP EMAIL SENT] Message ID: ${info.messageId} to ${targetEmail}`);
            return true;
        } catch (error: any) {
            console.error('Error sending SMTP email:', error);
            throw error;
        }
    }

    if (gcNotifyApiKey === 'mock-api-key') {
        console.log('----------------------------------------------------');
        console.log(`[MOCK EMAIL SENT VIA GCNOTIFY]`);
        console.log(`To: ${uploaderEmail}`);
        console.log(`From: ${requestorEmail}`);
        console.log(`Link: ${uploadLink}`);
        console.log('----------------------------------------------------');
        return true;
    }

    try {
        const response = await axios.post(
            'https://api.notification.canada.ca/v2/notifications/email',
            {
                email_address: uploaderEmail,
                template_id: templateId,
                personalisation: {
                    requestor: requestorEmail,
                    upload_link: uploadLink,
                    passcode: '',
                    passcode_en: '',
                    passcode_fr: '',
                    allow_multiple_en: allowMultiple ? 'Note: You are allowed to upload multiple files for this request.' : '',
                    allow_multiple_fr: allowMultiple ? 'Remarque : Vous êtes autorisé à télécharger plusieurs fichiers pour cette demande.' : '',
                    message: text // the full bilingual message inside one variable in case the template uses 'message'
                }
            },
            {
                headers: {
                    'Authorization': `ApiKey-v1 ${gcNotifyApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error('Error sending GCNotify email:', error.response?.data || error.message);
        throw error;
    }
}

export async function sendDownloadRequestEmail(downloaderEmail: string, requestorEmail: string, downloadLink: string, requestNumber?: string, caseNumber?: string): Promise<any> {
    const subject = `Secure Download link from ${requestorEmail}${requestNumber ? ` [${requestNumber}]` : ''}${caseNumber ? ` [${caseNumber}]` : ''}`;
    let text = `You have been authorized to download a file by\n${requestorEmail}\n`;
    if (requestNumber) text += `\nRequest Number: ${requestNumber}\n`;
    if (caseNumber) text += `\nCase Number: ${caseNumber}\n`;
    text += `\nPlease use the following link to download:\n${downloadLink}\n`;
    let html = `<p>You have been authorized to download a file by<br><strong>${requestorEmail}</strong></p>`;
    if (requestNumber) html += `<p>Request Number: <strong>${requestNumber}</strong></p>`;
    if (caseNumber) html += `<p>Case Number: <strong>${caseNumber}</strong></p>`;
    html += `<p>Please use the following link to download:<br><a href="${downloadLink}">${downloadLink}</a></p>`;

    // French translation
    text += `\n---\n\nVous êtes autorisé à télécharger un fichier par\n${requestorEmail}\n\nVeuillez utiliser le lien suivant pour télécharger :\n${downloadLink}\n`;
    html += `<hr><p>Vous êtes autorisé à télécharger un fichier par<br><strong>${requestorEmail}</strong></p>
             <p>Veuillez utiliser le lien suivant pour télécharger :<br><a href="${downloadLink}">${downloadLink}</a></p>`;

    if (mailerEnabled) {
        const transporter = nodemailer.createTransport({
            host: smtpAddr,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: mailerUser,
                pass: mailerPasswd,
            },
        });

        try {
            const info = await transporter.sendMail({
                from: mailerFrom,
                to: downloaderEmail,
                subject: subject,
                text: text,
                html: html,
            });
            console.log(`[SMTP DOWNLOAD EMAIL SENT] Message ID: ${info.messageId} to ${downloaderEmail}`);
            return true;
        } catch (error: any) {
            console.error('Error sending SMTP download email:', error);
            throw error;
        }
    }

    if (gcNotifyApiKey === 'mock-api-key') {
        console.log('----------------------------------------------------');
        console.log('[MOCK EMAIL SENT VIA GCNOTIFY]');
        console.log(`To: ${downloaderEmail}`);
        console.log(`From: ${requestorEmail}`);
        console.log(`Download Link: ${downloadLink}`);
        console.log('----------------------------------------------------');
        return true;
    }

    try {
        const response = await axios.post(
            'https://api.notification.canada.ca/v2/notifications/email',
            {
                email_address: downloaderEmail,
                template_id: templateId,
                personalisation: {
                    requestor: requestorEmail,
                    download_link: downloadLink,
                    passcode: '',
                    passcode_en: '',
                    passcode_fr: '',
                    message: text
                }
            },
            {
                headers: {
                    'Authorization': `ApiKey-v1 ${gcNotifyApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error('Error sending GCNotify download email:', error.response?.data || error.message);
        throw error;
    }
}

export async function send2faEmail(targetEmail: string, passcode: string, requestNumber?: string, caseNumber?: string): Promise<any> {
    const subject = `Your One-Time Passcode${requestNumber ? ` [${requestNumber}]` : ''}${caseNumber ? ` [${caseNumber}]` : ''}`;
    let text = `Your secure passcode is:\n${passcode}\n\nThis code will expire shortly.\n`;
    let html = `<p>Your secure passcode is:<br><strong style="font-size:1.5em; letter-spacing:2px;">${passcode}</strong></p>
                <p>This code will expire shortly.</p>`;

    // French translation
    text += `\n---\n\nVotre code d'accès sécurisé est :\n${passcode}\n\nCe code expirera sous peu.\n`;
    html += `<hr><p>Votre code d'accès sécurisé est :<br><strong style="font-size:1.5em; letter-spacing:2px;">${passcode}</strong></p>
             <p>Ce code expirera sous peu.</p>`;

    if (mailerEnabled) {
        const transporter = nodemailer.createTransport({
            host: smtpAddr,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: mailerUser,
                pass: mailerPasswd,
            },
        });

        try {
            const info = await transporter.sendMail({
                from: mailerFrom,
                to: targetEmail,
                subject: subject,
                text: text,
                html: html,
            });
            console.log(`[SMTP 2FA EMAIL SENT] Message ID: ${info.messageId} to ${targetEmail}`);
            return true;
        } catch (error: any) {
            console.error('Error sending SMTP 2FA email:', error);
            throw error;
        }
    }

    if (gcNotifyApiKey === 'mock-api-key') {
        console.log('----------------------------------------------------');
        console.log('[MOCK EMAIL SENT VIA GCNOTIFY - 2FA]');
        console.log(`To: ${targetEmail}`);
        console.log(`Passcode: ${passcode}`);
        console.log('----------------------------------------------------');
        return true;
    }

    try {
        const response = await axios.post(
            'https://api.notification.canada.ca/v2/notifications/email',
            {
                email_address: targetEmail,
                template_id: templateId,
                personalisation: {
                    requestor: 'System',
                    download_link: '',
                    passcode: passcode,
                    passcode_en: `Use the following passcode: ${passcode}`,
                    passcode_fr: `Utilisez le code d'accès suivant : ${passcode}`,
                    message: text
                }
            },
            {
                headers: {
                    'Authorization': `ApiKey-v1 ${gcNotifyApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error('Error sending GCNotify 2FA email:', error.response?.data || error.message);
        throw error;
    }
}

