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

export async function sendUploadRequestEmail(uploaderEmail: string, requestorEmail: string, uploadLink: string, passcode?: string, allowMultiple?: boolean, requestNumber?: string, caseNumber?: string): Promise<any> {
    const subject = `Secure File Request from ${requestorEmail}${requestNumber ? ` [${requestNumber}]` : ''}${caseNumber ? ` [${caseNumber}]` : ''}`;
    let text = `You have been asked to upload a file by\n${requestorEmail}\n`;
    if (requestNumber) text += `\nRequest Number: ${requestNumber}\n`;
    if (caseNumber) text += `\nCase Number: ${caseNumber}\n`;
    text += `\nPlease use the following link to upload:\n${uploadLink}\n`;
    let html = `<p>You have been asked to upload a file by<br><strong>${requestorEmail}</strong></p>`;
    if (requestNumber) html += `<p>Request Number: <strong>${requestNumber}</strong></p>`;
    if (caseNumber) html += `<p>Case Number: <strong>${caseNumber}</strong></p>`;
    html += `<p>Please use the following link to upload:<br><a href="${uploadLink}">${uploadLink}</a></p>`;

    if (passcode) {
        text += `\nUse the passcode for uploading:\n${passcode}\n`;
        html += `<p>Use the passcode for uploading:<br><strong>${passcode}</strong></p>`;
    }

    // French implementation
    text += `\n---\n\nVous avez été invité à télécharger un fichier par\n${requestorEmail}\n\nVeuillez utiliser le lien suivant pour le téléchargement :\n${uploadLink}\n`;
    html += `<hr><p>Vous avez été invité à télécharger un fichier par<br><strong>${requestorEmail}</strong></p>
             <p>Veuillez utiliser le lien suivant pour le téléchargement :<br><a href="${uploadLink}">${uploadLink}</a></p>`;

    if (passcode) {
        text += `\nUtilisez le code d'accès pour le téléchargement :\n${passcode}\n`;
        html += `<p>Utilisez le code d'accès pour le téléchargement :<br><strong>${passcode}</strong></p>`;
    }

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
                    passcode: passcode || '',
                    passcode_en: passcode ? `Use the passcode for uploading: ${passcode}` : '',
                    passcode_fr: passcode ? `Utilisez le code d'accès pour le téléchargement : ${passcode}` : '',
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

export async function sendDownloadRequestEmail(downloaderEmail: string, requestorEmail: string, downloadLink: string, passcode: string, requestNumber?: string, caseNumber?: string): Promise<any> {
    const subject = `Secure Download link from ${requestorEmail}${requestNumber ? ` [${requestNumber}]` : ''}${caseNumber ? ` [${caseNumber}]` : ''}`;
    let text = `You have been authorized to download a file by\n${requestorEmail}\n`;
    if (requestNumber) text += `\nRequest Number: ${requestNumber}\n`;
    if (caseNumber) text += `\nCase Number: ${caseNumber}\n`;
    text += `\nPlease use the following link to download:\n${downloadLink}\n\nYour passcode is:\n${passcode}\n`;
    let html = `<p>You have been authorized to download a file by<br><strong>${requestorEmail}</strong></p>`;
    if (requestNumber) html += `<p>Request Number: <strong>${requestNumber}</strong></p>`;
    if (caseNumber) html += `<p>Case Number: <strong>${caseNumber}</strong></p>`;
    html += `<p>Please use the following link to download:<br><a href="${downloadLink}">${downloadLink}</a></p>
                <p>Your passcode is:<br><strong>${passcode}</strong></p>`;

    // French translation
    text += `\n---\n\nVous êtes autorisé à télécharger un fichier par\n${requestorEmail}\n\nVeuillez utiliser le lien suivant pour télécharger :\n${downloadLink}\n\nVotre code d'accès est :\n${passcode}\n`;
    html += `<hr><p>Vous êtes autorisé à télécharger un fichier par<br><strong>${requestorEmail}</strong></p>
             <p>Veuillez utiliser le lien suivant pour télécharger :<br><a href="${downloadLink}">${downloadLink}</a></p>
             <p>Votre code d'accès est :<br><strong>${passcode}</strong></p>`;

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
        console.log(`Passcode: ${passcode}`);
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
                    passcode: passcode,
                    passcode_en: `Use the passcode for downloading: ${passcode}`,
                    passcode_fr: `Utilisez le code d'accès pour le téléchargement : ${passcode}`,
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

