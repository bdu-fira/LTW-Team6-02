import db from './db';

/**
 * Sends a virtual SMS message by storing it in the database and emitting a socket event.
 * @param {string} phoneNumber - The recipient's phone number or identifier.
 * @param {string} content - The message content.
 * @returns {Promise<void>}
 */
export async function sendVirtualSMS(phoneNumber, content) {
    try {
        // 1. Store in database
        const [result] = await db.execute(
            'INSERT INTO system_sms (phone_number, content) VALUES (?, ?)',
            [phoneNumber, content]
        );

        // 2. Emit Socket.IO event if available
        if (global.io) {
            global.io.emit('new_sms', {
                id: result.insertId,
                phone_number: phoneNumber,
                content: content,
                sender_name: 'Antigravity Travel',
                created_at: new Date()
            });
            console.log(`[SMS] Socket emitted: new_sms for ${phoneNumber}`);
        } else {
            console.warn('[SMS] global.io is not defined. Socket event skipped.');
        }

        console.log(`[SMS] Virtual SMS sent to ${phoneNumber}: ${content}`);
    } catch (error) {
        console.error('[SMS] Error sending virtual SMS:', error);
    }
}
