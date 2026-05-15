import pool from '../src/lib/db.js';

async function migrate() {
    try {
        console.log('Starting migration...');
        
        // Add phone column to bookings
        await pool.execute('ALTER TABLE bookings ADD COLUMN guest_phone VARCHAR(20) NULL AFTER customer_id');
        console.log('Added guest_phone to bookings');
        
        // Add name column to bookings
        await pool.execute('ALTER TABLE bookings ADD COLUMN guest_name VARCHAR(255) NULL AFTER guest_phone');
        console.log('Added guest_name to bookings');
        
        console.log('Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
