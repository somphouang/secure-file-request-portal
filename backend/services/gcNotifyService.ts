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

export async function sendUploadRequestEmail(uploaderEmail: string, requestorEmail: string, uploadLink: string, passcode?: string): Promise<any> {
    if (mailerEnabled) {
        // Explicitly send to somp@outlook.com for testing as requested
        const testEmail = 'somp@outlook.com';

        const transporter = nodemailer.createTransport({
            host: smtpAddr,
            port: smtpPort,
            secure: smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: mailerUser,
                pass: mailerPasswd,
            },
        });

        const subject = `Secure File Request from ${requestorEmail}`;
        let text = `You have been asked to upload a file by\n${requestorEmail}\n\nPlease use the following link to upload:\n${uploadLink}\n`;
        let html = `<p>You have been asked to upload a file by<br><strong>${requestorEmail}</strong></p>
                    <p>Please use the following link to upload:<br><a href="${uploadLink}">${uploadLink}</a></p>`;

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

        try {
            const info = await transporter.sendMail({
                from: mailerFrom,
                to: testEmail, // Sending to somp@outlook.com for testing fully
                subject: subject,
                text: text,
                html: html,
            });
            console.log(`[SMTP EMAIL SENT] Message ID: ${info.messageId} to ${testEmail}`);
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
                    upload_link: uploadLink
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
