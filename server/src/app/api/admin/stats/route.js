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

        const { searchParams } = new URL(req.url);
        const timeRange = searchParams.get('timeRange') || 'all';

        const getCondition = (prefix = '') => {
            const col = prefix ? `${prefix}.created_at` : 'created_at';
            switch (timeRange) {
                case 'today': return `DATE(${col}) = CURDATE()`;
                case '7days': return `${col} >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
                case 'month': return `MONTH(${col}) = MONTH(CURDATE()) AND YEAR(${col}) = YEAR(CURDATE())`;
                case 'quarter': return `QUARTER(${col}) = QUARTER(CURDATE()) AND YEAR(${col}) = YEAR(CURDATE())`;
                case 'year': return `YEAR(${col}) = YEAR(CURDATE())`;
                default: return '1=1';
            }
        };

        const getBookingCondition = (prefix = '') => {
            const checkInCol = prefix ? `${prefix}.check_in` : 'check_in';
            const checkOutCol = prefix ? `${prefix}.check_out` : 'check_out';
            switch (timeRange) {
                case 'today': return `(${checkInCol} <= CURDATE() AND ${checkOutCol} >= CURDATE())`;
                case '7days': return `(${checkInCol} <= CURDATE() AND ${checkOutCol} >= DATE_SUB(CURDATE(), INTERVAL 7 DAY))`;
                case 'month': return `((MONTH(${checkInCol}) = MONTH(CURDATE()) AND YEAR(${checkInCol}) = YEAR(CURDATE())) OR (MONTH(${checkOutCol}) = MONTH(CURDATE()) AND YEAR(${checkOutCol}) = YEAR(CURDATE())))`;
                case 'quarter': return `((QUARTER(${checkInCol}) = QUARTER(CURDATE()) AND YEAR(${checkInCol}) = YEAR(CURDATE())) OR (QUARTER(${checkOutCol}) = QUARTER(CURDATE()) AND YEAR(${checkOutCol}) = YEAR(CURDATE())))`;
                case 'year': return `(YEAR(${checkInCol}) = YEAR(CURDATE()) OR YEAR(${checkOutCol}) = YEAR(CURDATE()))`;
                default: return '1=1';
            }
        };

        // Get total users (Always show absolute total)
        const [usersResult] = await db.execute(`SELECT COUNT(*) as total FROM users`);

        // Get total bookings (Filtered by time range)
        const [bookingsResult] = await db.execute(`SELECT COUNT(*) as total FROM bookings WHERE ${getBookingCondition()}`);

        // Get total properties (Always show absolute total)
        const [propertiesResult] = await db.execute(`SELECT COUNT(*) as total FROM properties`);

        // Get total revenue (completed bookings - web only)
        const [revenueResult] = await db.execute(`
            SELECT COALESCE(SUM(total_price), 0) as total
            FROM bookings b
            JOIN users u ON b.customer_id = u.id
            WHERE b.status IN ('completed', 'confirmed')
            AND u.email != 'walkin@system.com'
            AND ${getBookingCondition('b')}
        `);

        // Get visits
        const [visitsResult] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM site_visits 
            WHERE ${getCondition()}
        `);

        // Get top users (most successful bookings by total spend)
        const [topUsersResult] = await db.execute(`
            SELECT u.id, u.name, u.avatar, COUNT(b.id) as booking_count, SUM(b.total_price) as total_spent
            FROM users u
            JOIN bookings b ON u.id = b.customer_id
            WHERE u.email != 'walkin@system.com'
            AND b.status IN ('completed', 'confirmed')
            AND ${getBookingCondition('b')}
            GROUP BY u.id
            ORDER BY total_spent DESC
            LIMIT 5
        `);

        // Get recent activity logs
        const [recentLogs] = await db.execute(`
            SELECT l.*, u.name as user_name
            FROM activity_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE ${getCondition('l')}
            ORDER BY l.created_at DESC
            LIMIT 10
        `);

        // Get users by role
        const [usersByRole] = await db.execute(`
            SELECT role, COUNT(*) as count FROM users WHERE ${getCondition()} GROUP BY role
        `);

        // Get bookings by status
        const [bookingsByStatus] = await db.execute(`
            SELECT status, COUNT(*) as count FROM bookings WHERE ${getBookingCondition()} GROUP BY status
        `);

        // Get recent bookings
        const [recentBookings] = await db.execute(`
            SELECT b.*, p.name as property_name, u.name as user_name
            FROM bookings b
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN users u ON b.customer_id = u.id
            WHERE ${getBookingCondition('b')}
            ORDER BY b.created_at DESC
            LIMIT 5
        `);

        // === CHART DATA ===
        let revenueGroupFormat = "'%Y-%m'";
        if (timeRange === 'today') revenueGroupFormat = "'%H:00'";
        else if (timeRange === '7days' || timeRange === 'month') revenueGroupFormat = "'%Y-%m-%d'";

        // Revenue by month (label might be hour, day, or month depending on timeRange)
        const [revenueByMonth] = await db.execute(`
            SELECT 
                DATE_FORMAT(b.created_at, ${revenueGroupFormat}) as month,
                COALESCE(SUM(b.total_price), 0) as revenue,
                COUNT(b.id) as bookings
            FROM bookings b
            JOIN users u ON b.customer_id = u.id
            WHERE b.status IN ('completed', 'confirmed')
            AND u.email != 'walkin@system.com'
            AND ${getBookingCondition('b')}
            GROUP BY DATE_FORMAT(b.created_at, ${revenueGroupFormat})
            ORDER BY month ASC
        `);

        let visitGroupFormat = "'%Y-%m-%d'";
        if (timeRange === 'today') visitGroupFormat = "'%H:00'";
        else if (timeRange === 'quarter' || timeRange === 'year' || timeRange === 'all') visitGroupFormat = "'%Y-%m'";

        // Daily visits (label might be hour, day, or month depending on timeRange)
        const [dailyVisits] = await db.execute(`
            SELECT 
                DATE_FORMAT(created_at, ${visitGroupFormat}) as date,
                COUNT(*) as visits
            FROM site_visits
            WHERE ${getCondition()}
            GROUP BY DATE_FORMAT(created_at, ${visitGroupFormat})
            ORDER BY date ASC
        `);

        let bookingGroupFormat = "'%Y-%m-%d'";
        if (timeRange === 'today') bookingGroupFormat = "'%H:00'";
        else if (timeRange === 'quarter' || timeRange === 'year' || timeRange === 'all') bookingGroupFormat = "'%Y-%m'";

        // Bookings created per day
        const [bookingsByDay] = await db.execute(`
            SELECT 
                DATE_FORMAT(b.created_at, ${bookingGroupFormat}) as date,
                COUNT(*) as count
            FROM bookings b
            WHERE ${getBookingCondition('b')}
            GROUP BY DATE_FORMAT(b.created_at, ${bookingGroupFormat})
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
            totalVolume: Number(revenueResult[0].total), // Total money processed
            totalRevenue: Math.round(Number(revenueResult[0].total) / 1.1 * 0.1), // 10% service fee
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
                totalVolume: Number(r.revenue),
                revenue: Math.round(Number(r.revenue) / 1.1 * 0.1), // 10% fee is the actual revenue
                bookings: Number(r.bookings)
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
