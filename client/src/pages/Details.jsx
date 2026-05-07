import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { FullPageLoader, Spinner } from '../components/Loader';

export default function Details() {
    const { id } = useParams();
    const navigate = useNavigate();
    const bookingSidebarRef = useRef(null);
    const [showMobileBookingBar, setShowMobileBookingBar] = useState(false);
    const [isMobilePaymentOpen, setIsMobilePaymentOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('card');
    const [discountCode, setDiscountCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(null);
    const [discountMessage, setDiscountMessage] = useState({ text: '', type: '' });
    const [specialRequests, setSpecialRequests] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [bookingId, setBookingId] = useState(null);
    const [paymentError, setPaymentError] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [mobileCheckIn, setMobileCheckIn] = useState('');
    const [mobileCheckOut, setMobileCheckOut] = useState('');
    const [mobileRoomType, setMobileRoomType] = useState(null); // room_type_id
    const [property, setProperty] = useState(null);
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [roomType, setRoomType] = useState(null); // room_type_id
    const [dateError, setDateError] = useState('');
    const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
    const [isAmenitiesModalOpen, setIsAmenitiesModalOpen] = useState(false);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isShareBarOpen, setIsShareBarOpen] = useState(false);
    const mapSectionRef = useRef(null);
    const [currentUser, setCurrentUser] = useState(() => {
        const stored = localStorage.getItem('currentUser');
        return stored ? JSON.parse(stored) : null;
    });

    // Reviews state
    const [reviews, setReviews] = useState([]);
    const [avgRating, setAvgRating] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [userBookings, setUserBookings] = useState([]);
    const [reviewForm, setReviewForm] = useState({ booking_id: '', rating: 5, comment: '' });
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const [reviewSuccess, setReviewSuccess] = useState('');

    const today = new Date().toISOString().split('T')[0];

    // Show mobile booking bar on scroll
    useEffect(() => {
        const handleScroll = () => {
            if (bookingSidebarRef.current) {
                const rect = bookingSidebarRef.current.getBoundingClientRect();
                setShowMobileBookingBar(rect.bottom < 0);
            } else {
                setShowMobileBookingBar(window.scrollY > 300);
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const resolveImageUrl = (url) => {
        if (!url) return '';
        return url.startsWith('http') ? url : '/' + url.replace(/^\//, '');
    };

    const handleCheckInChange = (e) => {
        const val = e.target.value;
        setCheckIn(val);
        setDateError('');
        if (checkOut && val >= checkOut) {
            setCheckOut('');
        }
    };

    const handleCheckOutChange = (e) => {
        const val = e.target.value;
        if (checkIn && val <= checkIn) {
            setDateError('Ngày trả phòng phải sau ngày nhận phòng.');
            return;
        }
        setDateError('');
        setCheckOut(val);
    };

    const handleBookNow = async (isMobile = false) => {
        if (!checkIn || !checkOut) {
            setDateError('Vui lòng chọn đầy đủ ngày nhận và trả phòng.');
            return;
        }

        let selectedRoomId = roomType;
        if (!selectedRoomId && property && property.rooms && property.rooms.length > 0) {
            selectedRoomId = String(property.rooms[0].id);
        }

        if (!selectedRoomId) {
            setDateError('Loại phòng không hợp lệ.');
            return;
        }

        setIsProcessing(true);
        setDateError('');

        try {
            const res = await fetch('/api/check-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    property_id: property.id,
                    room_type_id: selectedRoomId,
                    check_in: checkIn,
                    check_out: checkOut,
                    number_of_rooms: 1
                })
            });

            const data = await res.json();
            setIsProcessing(false);

            if (data.success) {
                if (isMobile) {
                    setMobileCheckIn(checkIn);
                    setMobileCheckOut(checkOut);
                    setMobileRoomType(selectedRoomId);
                    setIsMobilePaymentOpen(true);
                    setIsSuccess(false);
                    setPaymentError('');
                } else {
                    navigate(`/payment?id=${property.id}&checkIn=${checkIn}&checkOut=${checkOut}&roomTypeId=${selectedRoomId}`);
                }
            } else {
                setDateError(data.message || 'Phòng đã hết trong khoảng thời gian này.');
            }
        } catch (error) {
            setIsProcessing(false);
            setDateError('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
        }
    };

    useEffect(() => {
        const fetchProperties = async () => {
            try {
                const res = await fetch('/api/properties');
                if (res.ok) {
                    const data = await res.json();
                    const p = data.find(p => p.id.toString() === id);
                    if (p) {
                        setProperty(p);
                    } else {
                        setProperty(data[0]);
                    }
                }
            } catch (error) {
                console.error('Lỗi khi tải thông tin chỗ ở:', error);
            }
        };
        fetchProperties();
    }, [id]);

    // Fetch reviews for this property
    const fetchReviews = async () => {
        try {
            const res = await fetch(`/api/reviews?property_id=${id}`);
            if (res.ok) {
                const data = await res.json();
                setReviews(data.reviews);
                setAvgRating(data.averageRating);
                setTotalReviews(data.totalReviews);
            }
        } catch (error) {
            console.error('Lỗi khi tải đánh giá:', error);
        }
    };

    useEffect(() => {
        if (id) fetchReviews();
    }, [id]);

    // Listen for login/logout to update review section reactively
    useEffect(() => {
        const handleUserUpdated = () => {
            const stored = localStorage.getItem('currentUser');
            setCurrentUser(stored ? JSON.parse(stored) : null);
        };
        window.addEventListener('userUpdated', handleUserUpdated);
        return () => window.removeEventListener('userUpdated', handleUserUpdated);
    }, []);

    // Fetch user's bookings for this property (to allow review submission)
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !id) return;
        const fetchUserBookings = async () => {
            try {
                const res = await fetch('/api/user/bookings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    // Lọc bookings confirmed cho property này và chưa được review
                    const reviewedBookingIds = reviews.map(r => r.booking_id);
                    const available = data.filter(b =>
                        b.property_id.toString() === id &&
                        b.status === 'confirmed' &&
                        !reviewedBookingIds.includes(b.id)
                    );
                    setUserBookings(available);
                }
            } catch (error) {
                console.error('Lỗi khi tải bookings:', error);
            }
        };
        fetchUserBookings();
    }, [id, reviews]);

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        setReviewError('');
        setReviewSuccess('');

        const token = localStorage.getItem('token');
        if (!token) {
            window.dispatchEvent(new CustomEvent('openLoginModal', {
                detail: { message: 'Đăng nhập để đánh giá chỗ ở' }
            }));
            return;
        }

        if (!reviewForm.booking_id) {
            setReviewError('Vui lòng chọn booking để đánh giá');
            return;
        }

        setReviewSubmitting(true);
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    property_id: parseInt(id),
                    booking_id: parseInt(reviewForm.booking_id),
                    rating: reviewForm.rating,
                    comment: reviewForm.comment
                })
            });

            const data = await res.json();
            if (res.ok) {
                setReviewSuccess('Đánh giá thành công!');
                setReviewForm({ booking_id: '', rating: 5, comment: '' });
                fetchReviews(); // Reload reviews
            } else {
                setReviewError(data.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            setReviewError('Không thể gửi đánh giá. Vui lòng thử lại.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    useEffect(() => {
        if (!property) return;
        const stored = JSON.parse(localStorage.getItem('favoriteProperties') || '[]');
        setIsFavorite(stored.some((item) => item.id === property.id));
    }, [property]);

    const toggleFavorite = () => {
        if (!property) return;

        // Check if user is logged in
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
            window.dispatchEvent(new CustomEvent('openLoginModal', {
                detail: { message: 'Đăng nhập để lưu chỗ ở yêu thích của bạn' }
            }));
            return;
        }

        const stored = JSON.parse(localStorage.getItem('favoriteProperties') || '[]');
        const exists = stored.some((item) => item.id === property.id);
        let updated = [];

        if (exists) {
            updated = stored.filter((item) => item.id !== property.id);
            setIsFavorite(false);
        } else {
            updated = [
                ...stored,
                {
                    id: property.id,
                    name: property.name,
                    location: property.location,
                    price: property.price,
                    rating: property.rating,
                    reviews: property.reviews,
                    image: resolveImageUrl(property.images?.main),
                },
            ];
            setIsFavorite(true);
        }

        localStorage.setItem('favoriteProperties', JSON.stringify(updated));
        window.dispatchEvent(new Event('favoritesUpdated'));
    };

    if (!property) return <FullPageLoader message="Đang tải thông tin chỗ ở..." />;

    // Price calculations
    const priceString = property.price.replace(/\./g, '').replace(/[₫đ]/g, '');
    const pricePerNightBase = parseInt(priceString) || 0;

    let checkInDate = checkIn ? new Date(checkIn) : new Date();
    let checkOutDate = checkOut ? new Date(checkOut) : new Date(Date.now() + 86400000); // 1 night default

    if (isNaN(checkInDate.getTime())) checkInDate = new Date();
    if (isNaN(checkOutDate.getTime())) checkOutDate = new Date(Date.now() + 86400000);

    const timeDiff = checkOutDate - checkInDate;
    const nights = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24))); // Fix negative nights returning 0

    // Lấy giá từ room type được chọn (dynamic từ DB)
    const rooms = Array.isArray(property.rooms) ? property.rooms : [];
    const selectedRoom = rooms.find(r => String(r.id) === String(roomType)) || rooms[0];
    const pricePerNight = selectedRoom ? Number(selectedRoom.price) : pricePerNightBase;

    // Auto-select room type nếu chưa chọn
    if (!roomType && rooms.length > 0) {
        setRoomType(String(rooms[0].id));
    }

    const totalBase = pricePerNight * nights;
    const serviceFee = Math.round(totalBase * 0.1);
    const total = totalBase + serviceFee;

    const MAX_DESCRIPTION_CHARS = 380;
    const fullDescription = property.description || '';
    const isLongDescription = fullDescription.length > MAX_DESCRIPTION_CHARS;
    const displayedDescription =
        !isLongDescription
            ? fullDescription
            : fullDescription.slice(0, MAX_DESCRIPTION_CHARS).trimEnd() + '...';

    const amenities = Array.isArray(property.amenities) ? property.amenities : [];
    const mainAmenities = amenities.slice(0, 6);

    const galleryImages = [
        property.images?.main,
        ...(Array.isArray(property.images?.gallery) ? property.images.gallery : []),
    ]
        .filter(Boolean)
        .map((url) => resolveImageUrl(url));

    const getLocationMapUrl = () => {
        const loc = (property.location || '').toLowerCase();

        if (loc.includes('hồ chí minh')) {
            return 'https://maps.app.goo.gl/vUGZmiPWP9bFBbkN9';
        }
        if (loc.includes('mũi né') || loc.includes('phan thiết')) {
            return 'https://maps.app.goo.gl/dXhizQ4F6gsAuJQE7';
        }
        if (loc.includes('hội an')) {
            return 'https://maps.app.goo.gl/aDMv3aLYB4GWWHtQ6';
        }
        if (loc.includes('huế')) {
            return 'https://maps.app.goo.gl/cPtxXptxKnqrJYc3A';
        }
        if (loc.includes('đà lạt')) {
            return 'https://maps.app.goo.gl/eKDYWe8jabvZTUZM8';
        }
        if (loc.includes('đà nẵng')) {
            return 'https://maps.app.goo.gl/tPQ74nhScxj9245h8';
        }
        if (loc.includes('sapa')) {
            return 'https://maps.app.goo.gl/LeLjPF3k4YzVv3x16';
        }

        if (property.mapEmbed) return property.mapEmbed;

        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.location || '')}`;
    };

    const handleOpenGallery = (startIndex = 0) => {
        if (!galleryImages.length) return;
        setActiveGalleryIndex(Math.min(Math.max(startIndex, 0), galleryImages.length - 1));
        setIsGalleryOpen(true);
    };

    const handleCloseGallery = () => {
        setIsGalleryOpen(false);
    };

    const handlePrevGallery = () => {
        if (!galleryImages.length) return;
        setActiveGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
    };

    const handleNextGallery = () => {
        if (!galleryImages.length) return;
        setActiveGalleryIndex((prev) => (prev + 1) % galleryImages.length);
    };

    const handleShare = async () => {
        const shareUrl = window.location.href;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                alert('Đã sao chép liên kết chỗ ở.');
            } else {
                const tempInput = document.createElement('input');
                tempInput.value = shareUrl;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                tempInput.remove();
                alert('Đã sao chép liên kết chỗ ở.');
            }
        } catch (error) {
            console.error('Không thể sao chép liên kết:', error);
            alert('Không thể sao chép liên kết.');
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col">
            {/* The body content from details.html goes here */}

            <div className="relative flex min-h-screen w-full flex-col">
                <Header />
                <main className="flex h-full grow flex-col pt-20">
                    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
                        <div id="loading" className="text-center py-20 hidden">
                            <p>Đang tải thông tin...</p>
                        </div>
                        <div id="error-message" className="text-center py-20 hidden">
                            <h2 className="text-2xl font-bold text-red-600">Không tìm thấy chỗ ở</h2>
                            <p className="mt-4">Xin lỗi, chúng tôi không tìm thấy thông tin chỗ ở bạn yêu cầu.</p>
                            <a href="/"
                                className="mt-6 inline-block px-6 py-3 bg-primary text-white rounded-lg font-bold">Quay
                                lại trang
                                chủ</a>
                        </div>

                        <div id="property-content" className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap gap-2">
                                    <a className="text-neutral-500 dark:text-neutral-200 text-sm font-medium leading-normal hover:text-primary"
                                        href="/">Trang chủ</a>
                                    <span
                                        className="text-neutral-500 dark:text-neutral-200 text-sm font-medium leading-normal">/</span>
                                    <a className="text-neutral-500 dark:text-neutral-200 text-sm font-medium leading-normal hover:text-primary"
                                        href="#" id="breadcrumb-location">{property.location}</a>
                                    <span
                                        className="text-neutral-500 dark:text-neutral-200 text-sm font-medium leading-normal">/</span>
                                    <span className="text-neutral-700 dark:text-white text-sm font-medium leading-normal"
                                        id="breadcrumb-name">{property.name}</span>
                                </div>
                                <div className="flex flex-wrap justify-between items-start gap-4">
                                    <div className="flex flex-col gap-1">
                                        <h1 id="property-name" className="text-neutral-700 dark:text-white text-3xl font-bold leading-tight tracking-tight">{property.name}</h1>
                                        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-200">
                                            <span className="material-symbols-outlined text-accent-gold !text-lg"
                                            >star</span>
                                            <span className="font-bold text-neutral-700 dark:text-white"
                                                id="property-rating">{property.rating}</span>
                                            <span id="property-reviews">({property.reviews} đánh giá)</span>
                                            <span className="font-bold">·</span>
                                            <button
                                                type="button"
                                                className="font-bold underline text-neutral-700 dark:text-white hover:text-primary"
                                                id="property-location-link"
                                                onClick={() => {
                                                    const url = getLocationMapUrl();
                                                    window.open(url, '_blank', 'noopener,noreferrer');
                                                }}
                                            >
                                                {property.location}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleShare}
                                            className="flex items-center gap-2 px-3 py-2 text-neutral-700 dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700">
                                            <span className="material-symbols-outlined !text-xl">ios_share</span>
                                            <span className="text-sm font-medium">Chia sẻ</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={toggleFavorite}
                                            className="flex items-center gap-2 px-3 py-2 text-neutral-700 dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        >
                                            <span
                                                className="material-symbols-outlined !text-xl"
                                                style={{ fontVariationSettings: `'FILL' ${isFavorite ? 1 : 0}` }}
                                            >
                                                favorite
                                            </span>
                                            <span className="text-sm font-medium">
                                                {isFavorite ? 'Đã lưu' : 'Lưu'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[550px]">
                                    <div className="col-span-4 sm:col-span-2 row-span-2 rounded-xl overflow-hidden">
                                        <div
                                            id="img-main"
                                            className="w-full h-full bg-center bg-no-repeat bg-cover bg-neutral-200"
                                            style={{ backgroundImage: `url(${resolveImageUrl(property.images.main)})` }}
                                        ></div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1 row-span-1 rounded-xl overflow-hidden hidden sm:block">
                                        <div
                                            id="img-gallery-0"
                                            className="w-full h-full bg-center bg-no-repeat bg-cover bg-neutral-200"
                                            style={{
                                                backgroundImage: `url(${resolveImageUrl(
                                                    property.images.gallery?.[0] || property.images.main
                                                )})`,
                                            }}
                                        ></div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1 row-span-1 rounded-xl overflow-hidden hidden sm:block">
                                        <div
                                            id="img-gallery-1"
                                            className="w-full h-full bg-center bg-no-repeat bg-cover bg-neutral-200"
                                            style={{
                                                backgroundImage: `url(${resolveImageUrl(
                                                    property.images.gallery?.[1] || property.images.main
                                                )})`,
                                            }}
                                        ></div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1 row-span-1 rounded-xl overflow-hidden hidden sm:block">
                                        <div
                                            id="img-gallery-2"
                                            className="w-full h-full bg-center bg-no-repeat bg-cover bg-neutral-200"
                                            style={{
                                                backgroundImage: `url(${resolveImageUrl(
                                                    property.images.gallery?.[2] || property.images.main
                                                )})`,
                                            }}
                                        ></div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1 row-span-1 rounded-xl overflow-hidden hidden sm:block">
                                        <div
                                            id="img-gallery-3"
                                            className="w-full h-full bg-center bg-no-repeat bg-cover bg-neutral-200"
                                            style={{
                                                backgroundImage: `url(${resolveImageUrl(
                                                    property.images.gallery?.[3] || property.images.main
                                                )})`,
                                            }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="absolute bottom-4 right-4">
                                    <button
                                        id="view-all-photos-btn"
                                        type="button"
                                        onClick={() => handleOpenGallery(0)}
                                        className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white text-charcoal gap-2 text-sm font-bold leading-normal tracking-[0.015em] border border-neutral-300 shadow-sm hover:shadow-md"
                                    >
                                        <span className="material-symbols-outlined !text-xl">collections</span>
                                        <span>Xem tất cả ảnh</span>
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-24 mt-6">
                                <div className="lg:col-span-2 flex flex-col gap-8">
                                    <div className="flex flex-col gap-4 pb-8 border-b border-neutral-200 dark:border-neutral-700">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h2 className="text-xl font-bold text-neutral-700 dark:text-white" id="host-info">Toàn bộ {property.type}. Chủ nhà {property.host?.name || "Minh"}</h2>
                                                <p className="text-neutral-500 dark:text-neutral-200">{property.maxGuests} khách · {property.bedrooms} phòng ngủ · {property.bathrooms} phòng tắm</p>
                                            </div>
                                            <img id="host-avatar" className="w-14 h-14 rounded-full object-cover" src={property.host?.avatar || "https://placekitten.com/200/200"} />
                                        </div>
                                        <div className="flex items-center gap-2 mt-2" id="superhost-badge">
                                            <span
                                                className="inline-flex items-center justify-center rounded-full bg-accent-gold/10 px-3 py-1 text-xs font-bold text-accent-gold">
                                                Chủ nhà siêu cấp
                                            </span>
                                            <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-200 text-sm">
                                                <span className="material-symbols-outlined text-accent-gold !text-base"
                                                >workspace_premium</span>
                                                <span>Đánh giá xuất sắc</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pb-8 border-b border-neutral-200 dark:border-neutral-700">
                                        <p
                                            className="text-neutral-500 dark:text-neutral-200 leading-relaxed whitespace-pre-line"
                                            id="property-description"
                                        >
                                            {displayedDescription}
                                        </p>
                                        {isLongDescription && (
                                            <button
                                                type="button"
                                                onClick={() => setIsDescriptionModalOpen(true)}
                                                className="mt-4 inline-flex items-center gap-1 font-bold text-neutral-700 dark:text-white hover:text-primary cursor-pointer transition-colors"
                                                id="description-toggle-btn"
                                            >
                                                <span className="underline select-none">Hiển thị thêm</span>
                                                <span className="material-symbols-outlined !text-xl hover:translate-x-1 transition-transform duration-200">chevron_right</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="pb-8 border-b border-neutral-200 dark:border-neutral-700">
                                        <h2 className="text-xl font-bold text-neutral-700 dark:text-white mb-4">Tiện ích chính</h2>
                                        <div className="grid grid-cols-2 gap-4" id="amenities-list">
                                            {mainAmenities.length > 0 ? (
                                                mainAmenities.map((amenity, index) => (
                                                    <div key={index} className="flex items-center gap-3 text-neutral-700 dark:text-white">
                                                        <span className="material-symbols-outlined text-base">
                                                            {amenity.icon || 'check_circle'}
                                                        </span>
                                                        <span className="text-sm">{amenity.name}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-neutral-500 dark:text-neutral-300 text-sm">
                                                    Chưa có thông tin tiện ích.
                                                </p>
                                            )}
                                        </div>
                                        {amenities.length > 0 && (
                                            <button
                                                id="show-amenities-btn"
                                                type="button"
                                                onClick={() => setIsAmenitiesModalOpen(true)}
                                                className="mt-6 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-transparent text-neutral-700 dark:text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] border border-neutral-700 dark:border-white hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                            >
                                                <span>Hiển thị tất cả tiện nghi</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="pb-8 border-b border-neutral-200 dark:border-neutral-700">
                                        <div className="flex items-center gap-2 mb-6">
                                            <span className="material-symbols-outlined text-accent-gold !text-2xl">star</span>
                                            <h2 className="text-xl font-bold text-neutral-700 dark:text-white" id="reviews-summary">
                                                {avgRating > 0 ? `${avgRating} · ${totalReviews} đánh giá` : 'Chưa có đánh giá'}
                                            </h2>
                                        </div>

                                        {/* Danh sách reviews */}
                                        {reviews.length > 0 ? (
                                            <div className="flex flex-col gap-6 mb-8">
                                                {reviews.map((review) => (
                                                    <div key={review.id} className="flex gap-4">
                                                        <img
                                                            src={review.user_avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                                                            alt={review.user_name}
                                                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-neutral-700 dark:text-white text-sm">{review.user_name}</span>
                                                                <span className="text-xs text-neutral-400">
                                                                    {new Date(review.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-0.5 mb-2">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <span
                                                                        key={star}
                                                                        className="material-symbols-outlined !text-sm"
                                                                        style={{
                                                                            color: star <= review.rating ? '#f59e0b' : '#d1d5db',
                                                                            fontVariationSettings: `'FILL' ${star <= review.rating ? 1 : 0}`
                                                                        }}
                                                                    >star</span>
                                                                ))}
                                                            </div>
                                                            {review.comment && (
                                                                <p className="text-neutral-600 dark:text-neutral-300 text-sm leading-relaxed">{review.comment}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-neutral-500 dark:text-neutral-300 text-sm mb-8">Chưa có đánh giá nào cho chỗ ở này.</p>
                                        )}

                                    </div>
                                    <div ref={mapSectionRef}>
                                        <h2 className="text-xl font-bold text-neutral-700 dark:text-white mb-4">Vị trí chỗ ở</h2>
                                        <div id="map-embed" className="w-full h-96 rounded-xl overflow-hidden bg-neutral-200">
                                            {property.mapEmbed ? (
                                                <iframe
                                                    src={property.mapEmbed}
                                                    width="100%"
                                                    height="100%"
                                                    style={{ border: 0 }}
                                                    allowFullScreen=""
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer-when-downgrade"
                                                ></iframe>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-neutral-500">
                                                    Không có bản đồ
                                                </div>
                                            )}
                                        </div>
                                        <p className="mt-4 font-bold text-neutral-700 dark:text-white" id="map-location-text">Vị trí
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden lg:block lg:col-span-1">
                                    <div className="sticky top-24">
                                        <div
                                            className="rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-lg p-6 flex flex-col gap-5">
                                            <div className="flex items-baseline gap-1">
                                                <span id="price-display" className="text-2xl font-bold text-neutral-700 dark:text-white">{property.price}</span>
                                                <span className="text-neutral-500 dark:text-neutral-200">/
                                                    đêm</span>
                                            </div>
                                            <div
                                                className="grid grid-cols-2 gap-px border border-neutral-500 dark:border-neutral-200 rounded-lg overflow-hidden">
                                                <div className="p-3 bg-background-light dark:bg-background-dark">
                                                    <label
                                                        className="block text-xs font-bold uppercase text-neutral-700 dark:text-white"
                                                        htmlFor="check-in">Nhận phòng</label>
                                                    <input
                                                        className="w-full border-0 p-0 text-sm bg-transparent focus:ring-0 text-neutral-500 dark:text-neutral-200"
                                                        id="check-in" type="date" value={checkIn} min={today} onChange={handleCheckInChange} />
                                                </div>
                                                <div className="p-3 bg-background-light dark:bg-background-dark">
                                                    <label
                                                        className="block text-xs font-bold uppercase text-neutral-700 dark:text-white"
                                                        htmlFor="check-out">Trả phòng</label>
                                                    <input
                                                        className="w-full border-0 p-0 text-sm bg-transparent focus:ring-0 text-neutral-500 dark:text-neutral-200"
                                                        id="check-out" type="date" value={checkOut} min={checkIn || today} onChange={handleCheckOutChange} />
                                                </div>
                                            </div>
                                            <div className="p-3 border border-neutral-500 dark:border-neutral-200 rounded-lg">
                                                <label
                                                    className="block text-xs font-bold uppercase text-neutral-700 dark:text-white"
                                                    htmlFor="room-type">Loại phòng</label>
                                                <select
                                                    className="w-full border-0 p-0 text-sm bg-transparent focus:ring-0 text-neutral-500 dark:text-neutral-200"
                                                    id="room-type" value={roomType || ''} onChange={(e) => setRoomType(e.target.value)}>
                                                    {rooms.map(r => (
                                                        <option key={r.id} value={r.id}>
                                                            {r.name} — {Number(r.price).toLocaleString('vi-VN')}₫
                                                        </option>
                                                    ))}
                                                    {rooms.length === 0 && <option value="">Không có phòng</option>}
                                                </select>
                                            </div>
                                            {selectedRoom && (
                                                <div className="text-xs text-neutral-500 dark:text-neutral-300 flex flex-wrap gap-3 mt-1">
                                                    {selectedRoom.bed_type && <span>🛏️ {selectedRoom.bed_type}</span>}
                                                    <span>👥 Tối đa {selectedRoom.max_adults} người lớn{selectedRoom.max_children > 0 ? `, ${selectedRoom.max_children} trẻ em` : ''}</span>
                                                </div>
                                            )}
                                            {dateError && (
                                                <p className="text-xs text-red-500">{dateError}</p>
                                            )}
                                            {(!checkIn || !checkOut) ? (
                                                <button
                                                    disabled
                                                    className="flex w-full items-center justify-center rounded-lg h-12 px-6 bg-neutral-300 text-white text-base font-bold cursor-not-allowed"
                                                >
                                                    <span>Chọn ngày để đặt</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleBookNow(false)}
                                                    disabled={isProcessing}
                                                    className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 disabled:bg-primary/60 disabled:cursor-not-allowed">
                                                    {isProcessing ? (
                                                        <div className="flex items-center gap-2">
                                                            <Spinner size="sm" color="white" />
                                                            <span>Đang xử lý...</span>
                                                        </div>
                                                    ) : (
                                                        <span>Đặt ngay</span>
                                                    )}
                                                </button>
                                            )}
                                            <p className="text-center text-sm text-neutral-500 dark:text-neutral-200">
                                                Bạn chưa bị
                                                trừ tiền</p>
                                            <div
                                                className="flex flex-col gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                                                <div className="flex justify-between text-neutral-500 dark:text-neutral-200">
                                                    <span id="price-calculation">{pricePerNight.toLocaleString('vi-VN')}₫ x {nights} đêm</span>
                                                    <span id="price-total-base">{totalBase.toLocaleString('vi-VN')}₫</span>
                                                </div>
                                                <div className="flex justify-between text-neutral-500 dark:text-neutral-200">
                                                    <span>Phí dịch vụ 10%</span>
                                                    <span id="service-fee">{serviceFee.toLocaleString('vi-VN')}₫</span>
                                                </div>
                                            </div>
                                            <div
                                                className="flex justify-between font-bold text-neutral-700 dark:text-white pt-4 border-t border-neutral-200 dark:border-neutral-700">
                                                <span>Tổng cộng</span>
                                                <span id="total-price">{total.toLocaleString('vi-VN')}₫</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Mobile Sticky Booking Bar */}
                <div className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden transform transition-all duration-300 ease-out ${showMobileBookingBar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                    <div className="bg-white/95 backdrop-blur-lg border-t border-neutral-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-bold text-neutral-800">{property.price}</span>
                                    <span className="text-sm text-neutral-500">/ đêm</span>
                                </div>
                                {checkIn && checkOut ? (
                                    <span className="text-xs text-neutral-400">{nights} đêm · Tổng {total.toLocaleString('vi-VN')}₫</span>
                                ) : (
                                    <span className="text-xs text-neutral-400">Chọn ngày để xem giá</span>
                                )}
                            </div>
                            <button
                                onClick={() => handleBookNow(true)}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 active:scale-[0.97] transition-all shadow-lg shadow-primary/25"
                            >
                                <span>{(!checkIn || !checkOut) ? 'Chọn ngay' : 'Đặt ngay'}</span>
                                <span className="material-symbols-outlined !text-lg">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                </div>
                <footer id="about-section" className="bg-charcoal text-white">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-20">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
                            {/*  Brand Column  */}
                            <div className="col-span-2">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="relative w-10 h-10 flex items-center justify-center">
                                        <div className="absolute inset-0 bg-accent rounded-lg transform rotate-45"></div>
                                        <span className="relative text-charcoal font-display font-bold text-lg">A</span>
                                    </div>
                                    <span className="font-display text-xl font-semibold">Aoklevart</span>
                                </div>
                                <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-xs">
                                    Nền tảng đặt phòng nghỉ dưỡng hàng đầu Việt Nam, kết nối bạn với những trải nghiệm lưu trú
                                    độc
                                    đáo và đáng
                                    nhớ.
                                </p>
                                <div className="flex items-center gap-4">
                                    <a href="#"
                                        className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-accent hover:text-charcoal transition-all duration-300">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path
                                                d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                        </svg>
                                    </a>
                                    <a href="#"
                                        className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-accent hover:text-charcoal transition-all duration-300">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path
                                                d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>

                            {/*  Links Columns  */}
                            <div>
                                <h4 className="font-semibold text-white mb-5">Về Aoklevart</h4>
                                <ul className="space-y-3">
                                    <li><a href="about.html"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Giới
                                        thiệu</a></li>
                                    <li><a href="careers.html"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Tuyển
                                        dụng</a></li>
                                    <li><a href="#"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Báo
                                        chí</a>
                                    </li>
                                    <li><a href="#"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Blog</a>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold text-white mb-5">Hỗ trợ</h4>
                                <ul className="space-y-3">
                                    <li><a href="support.html"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Trung
                                        tâm
                                        trợ giúp</a></li>
                                    <li><a href="support.html"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Câu
                                        hỏi
                                        thường gặp</a></li>
                                    <li><a href="support.html"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Liên
                                        hệ</a>
                                    </li>
                                    <li><a href="support.html"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Chính
                                        sách
                                        hủy phòng</a></li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold text-white mb-5">Pháp lý</h4>
                                <ul className="space-y-3">
                                    <li><a href="terms.html"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Điều
                                        khoản
                                        dịch vụ</a></li>
                                    <li><a href="terms.html"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Chính
                                        sách
                                        bảo mật</a></li>
                                    <li><a href="terms.html"
                                        className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Cookie</a>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/*  Bottom Bar  */}
                        <div
                            className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                            <p className="text-white/40 text-sm">© 2024 Aoklevart. Nhóm 8386.</p>
                            <div className="flex items-center gap-6">
                                <span className="text-white/40 text-sm">Ngôn ngữ: Tiếng Việt</span>
                                <span className="text-white/40 text-sm">VND (₫)</span>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>

            <div
                id="gallery-modal"
                className={`fixed inset-0 z-50 bg-black/90 overflow-y-auto ${isGalleryOpen ? '' : 'hidden'}`}
            >
                <div className="min-h-screen flex flex-col items-center justify-center p-4">
                    <div className="fixed top-4 right-4 z-50">
                        <button
                            id="close-gallery-btn"
                            type="button"
                            onClick={handleCloseGallery}
                            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                        >
                            <span className="material-symbols-outlined !text-2xl">close</span>
                        </button>
                    </div>

                    <div className="relative w-full max-w-7xl h-[calc(100vh-2rem)] flex flex-col gap-2">
                        <div
                            id="gallery-main-image-container"
                            className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden"
                        >
                            {galleryImages.length > 0 && (
                                <img
                                    src={galleryImages[activeGalleryIndex]}
                                    alt={`Ảnh ${activeGalleryIndex + 1}`}
                                    className="max-h-full max-w-full object-contain"
                                />
                            )}
                        </div>

                        {galleryImages.length > 1 && (
                            <>
                                <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                                    <button
                                        id="gallery-prev"
                                        type="button"
                                        onClick={handlePrevGallery}
                                        className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors pointer-events-auto"
                                    >
                                        <span className="material-symbols-outlined !text-2xl">chevron_left</span>
                                    </button>
                                    <button
                                        id="gallery-next"
                                        type="button"
                                        onClick={handleNextGallery}
                                        className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors pointer-events-auto"
                                    >
                                        <span className="material-symbols-outlined !text-2xl">chevron_right</span>
                                    </button>
                                </div>
                                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full pointer-events-none">
                                    <span id="gallery-counter">
                                        {activeGalleryIndex + 1} / {galleryImages.length}
                                    </span>
                                </div>
                            </>
                        )}

                        <div
                            id="gallery-thumbnails"
                            className="flex-shrink-0 h-16 flex gap-2 overflow-x-auto py-1 justify-center"
                        >
                            {galleryImages.map((img, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => setActiveGalleryIndex(index)}
                                    className={`h-16 w-24 rounded-md overflow-hidden border ${index === activeGalleryIndex
                                            ? 'border-white'
                                            : 'border-transparent opacity-70 hover:opacity-100'
                                        }`}
                                >
                                    <img src={img} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div
                id="amenities-modal"
                className={`fixed inset-0 z-50 bg-black/50 overflow-y-auto ${isAmenitiesModalOpen ? '' : 'hidden'}`}
            >
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div
                        className="bg-white dark:bg-background-dark w-full max-w-4xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
                            <h2 className="text-xl font-bold text-neutral-700 dark:text-white">Tiện nghi</h2>
                            <button
                                id="close-amenities-btn"
                                type="button"
                                onClick={() => setIsAmenitiesModalOpen(false)}
                                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                            >
                                <span className="material-symbols-outlined text-neutral-700 dark:text-white">close</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div
                                id="amenities-modal-content"
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                            >
                                {amenities.length > 0 ? (
                                    amenities.map((amenity, index) => (
                                        <div key={index} className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-base mt-1">
                                                {amenity.icon || 'check_circle'}
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold text-neutral-700 dark:text-white">
                                                    {amenity.name}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-neutral-500 dark:text-neutral-300 text-sm">
                                        Chưa có thông tin tiện nghi.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Payment Modal - only on mobile */}
            {isMobilePaymentOpen && (() => {
                const isLoggedIn = !!localStorage.getItem('token');

                const discountCodes = {
                    'GIAM10': { type: 'percent', value: 10 },
                    'GIAM20': { type: 'percent', value: 20 },
                    'GIAM50K': { type: 'fixed', value: 50000 },
                    'WELCOME': { type: 'percent', value: 15 }
                };

                const mRooms = Array.isArray(property.rooms) ? property.rooms : [];
                const mSelectedRoom = mRooms.find(r => String(r.id) === String(mobileRoomType)) || mRooms[0];
                let mRoomTypeText = mSelectedRoom ? mSelectedRoom.name : 'Phòng';

                const mPricePerNight = mSelectedRoom ? Number(mSelectedRoom.price) : 0;

                const mCheckInDate = mobileCheckIn ? new Date(mobileCheckIn) : null;
                const mCheckOutDate = mobileCheckOut ? new Date(mobileCheckOut) : null;
                let mNights = 0;
                if (mCheckInDate && mCheckOutDate) {
                    mNights = Math.max(0, Math.ceil((mCheckOutDate - mCheckInDate) / (1000 * 3600 * 24)));
                }
                const mTotalBase = mPricePerNight * mNights;
                const mServiceFee = Math.round(mTotalBase * 0.1);
                const mTotal = mTotalBase + mServiceFee;

                let mDiscountAmount = 0;
                if (appliedDiscount) {
                    mDiscountAmount = appliedDiscount.type === 'percent'
                        ? Math.round(mTotal * (appliedDiscount.value / 100))
                        : appliedDiscount.value;
                }
                const mFinalTotal = mTotal - mDiscountAmount;
                const datesSelected = !!(mobileCheckIn && mobileCheckOut && mNights > 0);

                const formatDateForDB = (date) => {
                    const y = date.getFullYear();
                    const m = (date.getMonth() + 1).toString().padStart(2, '0');
                    const d = date.getDate().toString().padStart(2, '0');
                    return `${y}-${m}-${d}`;
                };

                const handleApplyDiscount = () => {
                    const code = discountCode.trim().toUpperCase();
                    if (!code) { setDiscountMessage({ text: 'Vui lòng nhập mã giảm giá', type: 'error' }); return; }
                    if (discountCodes[code]) {
                        setAppliedDiscount({ code, ...discountCodes[code] });
                        setDiscountMessage({ text: `Áp dụng mã "${code}" thành công!`, type: 'success' });
                        setDiscountCode('');
                    } else {
                        setDiscountMessage({ text: 'Mã giảm giá không hợp lệ', type: 'error' });
                        setAppliedDiscount(null);
                    }
                };

                const getRoomTypeId = () => {
                    return mSelectedRoom ? mSelectedRoom.id : null;
                };

                const handleConfirmPayment = async () => {
                    if (!datesSelected) { setPaymentError('Vui lòng chọn ngày nhận và trả phòng.'); return; }
                    setIsProcessing(true);
                    setPaymentError('');
                    const roomTypeId = getRoomTypeId();
                    if (isLoggedIn) {
                        const token = localStorage.getItem('token');
                        try {
                            const res = await fetch('/api/user/bookings', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({
                                    property_id: property.id, room_type_id: roomTypeId,
                                    check_in: formatDateForDB(new Date(mobileCheckIn)),
                                    check_out: formatDateForDB(new Date(mobileCheckOut)),
                                    number_of_rooms: 1, total_price: mFinalTotal,
                                    special_requests: specialRequests || null,
                                }),
                            });
                            const data = await res.json();
                            setIsProcessing(false);
                            if (res.ok) { setBookingId(data.booking_id); setIsSuccess(true); }
                            else { setPaymentError(data.message || 'Đặt phòng thất bại.'); }
                        } catch { setIsProcessing(false); setPaymentError('Lỗi kết nối máy chủ.'); }
                    } else {
                        if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim()) {
                            setIsProcessing(false); setPaymentError('Vui lòng nhập đầy đủ thông tin.'); return;
                        }
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
                            setIsProcessing(false); setPaymentError('Email không hợp lệ.'); return;
                        }
                        try {
                            const res = await fetch('/api/guest/bookings', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: guestEmail.trim(), phone: guestPhone.trim(), guest_name: guestName.trim(),
                                    property_id: property.id, room_type_id: roomTypeId,
                                    check_in: formatDateForDB(new Date(mobileCheckIn)),
                                    check_out: formatDateForDB(new Date(mobileCheckOut)),
                                    number_of_rooms: 1, total_price: mFinalTotal,
                                    special_requests: specialRequests || null,
                                }),
                            });
                            const data = await res.json();
                            setIsProcessing(false);
                            if (res.ok) {
                                if (data.status === 'confirmed') { setBookingId(data.booking_id); setIsSuccess(true); }
                                else if (data.status === 'pending') { navigate(`/booking-alert?email=${encodeURIComponent(guestEmail.trim())}`); }
                            } else { setPaymentError(data.message || 'Đặt phòng thất bại.'); }
                        } catch { setIsProcessing(false); setPaymentError('Lỗi kết nối máy chủ.'); }
                    }
                };

                return (
                    <div className="fixed inset-0 z-50 lg:hidden" style={{ animation: 'mPayFadeIn 0.2s ease-out' }}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!isProcessing) setIsMobilePaymentOpen(false); }} />

                        {/* Processing overlay */}
                        {isProcessing && (
                            <div className="absolute inset-0 z-[60] flex items-center justify-center">
                                <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
                                    <div className="relative w-12 h-12">
                                        <div className="absolute inset-0 border-4 border-neutral-200 rounded-full" />
                                        <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin" />
                                    </div>
                                    <p className="font-bold text-neutral-700">Đang xử lý...</p>
                                </div>
                            </div>
                        )}

                        {/* Success overlay */}
                        {isSuccess && (
                            <div className="absolute inset-0 z-[60] flex items-center justify-center p-6">
                                <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-5 w-full max-w-sm" style={{ animation: 'mPayScaleIn 0.3s ease-out' }}>
                                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-green-600 !text-5xl">check_circle</span>
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold text-neutral-700 mb-1">Đặt phòng thành công!</h3>
                                        <p className="text-neutral-500 text-sm">Mã đặt phòng: <span className="font-bold text-primary">#{bookingId}</span></p>
                                    </div>
                                    <button onClick={() => navigate('/bookings')} className="w-full py-3 bg-primary text-white rounded-xl font-bold">Xem lịch sử</button>
                                    <button onClick={() => { setIsMobilePaymentOpen(false); setIsSuccess(false); }} className="w-full py-3 border border-neutral-300 text-neutral-700 rounded-xl font-bold">Tiếp tục xem</button>
                                </div>
                            </div>
                        )}

                        {/* Modal panel slides up from bottom */}
                        {!isSuccess && (
                            <div className="absolute inset-x-0 bottom-0 top-12 bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden" style={{ animation: 'mPaySlideUp 0.3s ease-out' }}>
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
                                    <h2 className="text-lg font-bold text-neutral-800">Đặt phòng</h2>
                                    <button onClick={() => { if (!isProcessing) setIsMobilePaymentOpen(false); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 active:bg-neutral-200">
                                        <span className="material-symbols-outlined !text-xl text-neutral-600">close</span>
                                    </button>
                                </div>

                                {/* Scrollable body */}
                                <div className="flex-1 overflow-y-auto px-5 py-5">
                                    <div className="flex flex-col gap-5">

                                        {/* Property card */}
                                        <div className="flex gap-3 p-3 bg-neutral-50 rounded-xl">
                                            <div className="w-20 h-16 rounded-lg bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url(${resolveImageUrl(property.images.main)})` }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-neutral-700 text-sm truncate">{property.name}</p>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="material-symbols-outlined text-accent-gold !text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                                    <span className="text-xs font-bold text-neutral-700">{property.rating}</span>
                                                    <span className="text-xs text-neutral-400">({property.reviews} đánh giá)</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Date pickers */}
                                        <div>
                                            <h3 className="text-sm font-bold text-neutral-700 mb-3">Chọn ngày</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-neutral-500 mb-1">Nhận phòng</label>
                                                    <input type="date" value={mobileCheckIn} min={today}
                                                        onChange={(e) => { setMobileCheckIn(e.target.value); if (mobileCheckOut && e.target.value >= mobileCheckOut) setMobileCheckOut(''); }}
                                                        className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm text-neutral-700 focus:ring-2 focus:ring-primary focus:border-transparent" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-neutral-500 mb-1">Trả phòng</label>
                                                    <input type="date" value={mobileCheckOut} min={mobileCheckIn || today}
                                                        onChange={(e) => setMobileCheckOut(e.target.value)}
                                                        className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm text-neutral-700 focus:ring-2 focus:ring-primary focus:border-transparent" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Room type */}
                                        <div>
                                            <label className="block text-sm font-bold text-neutral-700 mb-2">Loại phòng</label>
                                            <select value={mobileRoomType || ''} onChange={(e) => setMobileRoomType(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm text-neutral-700 focus:ring-2 focus:ring-primary focus:border-transparent">
                                                {mRooms.map(r => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.name} — {Number(r.price).toLocaleString('vi-VN')}₫
                                                    </option>
                                                ))}
                                                {mRooms.length === 0 && <option value="">Không có phòng</option>}
                                            </select>
                                            {mSelectedRoom && (
                                                <div className="text-xs text-neutral-400 flex flex-wrap gap-2 mt-1">
                                                    {mSelectedRoom.bed_type && <span>🛏️ {mSelectedRoom.bed_type}</span>}
                                                    <span>👥 {mSelectedRoom.max_adults} người lớn</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Guest info (not logged in) */}
                                        {!isLoggedIn && (
                                            <div>
                                                <h3 className="text-sm font-bold text-neutral-700 mb-3">Thông tin khách</h3>
                                                <div className="flex flex-col gap-3">
                                                    <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                                                        placeholder="Họ và tên"
                                                        className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:border-transparent" />
                                                    <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)}
                                                        placeholder="Email"
                                                        className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:border-transparent" />
                                                    <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)}
                                                        placeholder="Số điện thoại"
                                                        className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:border-transparent" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Payment method */}
                                        <div>
                                            <h3 className="text-sm font-bold text-neutral-700 mb-3">Phương thức thanh toán</h3>
                                            <div className="flex flex-col gap-2">
                                                <div onClick={() => setPaymentMethod('card')}
                                                    className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between ${paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-neutral-200'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-neutral-600 !text-lg">credit_card</span>
                                                        </div>
                                                        <span className="font-medium text-sm text-neutral-700">Thẻ tín dụng/ghi nợ</span>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'card' ? 'border-primary' : 'border-neutral-300'}`}>
                                                        {paymentMethod === 'card' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                                                    </div>
                                                </div>
                                                <div onClick={() => setPaymentMethod('momo')}
                                                    className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between ${paymentMethod === 'momo' ? 'border-primary bg-primary/5' : 'border-neutral-200'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-lg overflow-hidden border border-neutral-200">
                                                            <img src="/assets/MoMo_Logo_Primary/MOMO-Logo-App.png" alt="MoMo" className="w-full h-full object-contain" />
                                                        </div>
                                                        <span className="font-medium text-sm text-neutral-700">Ví MoMo</span>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'momo' ? 'border-primary' : 'border-neutral-300'}`}>
                                                        {paymentMethod === 'momo' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Discount code */}
                                        <div>
                                            <h3 className="text-sm font-bold text-neutral-700 mb-2">Mã giảm giá</h3>
                                            <div className="flex gap-2">
                                                <input type="text" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                                                    disabled={!!appliedDiscount}
                                                    className="flex-1 px-3 py-2.5 rounded-lg border border-neutral-200 text-sm uppercase placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                                                    placeholder="Nhập mã" />
                                                <button onClick={handleApplyDiscount} disabled={!!appliedDiscount}
                                                    className={`px-4 py-2.5 bg-primary text-white font-bold text-sm rounded-lg ${appliedDiscount ? 'opacity-50' : ''}`}>
                                                    {appliedDiscount ? 'Đã dùng' : 'Áp dụng'}
                                                </button>
                                            </div>
                                            {discountMessage.text && (
                                                <p className={`mt-1.5 text-xs ${discountMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{discountMessage.text}</p>
                                            )}
                                        </div>

                                        {/* Price breakdown */}
                                        {datesSelected && (
                                            <div className="bg-neutral-50 rounded-xl p-4">
                                                <h3 className="text-sm font-bold text-neutral-700 mb-3">Chi tiết giá</h3>
                                                <div className="flex flex-col gap-2 text-sm">
                                                    <div className="flex justify-between text-neutral-500">
                                                        <span>{mPricePerNight.toLocaleString('vi-VN')}₫ × {mNights} đêm</span>
                                                        <span>{mTotalBase.toLocaleString('vi-VN')}₫</span>
                                                    </div>
                                                    <div className="flex justify-between text-neutral-500">
                                                        <span>Phí dịch vụ 10%</span>
                                                        <span>{mServiceFee.toLocaleString('vi-VN')}₫</span>
                                                    </div>
                                                    {appliedDiscount && (
                                                        <div className="flex justify-between text-green-600">
                                                            <span>Giảm giá ({appliedDiscount.code})</span>
                                                            <span>-{mDiscountAmount.toLocaleString('vi-VN')}₫</span>
                                                        </div>
                                                    )}
                                                    <div className="border-t border-neutral-200 pt-2 mt-1">
                                                        <div className="flex justify-between font-bold text-neutral-700">
                                                            <span>Tổng cộng</span>
                                                            <span className="text-primary">{mFinalTotal.toLocaleString('vi-VN')}₫</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Special requests */}
                                        <div>
                                            <h3 className="text-sm font-bold text-neutral-700 mb-2">Yêu cầu đặc biệt</h3>
                                            <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}
                                                placeholder="Nhắn gửi chủ nhà..." rows="2"
                                                className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm resize-none placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:border-transparent" />
                                        </div>

                                        {paymentError && (
                                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <span className="material-symbols-outlined text-red-500 !text-lg">error</span>
                                                <p className="text-sm text-red-600">{paymentError}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-5 py-4 border-t border-neutral-100 bg-white flex-shrink-0">
                                    {datesSelected && (
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm text-neutral-500">{mNights} đêm · {mRoomTypeText}</span>
                                            <span className="text-lg font-bold text-primary">{mFinalTotal.toLocaleString('vi-VN')}₫</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleConfirmPayment}
                                        disabled={isProcessing || !datesSelected}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl h-12 bg-primary text-white text-base font-bold active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined !text-lg">lock</span>
                                        <span>{datesSelected ? 'Xác nhận thanh toán' : 'Chọn ngày để tiếp tục'}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Description Modal Overlay */}
            {isDescriptionModalOpen && (
                <div role="dialog" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 animate-fade-in flex-col">
                    <div className="relative w-full max-w-xl max-h-[90vh] bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-scale-up">
                        <div className="flex items-center border-b border-neutral-100 dark:border-neutral-800 px-6 py-4 shrink-0 justify-between">
                            <h3 className="text-xl font-bold text-neutral-800 dark:text-white">Về chỗ ở này</h3>
                            <button
                                type="button"
                                onClick={() => setIsDescriptionModalOpen(false)}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors"
                            >
                                <span className="material-symbols-outlined !text-xl">close</span>
                            </button>
                        </div>
                        <div className="p-6 md:p-8 overflow-y-auto w-full">
                            <p className="text-neutral-600 dark:text-neutral-300 text-base leading-[1.8] whitespace-pre-line font-medium mb-4">
                                {fullDescription}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes mPayFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes mPaySlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                @keyframes mPayScaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.2s ease-out; }
                .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                .animate-scale-up { animation: scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>

        </div>
    );
}
