import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'web_du_lich',
});

// Room type templates: mỗi property sẽ có 3 loại phòng
const roomTypeTemplates = [
    {
        name: 'Phòng Tiêu chuẩn',
        priceMultiplier: 1,       // Giá gốc = price_display của property
        total_allotment: 10,
        max_adults: 2,
        max_children: 1,
        room_size: 25,
        bed_type: '1 Giường đôi',
    },
    {
        name: 'Phòng Deluxe',
        priceMultiplier: 1.4,     // Giá = 1.4x giá gốc
        total_allotment: 8,
        max_adults: 2,
        max_children: 2,
        room_size: 35,
        bed_type: '1 Giường King',
    },
    {
        name: 'Phòng Suite',
        priceMultiplier: 2,       // Giá = 2x giá gốc
        total_allotment: 5,
        max_adults: 4,
        max_children: 2,
        room_size: 50,
        bed_type: '2 Giường đôi',
    },
];

async function seed() {
    const conn = await pool.getConnection();
    try {
        console.log('🔄 Bắt đầu seed room types...');

        // Lấy danh sách tất cả properties
        const [properties] = await conn.execute('SELECT id, price_display FROM properties');
        console.log(`📋 Tìm thấy ${properties.length} properties`);

        // Kiểm tra bookings đang tham chiếu room_type_id nào
        const [existingBookingRoomTypes] = await conn.execute(
            'SELECT DISTINCT room_type_id FROM bookings'
        );
        const usedRoomTypeIds = new Set(existingBookingRoomTypes.map(r => r.room_type_id));

        // Lấy room_types hiện tại
        const [existingRooms] = await conn.execute('SELECT id, property_id, name, price FROM room_types');
        const existingByProperty = {};
        for (const r of existingRooms) {
            if (!existingByProperty[r.property_id]) existingByProperty[r.property_id] = [];
            existingByProperty[r.property_id].push(r);
        }

        let inserted = 0;
        let updated = 0;

        for (const prop of properties) {
            const basePrice = Number(prop.price_display) || 1000000;
            const existing = existingByProperty[prop.id] || [];
            const existingNames = existing.map(e => e.name);

            for (const template of roomTypeTemplates) {
                const randomAllotment = Math.floor(Math.random() * (7 - 2 + 1)) + 2;
                const price = Math.round(basePrice * template.priceMultiplier);

                // Tìm xem đã có loại phòng này chưa
                const ex = existing.find(e => e.name === template.name);

                if (ex) {
                    // Đã có rồi -> Cập nhật (giá, số lượng phòng, v.v.)
                    // Lưu ý: Nếu có booking thì vẫn cập nhật total_allotment vì đây là số lượng phòng vật lý hiện có
                    await conn.execute(
                        `UPDATE room_types 
                         SET price = ?, total_allotment = ?, max_adults = ?, max_children = ?, room_size = ?, bed_type = ? 
                         WHERE id = ?`,
                        [
                            price,
                            randomAllotment,
                            template.max_adults,
                            template.max_children,
                            template.room_size,
                            template.bed_type,
                            ex.id
                        ]
                    );
                    updated++;
                } else {
                    // Chưa có -> Insert mới
                    await conn.execute(
                        `INSERT INTO room_types (property_id, name, price, total_allotment, max_adults, max_children, room_size, bed_type) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            prop.id,
                            template.name,
                            price,
                            randomAllotment,
                            template.max_adults,
                            template.max_children,
                            template.room_size,
                            template.bed_type,
                        ]
                    );
                    inserted++;
                }
            }
        }

        console.log(`✅ Seed hoàn tất! Đã thêm ${inserted} loại phòng mới, cập nhật ${updated} loại phòng cũ.`);

        // Hiển thị thống kê
        const [stats] = await conn.execute(
            'SELECT property_id, COUNT(*) as room_count FROM room_types GROUP BY property_id ORDER BY property_id'
        );
        console.log('\n📊 Thống kê room types theo property:');
        for (const s of stats) {
            console.log(`   Property #${s.property_id}: ${s.room_count} loại phòng`);
        }

    } catch (err) {
        console.error('❌ Lỗi:', err);
    } finally {
        conn.release();
        await pool.end();
    }
}

seed();
