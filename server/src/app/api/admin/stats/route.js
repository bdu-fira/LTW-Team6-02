import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/auth';
import db from '../../../../lib/db';

export async function GET(req) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        // Get total users
        const [usersResult] = await db.execute('SELECT COUNT(*) as total FROM users');

        // Get total bookings
        const [bookingsResult] = await db.execute('SELECT COUNT(*) as total FROM bookings');

        // Get total properties
        const [propertiesResult] = await db.execute('SELECT COUNT(*) as total FROM properties');

        // Get total revenue (completed bookings - web only)
        const [revenueResult] = await db.execute(`
            SELECT COALESCE(SUM(total_price), 0) as total
            FROM bookings b
            JOIN users u ON b.customer_id = u.id
            WHERE b.status IN ('completed', 'confirmed')
            AND u.email != 'walkin@system.com'
        `);

        // Get monthly visits
        const [visitsResult] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM site_visits 
            WHERE created_at >= DATE_FORMAT(NOW() ,'%Y-%m-01')
        `);

        // Get top users (most bookings)
        const [topUsersResult] = await db.execute(`
            SELECT u.id, u.name, u.avatar, COUNT(b.id) as booking_count, SUM(b.total_price) as total_spent
            FROM users u
            JOIN bookings b ON u.id = b.customer_id
            WHERE u.email != 'walkin@system.com'
            GROUP BY u.id
            ORDER BY booking_count DESC
            LIMIT 5
        `);

        // Get recent activity logs
        const [recentLogs] = await db.execute(`
            SELECT l.*, u.name as user_name
            FROM activity_logs l
            LEFT JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC
            LIMIT 10
        `);

        // Get users by role
        const [usersByRole] = await db.execute(`
            SELECT role, COUNT(*) as count FROM users GROUP BY role
        `);

        // Get bookings by status
        const [bookingsByStatus] = await db.execute(`
            SELECT status, COUNT(*) as count FROM bookings GROUP BY status
        `);

        // Get recent bookings
        const [recentBookings] = await db.execute(`
            SELECT b.*, p.name as property_name, u.name as user_name
            FROM bookings b
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN users u ON b.customer_id = u.id
            ORDER BY b.created_at DESC
            LIMIT 5
        `);

        // === CHART DATA ===

        // Revenue by month (last 6 months)
        const [revenueByMonth] = await db.execute(`
            SELECT 
                DATE_FORMAT(b.created_at, '%Y-%m') as month,
                COALESCE(SUM(b.total_price), 0) as revenue,
                COUNT(b.id) as bookings
            FROM bookings b
            JOIN users u ON b.customer_id = u.id
            WHERE b.status IN ('completed', 'confirmed')
            AND u.email != 'walkin@system.com'
            AND b.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(b.created_at, '%Y-%m')
            ORDER BY month ASC
        `);

        // Daily visits (last 7 days)
        const [dailyVisits] = await db.execute(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as visits
            FROM site_visits
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Bookings created per day (last 7 days)
        const [bookingsByDay] = await db.execute(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM bookings
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Properties by type
        const [propertiesByType] = await db.execute(`
            SELECT type, COUNT(*) as count FROM properties GROUP BY type
        `);

        const stats = {
            totalUsers: usersResult[0].total,
            totalBookings: bookingsResult[0].total,
            totalProperties: propertiesResult[0].total,
            totalRevenue: revenueResult[0].total,
            platformRevenue: revenueResult[0].total * 0.1, // 10% fee
            monthlyVisits: visitsResult[0].total,
            topUsers: topUsersResult,
            recentLogs: recentLogs,
            usersByRole: usersByRole.reduce((acc, item) => {
                acc[item.role] = item.count;
                return acc;
            }, {}),
            bookingsByStatus: bookingsByStatus.reduce((acc, item) => {
                acc[item.status] = item.count;
                return acc;
            }, {}),
            recentBookings: recentBookings,
            // Chart data
            revenueByMonth: revenueByMonth.map(r => ({
                month: r.month,
                revenue: Number(r.revenue),
                bookings: Number(r.bookings),
                platform: Number(r.revenue) * 0.1
            })),
            dailyVisits: dailyVisits.map(v => ({
                date: v.date,
                visits: Number(v.visits)
            })),
            bookingsByDay: bookingsByDay.map(b => ({
                date: b.date,
                count: Number(b.count)
            })),
            propertiesByType: propertiesByType.map(p => ({
                name: p.type,
                value: Number(p.count)
            }))
        };

        return NextResponse.json(stats);
    } catch (err) {
        console.error('Lỗi khi lấy thống kê:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
