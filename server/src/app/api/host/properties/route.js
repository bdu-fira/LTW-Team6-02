import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '../../../../lib/db';

export async function POST(req) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        } catch {
            return NextResponse.json({ message: 'Token không hợp lệ hoặc đã hết hạn' }, { status: 401 });
        }

        const hostId = decoded.user.id;
        const body = await req.json();
        const { name, type, location, description, price_display, bedrooms, bathrooms, max_guests, map_embed } = body;

        if (!name || !type || !location) {
            return NextResponse.json({ message: 'Vui lòng điền đầy đủ các thông tin bắt buộc (Tên, Loại, Địa chỉ)' }, { status: 400 });
        }

        const [result] = await db.execute(`
            INSERT INTO properties (name, type, location, description, price_display, host_id, status, is_hot, bedrooms, bathrooms, max_guests, map_embed)
            VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?)
        `, [name, type, location, description || '', price_display || 0, hostId, bedrooms || 0, bathrooms || 0, max_guests || 0, map_embed || '']);

        const newPropertyId = result.insertId;

        // Optionally add a default image if provided or placeholder
        if (body.imageUrl) {
            await db.execute(`
                INSERT INTO property_images (property_id, image_url, is_main)
                VALUES (?, ?, 1)
            `, [newPropertyId, body.imageUrl]);
        }

        return NextResponse.json({
            message: 'Thêm chỗ nghỉ mới thành công!',
            id: newPropertyId
        }, { status: 201 });
    } catch (err) {
        console.error('Lỗi khi thêm property mới:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function GET(req) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        } catch {
            return NextResponse.json({ message: 'Token không hợp lệ hoặc đã hết hạn' }, { status: 401 });
        }

        const hostId = decoded.user.id;

        const [properties] = await db.execute(`
            SELECT p.*, u.name as host_name, u.avatar as host_avatar, u.role as host_role
            FROM properties p
            LEFT JOIN users u ON p.host_id = u.id
            WHERE p.host_id = ?
        `, [hostId]);

        // Fetch other relations like images, amenities, room plans
        const propertiesWithDetails = await Promise.all(properties.map(async (p) => {
            const [images] = await db.execute('SELECT * FROM property_images WHERE property_id = ?', [p.id]);
            const [amenitiesResult] = await db.execute(`
                SELECT a.* 
                FROM amenities a
                JOIN property_amenities pa ON a.id = pa.amenity_id
                WHERE pa.property_id = ?
            `, [p.id]);
            const [rooms] = await db.execute('SELECT * FROM room_types WHERE property_id = ?', [p.id]);

            // Lấy rating và số lượng reviews thật từ DB
            const [reviewStats] = await db.execute(`
                SELECT COUNT(*) as total_reviews, COALESCE(AVG(rating), 0) as avg_rating
                FROM reviews WHERE property_id = ?
            `, [p.id]);

            const mainImage = images.find(img => img.is_main) || images[0];
            const galleryImages = images.filter(img => !mainImage || img.id !== mainImage.id).map(img => img.image_url);

            const rawPrice = p.price_display != null ? Number(p.price_display) : null;

            return {
                id: p.id,
                name: p.name,
                type: p.type,
                location: p.location,
                price: rawPrice ? rawPrice.toLocaleString('vi-VN') + '₫' : 'Liên hệ',
                rawPrice: rawPrice,
                rating: parseFloat(Number(reviewStats[0].avg_rating).toFixed(1)),
                reviews: Number(reviewStats[0].total_reviews),
                host: {
                    name: p.host_name || 'Unknown',
                    avatar: p.host_avatar || '',
                    superhost: p.host_role === 'host',
                },
                bedrooms: p.bedrooms || 0,
                bathrooms: p.bathrooms || 0,
                maxGuests: p.max_guests || (rooms.length > 0 ? rooms[0].max_adults : 0),
                isHot: p.is_hot,
                description: p.description,
                images: {
                    main: mainImage ? mainImage.image_url : '',
                    gallery: galleryImages.length ? galleryImages : []
                },
                amenities: amenitiesResult,
                detailedAmenities: [],
                rooms: rooms.map(r => ({
                    id: r.id,
                    name: r.name,
                    price: Number(r.price),
                    total_allotment: r.total_allotment,
                    max_adults: r.max_adults,
                    max_children: r.max_children,
                    room_size: r.room_size,
                    bed_type: r.bed_type,
                })),
                mapImage: p.map_image,
                mapEmbed: p.map_embed
            };
        }));

        return NextResponse.json(propertiesWithDetails);
    } catch (err) {
        console.error('Lỗi khi lấy properties của host:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
