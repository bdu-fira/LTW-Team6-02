import db from './server/src/lib/db.js';
try {
    const [cols] = await db.execute('DESCRIBE properties');
    console.log(JSON.stringify(cols, null, 2));
} catch (err) {
    console.error(err);
}
process.exit(0);
