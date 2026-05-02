import db from './db';

/**
 * Sends a virtual Email message by storing it in the database and emitting a socket event.
 * @param {string} recipientEmail - The recipient's email address.
 * @param {string} subject - The email subject.
 * @param {string} content - The email content (HTML or plain text).
 * @returns {Promise<void>}
 */
export async function sendVirtualEmail(recipientEmail, subject, content) {
    try {
        // 1. Store in database
        const [result] = await db.execute(
            'INSERT INTO system_emails (recipient_email, subject, content) VALUES (?, ?, ?)',
            [recipientEmail, subject, content]
        );

        // 2. Emit Socket.IO event if available
        if (global.io) {
            global.io.emit('new_email', {
                id: result.insertId,
                recipient_email: recipientEmail,
                subject: subject,
                content: content,
                created_at: new Date()
            });
            console.log(`[Email] Socket emitted: new_email for ${recipientEmail}`);
        } else {
            console.warn('[Email] global.io is not defined. Socket event skipped.');
        }

        console.log(`[Email] Virtual Email sent to ${recipientEmail}: ${subject}`);
    } catch (error) {
        console.error('[Email] Error sending virtual Email:', error);
    }
}
