import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import { SkeletonCard } from '../components/Loader';
export default function Search() {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [priceRange, setPriceRange] = useState(10000000);
    const [propertyType, setPropertyType] = useState('all');
    const [selectedAmenities, setSelectedAmenities] = useState([]);
    const [properties, setProperties] = useState([]);
    const [filteredProperties, setFilteredProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [favoriteIds, setFavoriteIds] = useState([]);

    // Fetch properties from backend
    useEffect(() => {
        const fetchProperties = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/properties');
                if (res.ok) {
                    const data = await res.json();
                    setProperties(data);
                }
            } catch (error) {
                console.error('Error fetching properties:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProperties();
    }, []);

    // Helper: remove Vietnamese diacritics for accent-insensitive search
    const removeDiacritics = (str) => {
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D');
    };

    // Read URL params and set searchQuery state
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const query = params.get('q') || '';
        setSearchQuery(query);
    }, [location.search]);

    // Apply filters whenever ANY filter state changes (including searchQuery and properties)
    useEffect(() => {
        applyFilters(searchQuery, priceRange, propertyType, selectedAmenities);
    }, [searchQuery, priceRange, propertyType, selectedAmenities, properties]);

    const handleSearchClick = () => {
        navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    };

    const applyFilters = (query, price, type, amenities) => {
        setIsSearching(true);
        let results = [...properties];

        // 1. Text Search (accent-insensitive)
        if (query) {
            const normalizedQuery = removeDiacritics(query.toLowerCase());
            results = results.filter(p =>
                removeDiacritics(p.name.toLowerCase()).includes(normalizedQuery) ||
                removeDiacritics(p.location.toLowerCase()).includes(normalizedQuery)
            );
        }

        // 2. Property Type
        if (type !== 'all') {
            results = results.filter(p => p.type === type);
        }

        // 3. Price Filter
        results = results.filter(p => {
            if (price >= 10000000) return true;
            if (p.price === 'Liên hệ') return false;
            const priceValue = parseInt(p.price.replace(/[^\d]/g, ''));
            return !isNaN(priceValue) && priceValue <= price;
        });

        // 4. Amenities Filter
        if (amenities.length > 0) {
            results = results.filter(p => {
                const propAmenities = p.amenities.map(a => a.name.toLowerCase());
                return amenities.every(filterAmenity => {
                    if (filterAmenity === 'wifi') {
                        return propAmenities.some(a => a.includes('wifi'));
                    }
                    if (filterAmenity === 'pool') {
                        return propAmenities.some(a => a.includes('hồ bơi'));
                    }
                    if (filterAmenity === 'parking') {
                        return propAmenities.some(a => a.includes('đậu xe') || a.includes('gửi xe'));
                    }
                    return false;
                });
            });
        }

        setFilteredProperties(results);
        setIsSearching(false);
    };

    const handleAmenityChange = (amenity) => {
        setSelectedAmenities(prev =>
            prev.includes(amenity)
                ? prev.filter(a => a !== amenity)
                : [...prev, amenity]
        );
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setPriceRange(10000000);
        setPropertyType('all');
        setSelectedAmenities([]);
        navigate('/search');
    };

    const formatPrice = (price) => {
        return price.toLocaleString('vi-VN') + 'đ';
    };

    useEffect(() => {
        const loadFavorites = () => {
            const stored = JSON.parse(localStorage.getItem('favoriteProperties') || '[]');
            setFavoriteIds(stored.map((item) => item.id));
        };

        loadFavorites();
        window.addEventListener('favoritesUpdated', loadFavorites);
        return () => window.removeEventListener('favoritesUpdated', loadFavorites);
    }, []);

    const resolveImageUrl = (url) => {
        if (!url) return '';
        return url.startsWith('http') ? url : '/' + url.replace(/^\//, '');
    };

    const toggleFavorite = (property) => {
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
            setFavoriteIds((prev) => prev.filter((id) => id !== property.id));
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
            setFavoriteIds((prev) => [...prev, property.id]);
        }

        localStorage.setItem('favoriteProperties', JSON.stringify(updated));
        window.dispatchEvent(new Event('favoritesUpdated'));
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-neutral-700 dark:text-neutral-100 min-h-screen flex flex-col pt-20">
            <Header />
            <main className="flex-grow py-12">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">

                    {/* Search Bar Section */}
                    <div className="mb-12">
                        <div className="max-w-3xl mx-auto">
                            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg p-2 flex items-center gap-2 border border-neutral-200 dark:border-neutral-700">
                                <div className="flex-grow flex items-center px-4 h-12 bg-neutral-100 dark:bg-neutral-900 rounded-xl">
                                    <span className="material-symbols-outlined text-accent-gold mr-3">search</span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSearchClick()}
                                        placeholder="Tìm kiếm địa điểm..."
                                        className="w-full bg-transparent text-neutral-700 dark:text-neutral-200 placeholder-neutral-400 text-sm font-medium border-none focus:ring-0"
                                    />
                                </div>
                                <button
                                    onClick={handleSearchClick}
                                    className="px-6 h-12 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-all">
                                    Tìm kiếm
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Filter Sidebar */}
                        <div className="lg:col-span-1">
                            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg p-6 sticky top-28 border border-neutral-200 dark:border-neutral-700">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-neutral-700 dark:text-white">Bộ lọc</h3>
                                    <button onClick={handleResetFilters} className="text-sm text-primary font-bold hover:underline">
                                        Đặt lại
                                    </button>
                                </div>

                                {/* Price Range */}
                                <div className="mb-8">
                                    <h4 className="text-sm font-bold text-neutral-700 dark:text-white mb-4">Khoảng giá</h4>
                                    <div className="px-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max="10000000"
                                            step="500000"
                                            value={priceRange}
                                            onChange={(e) => setPriceRange(Number(e.target.value))}
                                            className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <div className="flex justify-between mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                                            <span>0đ</span>
                                            <span>{priceRange >= 10000000 ? '10.000.000đ+' : formatPrice(priceRange)}</span>
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-neutral-200 dark:border-neutral-700 mb-8" />

                                {/* Property Type */}
                                <div className="mb-8">
                                    <h4 className="text-sm font-bold text-neutral-700 dark:text-white mb-4">Loại hình chỗ ở</h4>
                                    <div className="space-y-3">
                                        {[
                                            { id: 'all', label: 'Tất cả' },
                                            { id: 'hotel', label: 'Khách sạn' },
                                            { id: 'apartment', label: 'Căn hộ' },
                                            { id: 'villa', label: 'Biệt thự' },
                                        ].map(type => (
                                            <label key={type.id} className="flex items-center gap-3 cursor-pointer group">
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="property-type"
                                                        value={type.id}
                                                        checked={propertyType === type.id}
                                                        onChange={(e) => setPropertyType(e.target.value)}
                                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-full border border-neutral-300 dark:border-neutral-600 checked:border-primary checked:bg-primary transition-all"
                                                    />
                                                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100">
                                                        <div className="h-2 w-2 rounded-full bg-white"></div>
                                                    </div>
                                                </div>
                                                <span className="text-neutral-700 dark:text-neutral-200 group-hover:text-primary transition-colors">{type.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <hr className="border-neutral-200 dark:border-neutral-700 mb-8" />

                                {/* Amenities */}
                                <div className="mb-8">
                                    <h4 className="text-sm font-bold text-neutral-700 dark:text-white mb-4">Tiện ích</h4>
                                    <div className="space-y-3">
                                        {[
                                            { id: 'wifi', label: 'Wi-Fi' },
                                            { id: 'pool', label: 'Bể bơi' },
                                            { id: 'parking', label: 'Chỗ đỗ xe' },
                                        ].map(amenity => (
                                            <label key={amenity.id} className="flex items-center gap-3 cursor-pointer group">
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        value={amenity.id}
                                                        checked={selectedAmenities.includes(amenity.id)}
                                                        onChange={() => handleAmenityChange(amenity.id)}
                                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-neutral-300 dark:border-neutral-600 checked:border-primary checked:bg-primary transition-all"
                                                    />
                                                    <span className="material-symbols-outlined absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[14px] text-white opacity-0 peer-checked:opacity-100">check</span>
                                                </div>
                                                <span className="text-neutral-700 dark:text-neutral-200 group-hover:text-primary transition-colors">{amenity.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Results Column */}
                        <div className="lg:col-span-3">
                            <div className="mb-8">
                                <h1 className="text-3xl md:text-4xl font-bold text-neutral-700 dark:text-white mb-2">Kết quả tìm kiếm</h1>
                                <p className="text-neutral-500 dark:text-neutral-400">
                                    {loading || isSearching ? 'Đang tìm kiếm...' : `Tìm thấy ${filteredProperties.length} chỗ ở`}
                                </p>
                            </div>

                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {[...Array(6)].map((_, i) => (
                                        <SkeletonCard key={i} />
                                    ))}
                                </div>
                            ) : !isSearching && filteredProperties.length === 0 ? (
                                <div className="text-center py-20 bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700">
                                    <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 rounded-full">
                                        <span className="material-symbols-outlined text-neutral-400 text-4xl">search_off</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-neutral-700 dark:text-white mb-2">Không tìm thấy kết quả</h3>
                                    <p className="text-neutral-500 dark:text-neutral-400">Rất tiếc, chúng tôi không tìm thấy chỗ ở nào phù hợp với yêu cầu của bạn.</p>
                                    <button
                                        onClick={handleResetFilters}
                                        className="mt-6 px-6 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-xl text-sm font-bold text-neutral-700 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
                                        Xóa bộ lọc
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {filteredProperties.map(property => (
                                        <div key={property.id} className="block group">
                                            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col overflow-hidden border border-neutral-200 dark:border-neutral-700 transform hover:-translate-y-1">
                                                <div className="relative h-48 overflow-hidden">
                                                    <Link to={`/details/${property.id}`}>
                                                        <img src={resolveImageUrl(property.images.main)} alt={property.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                    </Link>
                                                    <div className="absolute top-4 right-4 bg-white/90 dark:bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                                        <span className="material-symbols-outlined text-accent-gold !text-sm">star</span>
                                                        <span className="text-sm font-bold text-neutral-700 dark:text-white">{property.rating}</span>
                                                    </div>
                                                    {property.isHot && (
                                                        <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                                            HOT
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            toggleFavorite(property);
                                                        }}
                                                        className={`absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-lg shadow-sm transition-colors ${favoriteIds.includes(property.id)
                                                            ? 'bg-white text-red-500'
                                                            : 'bg-white/90 text-neutral-700 hover:bg-white'
                                                        }`}
                                                    >
                                                        <span
                                                            className="material-symbols-outlined !text-base"
                                                            style={{ fontVariationSettings: `'FILL' ${favoriteIds.includes(property.id) ? 1 : 0}` }}
                                                        >
                                                            favorite
                                                        </span>
                                                        <span className="text-xs font-semibold">
                                                            {favoriteIds.includes(property.id) ? 'Đã lưu' : 'Lưu'}
                                                        </span>
                                                    </button>
                                                </div>
                                                <Link to={`/details/${property.id}`} className="p-5 flex flex-col flex-grow">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="font-bold text-lg text-neutral-700 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">{property.name}</h3>
                                                    </div>
                                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 flex items-center gap-1">
                                                        <span className="material-symbols-outlined !text-sm">location_on</span>
                                                        <span className="line-clamp-1">{property.location}</span>
                                                    </p>
                                                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-700">
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-bold text-primary dark:text-white">{property.price}</span>
                                                            <span className="text-xs text-neutral-500 dark:text-neutral-400">/ đêm</span>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
