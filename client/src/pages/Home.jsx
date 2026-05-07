import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { SkeletonCard } from '../components/Loader';

export default function Home() {
  const navigate = useNavigate();
  const trackRef = useRef(null);
  const containerRef = useRef(null);
  const CLONE_COUNT = 5; // Clone 5 items ở mỗi đầu - đủ lấp viewport
  const CARD_WIDTH = 320;
  const CARD_GAP = 24;
  const SLIDE_WIDTH = CARD_WIDTH + CARD_GAP;
  const TRANSITION_DURATION = 350; // ms

  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState([]);
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [showPromo, setShowPromo] = useState(true);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);

  const POPULAR_LOCATIONS = [
    'Vũng Tàu', 'Hà Nội', 'Đà Lạt', 'Hội An', 'Đà Nẵng',
    'Nha Trang', 'Phú Quốc', 'Sapa', 'Phan Thiết', 'Hạ Long', 'Quy Nhơn', 'Hồ Chí Minh', 'Bà Rịa - Vũng Tàu'
  ];

  const normalizeText = (text) => {
    return text.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase();
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim()) {
      const query = normalizeText(value);
      const filtered = POPULAR_LOCATIONS.filter(loc =>
        normalizeText(loc).includes(query)
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (location) => {
    setSearchQuery(location);
    setShowSuggestions(false);
    navigate(`/search?q=${encodeURIComponent(location)}`);
  };

  const totalRealItems = featuredProperties.length;

  // Tạo mảng: clone CLONE_COUNT items ở mỗi đầu cho seamless infinite loop
  const carouselItems = React.useMemo(() => {
    if (totalRealItems === 0) return [];
    const beforeClones = featuredProperties.slice(-CLONE_COUNT); // 5 items cuối
    const afterClones = featuredProperties.slice(0, CLONE_COUNT); // 5 items đầu
    return [...beforeClones, ...featuredProperties, ...afterClones];
  }, [featuredProperties, totalRealItems]);

  // Index bắt đầu tại CLONE_COUNT (skip qua before-clones)
  const indexRef = useRef(CLONE_COUNT);
  const [renderIndex, setRenderIndex] = useState(CLONE_COUNT);
  const isJumping = useRef(false);

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/properties');
        if (response.ok) {
          const data = await response.json();
          setProperties(data);
          setFeaturedProperties(data.slice(0, 10));
        }
      } catch (error) {
        console.error('Lỗi khi tải danh sách chỗ ở:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, []);

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

  const getPropertyImage = (property) => {
    const resolved = resolveImageUrl(property?.images?.main);
    return resolved || '/assets/thumnails.jpg';
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

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/search');
    }
  };

  // Di chuyển carousel - không chặn click
  const moveTo = useCallback((newIndex, animate = true) => {
    if (totalRealItems === 0) return;
    indexRef.current = newIndex;
    if (trackRef.current) {
      trackRef.current.style.transition = animate
        ? `transform ${TRANSITION_DURATION}ms ease`
        : 'none';
      trackRef.current.style.transform = `translateX(-${newIndex * SLIDE_WIDTH}px)`;
    }
    setRenderIndex(newIndex);
  }, [totalRealItems, SLIDE_WIDTH, TRANSITION_DURATION]);

  // Instant jump (no animation) - dùng khi wrap around
  const jumpTo = useCallback((newIndex) => {
    if (!trackRef.current) return;
    isJumping.current = true;
    indexRef.current = newIndex;
    trackRef.current.style.transition = 'none';
    trackRef.current.style.transform = `translateX(-${newIndex * SLIDE_WIDTH}px)`;
    // Force reflow
    void trackRef.current.offsetHeight;
    setRenderIndex(newIndex);
    // Bật lại transition ở frame tiếp
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (trackRef.current) {
          trackRef.current.style.transition = `transform ${TRANSITION_DURATION}ms ease`;
        }
        isJumping.current = false;
      });
    });
  }, [SLIDE_WIDTH, TRANSITION_DURATION]);

  // Auto-play management - dừng khi hover, chạy khi rời chuột
  const autoPlayRef = useRef(null);
  const isHoveredRef = useRef(false);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  }, []);

  const startAutoPlay = useCallback(() => {
    stopAutoPlay();
    autoPlayRef.current = setInterval(() => {
      // Chỉ auto-play khi KHÔNG hover
      if (totalRealItems === 0 || isHoveredRef.current) return;
      moveTo(indexRef.current + 1);
    }, 4000);
  }, [totalRealItems, moveTo, stopAutoPlay]);

  // Hover handlers - thật sự dừng/bật lại interval
  const handleCarouselMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
    stopAutoPlay(); // Dừng hẳn interval khi hover
  }, [stopAutoPlay]);

  const handleCarouselMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    startAutoPlay(); // Bật lại interval khi rời chuột
  }, [startAutoPlay]);

  // Next slide
  const scrollNext = useCallback(() => {
    if (totalRealItems === 0) return;
    moveTo(indexRef.current + 1);
  }, [totalRealItems, moveTo]);

  // Previous slide
  const scrollPrev = useCallback(() => {
    if (totalRealItems === 0) return;
    moveTo(indexRef.current - 1);
  }, [totalRealItems, moveTo]);

  // Handle transition end - kiểm tra và wrap nếu cần
  const handleTransitionEnd = useCallback(() => {
    if (!trackRef.current || isJumping.current) return;
    const cur = indexRef.current;
    if (cur >= CLONE_COUNT + totalRealItems) {
      jumpTo(cur - totalRealItems);
    } else if (cur < CLONE_COUNT) {
      jumpTo(cur + totalRealItems);
    }
  }, [totalRealItems, jumpTo]);

  // Scroll to specific indicator index
  const scrollToIndex = useCallback((targetIndex) => {
    if (totalRealItems === 0) return;
    moveTo(CLONE_COUNT + targetIndex);
  }, [totalRealItems, moveTo]);

  // Tính activeIndex hiển thị (0 đến totalRealItems - 1)
  const getDisplayIndex = useCallback(() => {
    const real = ((renderIndex - CLONE_COUNT) % totalRealItems + totalRealItems) % totalRealItems;
    return real;
  }, [renderIndex, totalRealItems]);

  // Set initial position
  useEffect(() => {
    if (totalRealItems > 0 && trackRef.current) {
      trackRef.current.style.transition = 'none';
      trackRef.current.style.transform = `translateX(-${CLONE_COUNT * SLIDE_WIDTH}px)`;
      indexRef.current = CLONE_COUNT;
      setRenderIndex(CLONE_COUNT);
    }
  }, [totalRealItems, SLIDE_WIDTH]);

  // Start auto-play khi data sẵn sàng
  useEffect(() => {
    if (totalRealItems === 0) return;
    startAutoPlay();
    return () => stopAutoPlay();
  }, [totalRealItems, startAutoPlay, stopAutoPlay]);

  // Dừng auto-play khi chuyển tab, bật lại khi quay về
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab ẩn → dừng auto-play hoàn toàn
        stopAutoPlay();
      } else {
        // Tab hiện lại → bật auto-play nếu không đang hover
        if (!isHoveredRef.current && totalRealItems > 0) {
          startAutoPlay();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [totalRealItems, startAutoPlay, stopAutoPlay]);



  return (
    <>
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
        {showPromo && (
          <div className="promo-overlay" role="dialog" aria-modal="true">
            <div className="promo-card">
              <button
                type="button"
                className="promo-close"
                aria-label="Đóng thông báo"
                onClick={() => setShowPromo(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="promo-tag">Ưu đãi giới hạn</div>
              <h2 className="promo-title">Ưu đãi 30% cho kì nghỉ hè sảng khoái</h2>
              <p className="promo-subtitle">
                Nhập mã <strong>WELCOME30</strong> khi thanh toán để nhận ưu đãi cho mọi điểm đến trong hôm nay.
              </p>
              <div className="promo-actions">
                <button type="button" className="promo-primary" onClick={() => setShowPromo(false)}>
                  Nhận ưu đãi
                </button>
                <button type="button" className="promo-secondary" onClick={() => setShowPromo(false)}>
                  Để sau
                </button>
              </div>
            </div>
          </div>
        )}

        <Header />

        <main className="flex-grow pt-20">

          {/* Hero Section - Editorial Style */}
          <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden grain-texture">
            {/* Background Image with Overlay */}
            <div className="absolute inset-0">
              <img src="assets/thumnails.jpg" alt="Luxury villa with ocean view" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-charcoal/30 via-charcoal/40 to-charcoal/70"></div>
            </div>

            {/* Hero Content */}
            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center text-white">
              <p className="animate-fade-in-up text-accent-light text-sm uppercase tracking-[0.3em] font-medium mb-6"
                style={{ animationDelay: '0.1s' }}>
                Khám phá Việt Nam
              </p>
              <h1 className="animate-fade-in-up font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.45] mb-6"
                style={{ animationDelay: '0.2s' }}>
                Không gian nghỉ dưỡng
                <span className="block pt-3 pl-4">
                  <span
                    role="button"
                    tabIndex={0}
                    className="italic text-accent-light inline-block select-none align-baseline cursor-pointer"
                  >
                    đẳng cấp
                  </span>{' '}dành cho bạn
                </span>
              </h1>
              <p className="animate-fade-in-up text-lg md:text-xl text-white/80 font-light max-w-2xl mx-auto mb-12"
                style={{ animationDelay: '0.3s' }}>
                Khám phá bộ sưu tập biệt thự, căn hộ cao cấp và homestay độc đáo được tuyển chọn kỹ lưỡng trên khắp Việt
                Nam.
              </p>

              {/* Premium Search Bar */}
              <div className="animate-fade-in-up max-w-4xl mx-auto" style={{ animationDelay: '0.4s' }}>
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-elegant-xl p-2">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    {/* Location */}
                    <div className="md:col-span-9 relative">
                      <div
                        className="flex items-center h-14 px-5 rounded-xl bg-cream/50 hover:bg-cream transition-colors duration-300">
                        <span className="material-symbols-outlined text-accent mr-3">location_on</span>
                        <input type="text" id="home-search-input" placeholder="Bạn muốn đến đâu?"
                          value={searchQuery}
                          onChange={handleSearchChange}
                          onFocus={() => {
                            if (filteredSuggestions.length > 0 && searchQuery.trim()) setShowSuggestions(true);
                          }}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
                          className="search-input w-full bg-transparent text-charcoal placeholder-warm-gray text-sm font-medium border-none focus:ring-0 auto-complete-input"
                          autoComplete="off" />
                      </div>

                      {/* Suggestions Dropdown */}
                      {showSuggestions && filteredSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-neutral-100 overflow-hidden z-20 text-left">
                          {filteredSuggestions.map((loc, idx) => (
                            <div
                              key={idx}
                              className="px-5 py-3 hover:bg-neutral-50 cursor-pointer flex items-center gap-3 transition-colors"
                              onClick={() => handleSuggestionClick(loc)}
                            >
                              <span className="material-symbols-outlined text-warm-gray text-sm">location_city</span>
                              <span className="text-charcoal text-sm font-medium">{loc}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Search Button */}
                    <div className="md:col-span-3">
                      <button id="home-search-btn"
                        onClick={handleSearchSubmit}
                        className="btn-premium flex items-center justify-center w-full h-14 bg-primary rounded-xl text-white hover:bg-primary-light transition-all duration-300 gap-2">
                        <span className="material-symbols-outlined">search</span>
                        <span className="font-medium">Tìm kiếm</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Featured Properties Section */}
          <section id="featured-properties-section" className="py-20 lg:py-28 overflow-visible">
            <div className="max-w-[90rem] mx-auto px-2 md:px-6 lg:px-8">
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
                <div>
                  <p className="text-accent text-sm uppercase tracking-[0.2em] font-medium mb-3">Được yêu thích</p>
                  <h2 className="accent-line font-display text-3xl md:text-4xl font-semibold text-charcoal">
                    Chỗ ở nổi bật
                  </h2>
                </div>
              </div>

              {/* Carousel - hover dừng auto-play */}
              <div
                className="relative group/carousel px-12 md:px-16 overflow-visible"
                onMouseEnter={handleCarouselMouseEnter}
                onMouseLeave={handleCarouselMouseLeave}
              >
                {/* Previous Button */}
                <button
                  onClick={scrollPrev}
                  className="hidden md:flex absolute left-2 top-[45%] -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm shadow-lg items-center justify-center text-charcoal hover:bg-primary hover:text-white hover:scale-110 transition-all duration-300"
                >
                  <span className="material-symbols-outlined text-xl">chevron_left</span>
                </button>

                {/* Track Container */}
                <div ref={containerRef} className="overflow-hidden rounded-xl">
                  <div
                    ref={trackRef}
                    onTransitionEnd={handleTransitionEnd}
                    className="flex gap-6 carousel-track"
                    style={{
                      transform: loading ? 'none' : `translateX(-${CLONE_COUNT * SLIDE_WIDTH}px)`,
                      transition: 'none'
                    }}
                  >
                    {loading ? (
                      [...Array(4)].map((_, i) => (
                        <div key={`skeleton-${i}`} style={{ width: `${CARD_WIDTH}px` }} className="flex-shrink-0">
                          <SkeletonCard />
                        </div>
                      ))
                    ) : carouselItems.map((property, idx) => (
                      <div
                        key={`carousel-${idx}`}
                        className="carousel-card property-card group flex-shrink-0 bg-white rounded-2xl overflow-hidden shadow-elegant hover-lift cursor-pointer transition-all duration-300 select-none flex flex-col"
                        style={{ width: `${CARD_WIDTH}px` }}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden">
                          <Link to={`/details/${property.id}`}>
                            <img
                              src={getPropertyImage(property)}
                              alt={property.name}
                              onError={(event) => {
                                event.currentTarget.src = '/assets/thumnails.jpg';
                              }}
                              className="image-zoom w-full h-full object-cover"
                            />
                          </Link>
                          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                          {property.isHot && (
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-full shadow-sm">
                              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                              <span className="text-xs font-semibold">Hot</span>
                            </div>
                          )}
                          {!property.isHot && property.host && property.host.superhost && (
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-sm">
                              <span className="material-symbols-outlined text-accent text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                              <span className="text-xs font-semibold text-charcoal">Superhost</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavorite(property);
                            }}
                            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors duration-300"
                          >
                            <span
                              className="material-symbols-outlined text-charcoal text-lg"
                              style={{ fontVariationSettings: `'FILL' ${favoriteIds.includes(property.id) ? 1 : 0}` }}
                            >
                              favorite
                            </span>
                          </button>
                        </div>
                        <Link to={`/details/${property.id}`} className="p-5 flex flex-col flex-grow">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-display text-lg font-semibold text-charcoal leading-tight line-clamp-2 min-h-[2.5rem]">{property.name}</h3>
                            <div className="flex items-center gap-1 text-charcoal flex-shrink-0">
                              <span className="material-symbols-outlined text-accent text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                              <span className="text-sm font-semibold">{property.rating}</span>
                            </div>
                          </div>
                          <p className="text-warm-gray text-sm mb-4 truncate">{property.location}</p>
                          <div className="flex items-center justify-between pt-4 border-t border-light-border mt-auto">
                            <div className="flex items-center gap-4 text-warm-gray text-xs">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-base">bed</span> {property.bedrooms}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-base">bathtub</span> {property.bathrooms}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-base">group</span> {property.maxGuests}
                              </span>
                            </div>
                            <p className="text-primary font-semibold whitespace-nowrap">
                              {property.price}<span className="text-warm-gray text-xs font-normal">/đêm</span>
                            </p>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Button */}
                <button
                  onClick={scrollNext}
                  className="hidden md:flex absolute right-2 top-[45%] -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm shadow-lg items-center justify-center text-charcoal hover:bg-primary hover:text-white hover:scale-110 transition-all duration-300"
                >
                  <span className="material-symbols-outlined text-xl">chevron_right</span>
                </button>

                {/* Carousel Indicators */}
                <div className="flex items-center justify-center gap-2 mt-8">
                  <div className="flex gap-1.5">
                    {[...Array(totalRealItems)].map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => scrollToIndex(idx)}
                        className={`carousel-indicator h-2.5 rounded-full transition-all duration-200 cursor-pointer ${idx === getDisplayIndex()
                          ? 'bg-primary w-8 shadow-sm'
                          : 'bg-warm-gray/25 w-2.5 hover:bg-warm-gray/40'
                          }`}
                      ></button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Destinations Section - Magazine Layout */}
          <section id="destinations-section" className="py-20 lg:py-28 bg-white">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              {/* Section Header */}
              <div className="text-center mb-16">
                <p className="text-accent text-sm uppercase tracking-[0.2em] font-medium mb-3">Điểm đến hấp dẫn</p>
                <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-charcoal mb-4">
                  Khám phá vẻ đẹp Việt Nam
                </h2>
                <p className="text-warm-gray text-lg max-w-2xl mx-auto">
                  Từ những đỉnh núi sương mù đến bờ biển trong xanh, mỗi điểm đến đều mang một câu chuyện riêng.
                </p>
              </div>

              {/* Bento Grid Layout */}
              <div className="grid grid-cols-12 gap-4 md:gap-6">
                {/* Large Card - Đà Lạt */}
                <Link to="/search?q=Đà Lạt"
                  className="destination-card col-span-12 md:col-span-7 group relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden cursor-pointer">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0L8bkydJAWJQx57Q7ksAuRbRKUZW-AaThzJqlgXG9ZFj7K_C_egSpOJC0frng8q2pAte29kmGRscuoqw7ZKibcuo1zkX2i824MO-EDhBlFs1ob5lNT-CffvDv1qBFBSUvoFVxE4q7JDXa-3heKSAZQUoznqb9lVQFtL6Xzo7r4IQHyK6qhHhRIbHqHtV0Ki3-ZTXWkJyZ-C93wkZMlWiDk92z_ajZD7FW7NeIHONKeTIgNiShZmggJS5uB8h2nCJvln6JZmUKZh0"
                    alt="Đà Lạt" className="image-zoom w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/20 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <p className="text-accent-light text-sm uppercase tracking-wider mb-2">Lâm Đồng</p>
                    <h3 className="font-display text-3xl md:text-4xl font-semibold text-white mb-3">Đà Lạt</h3>
                    <p className="text-white/80 text-sm max-w-md mb-4 hidden md:block">Thành phố ngàn hoa với khí hậu mát mẻ
                      quanh năm, kiến trúc Pháp cổ kính và những đồi thông bạt ngàn.</p>
                    <div className="flex items-center gap-2 text-white/90">
                      <span className="text-sm font-medium">Khám phá</span>
                      <span
                        className="material-symbols-outlined text-lg transform group-hover:translate-x-1 transition-transform duration-300">arrow_forward</span>
                    </div>
                  </div>
                </Link>

                {/* Stacked Cards - Right Column */}
                <div className="col-span-12 md:col-span-5 flex flex-col gap-4 md:gap-6">
                  {/* Hội An */}
                  <Link to="/search?q=Hội An"
                    className="destination-card group relative h-[200px] md:h-[240px] rounded-2xl overflow-hidden cursor-pointer">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBju5E-lEj3S9JfZf4BuDj5tw5R7zj3UKtKeD92_Ld2HiXYdZaxorGPgL1Wxee_Y8E-31sjSOFIkm9YdMvdDJ2urdGoSFcDFmq2gCJqK3iozAaGyxMGcuVkjbxfyQJpveNeOWHxQkMRyTc-c8TaQvYRorcRE2CSbPu2QkJp3qpeWLEdHRfPXtLFvVvZXQqnOpxprV0IPceLElnK48uA8F30O6q8MCkHcv3_jsqbznqgZCWWY93Ys8qz-0rNLvx6rDijlzTTLM4lMyI"
                      alt="Hội An" className="image-zoom w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/10 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="font-display text-2xl font-semibold text-white mb-1">Hội An</h3>
                      <div className="flex items-center gap-2 text-white/90">
                        <span className="text-sm">Khám phá</span>
                        <span
                          className="material-symbols-outlined text-lg transform group-hover:translate-x-1 transition-transform duration-300">arrow_forward</span>
                      </div>
                    </div>
                  </Link>

                  {/* Sa Pa */}
                  <Link to="/search?q=Sapa"
                    className="destination-card group relative h-[200px] md:h-[240px] rounded-2xl overflow-hidden cursor-pointer">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsmBn1nQdrbUfMUlMj1uxWLEF08mDrd7xq9XKEy_AoCwlB0dzHBDHg5gAMGhGpgy2hGCw5XFrTHsg1B2-wHKEIL6-9WAtZytd0VlBdQpTg5tzTv2r9rdkd5-BqMacj1DH5EZT1iyke0FUIoW3tnkykoGWf0A2E11lbGHB7_XMTrG5GsJues75F9ir1w2_cI2ewqRhYSYdWxRjKaQ1zd-2Vqjpx9BEPkDAH2DV0Se37GsjGFaAkNN8_Z_oCouFYSoSN2mULyq59Q78"
                      alt="Sa Pa" className="image-zoom w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/10 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="font-display text-2xl font-semibold text-white mb-1">Sapa</h3>
                      <div className="flex items-center gap-2 text-white/90">
                        <span className="text-sm">Khám phá</span>
                        <span
                          className="material-symbols-outlined text-lg transform group-hover:translate-x-1 transition-transform duration-300">arrow_forward</span>
                      </div>
                    </div>
                  </Link>
                </div>

                {/* Bottom Row */}
                <Link to="/search?q=Đà Nẵng"
                  className="destination-card col-span-6 md:col-span-4 group relative h-[180px] md:h-[220px] rounded-2xl overflow-hidden cursor-pointer">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7oMe5tRZ5a-pGzlafYvkeRBdHwFT42LKg_hIBOxQBIUMpOwAUs9jg8ZR8Oi14xsh1lojzqWcKlV8BTiTVGb7bbDgWMzxnnBzV-Z5iVWVKPq-gB7A4RK2kLEsxXcggVi6C4Anjt0Zp7lAtO2M_pSp_Y-Lqa_OBdUHxozHyn5WBGAyDBAuBDGCf70TFkG1J0T_kmQSOFIPfCvNwUggTSwG6ieyM6FQb6TJH_BISPxoJ6G_nsnvw38xJJSyplqYdS3sJS6ujV-rT55w"
                    alt="Đà Nẵng" className="image-zoom w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/10 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="font-display text-xl font-semibold text-white mb-1">Đà Nẵng</h3>
                    <div className="flex items-center gap-2 text-white/90">
                      <span className="text-sm font-medium">Khám phá</span>
                      <span
                        className="material-symbols-outlined text-lg transform group-hover:translate-x-1 transition-transform duration-300">arrow_forward</span>
                    </div>
                  </div>
                </Link>

                <Link to="/search?q=Phan Thiết"
                  className="destination-card col-span-6 md:col-span-4 group relative h-[180px] md:h-[220px] rounded-2xl overflow-hidden cursor-pointer">
                  <img src="assets/phan_thiet.png" alt="Phan Thiết" className="image-zoom w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/10 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="font-display text-xl font-semibold text-white mb-1">Phan Thiết</h3>
                    <div className="flex items-center gap-2 text-white/90">
                      <span className="text-sm font-medium">Khám phá</span>
                      <span
                        className="material-symbols-outlined text-lg transform group-hover:translate-x-1 transition-transform duration-300">arrow_forward</span>
                    </div>
                  </div>
                </Link>

                <Link to="/search?q=Nha Trang"
                  className="destination-card col-span-12 md:col-span-4 group relative h-[180px] md:h-[220px] rounded-2xl overflow-hidden cursor-pointer">
                  <img src="assets/nha_trang.png" alt="Nha Trang" className="image-zoom w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/10 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="font-display text-xl font-semibold text-white mb-1">Nha Trang</h3>
                    <div className="flex items-center gap-2 text-white/90">
                      <span className="text-sm font-medium">Khám phá</span>
                      <span
                        className="material-symbols-outlined text-lg transform group-hover:translate-x-1 transition-transform duration-300">arrow_forward</span>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* CTA Section - Premium Style */}
          <section className="py-20 lg:py-28 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary"></div>
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
              <svg viewBox="0 0 400 400" className="w-full h-full">
                <circle cx="200" cy="200" r="150" stroke="white" strokeWidth="1" fill="none" />
                <circle cx="200" cy="200" r="200" stroke="white" strokeWidth="0.5" fill="none" />
                <circle cx="200" cy="200" r="250" stroke="white" strokeWidth="0.3" fill="none" />
              </svg>
            </div>

            <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
              <p className="text-accent-light text-sm uppercase tracking-[0.2em] font-medium mb-4">Trở thành đối tác</p>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-6">
                Chia sẻ không gian của bạn,<br />
                <span className="italic text-accent-light">tạo nên giá trị mới</span>
              </h2>
              <p className="text-white/80 text-lg max-w-2xl mx-auto mb-10">
                Gia nhập cộng đồng hàng nghìn chủ nhà trên Aoklevart và bắt đầu hành trình kinh doanh nghỉ dưỡng của bạn với
                sự hỗ trợ chuyên nghiệp.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="household.html"
                  className="btn-premium px-8 py-4 bg-accent text-charcoal text-base font-semibold rounded-xl hover:bg-accent-light transition-all duration-300 shadow-elegant">
                  Bắt đầu cho thuê
                </a>
                <a href="household.html"
                  className="px-8 py-4 text-white text-base font-medium rounded-xl border border-white/30 hover:bg-white/10 transition-all duration-300">
                  Tìm hiểu thêm
                </a>
              </div>
            </div>
          </section>

          {/* Trust Section */}
          <section className="py-20 lg:py-24 bg-cream">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-primary/10 rounded-2xl">
                    <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold text-charcoal mb-3">Đảm bảo an toàn</h3>
                  <p className="text-warm-gray">Tất cả chỗ ở được xác minh kỹ lưỡng với tiêu chuẩn chất lượng cao nhất.</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-primary/10 rounded-2xl">
                    <span className="material-symbols-outlined text-primary text-3xl">support_agent</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold text-charcoal mb-3">Hỗ trợ 24/7</h3>
                  <p className="text-warm-gray">Đội ngũ chăm sóc khách hàng luôn sẵn sàng hỗ trợ bạn mọi lúc, mọi nơi.</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-primary/10 rounded-2xl">
                    <span className="material-symbols-outlined text-primary text-3xl">payments</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold text-charcoal mb-3">Thanh toán linh hoạt</h3>
                  <p className="text-warm-gray">Đa dạng phương thức thanh toán an toàn và chính sách hủy phòng linh hoạt.</p>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Premium Footer */}
        <footer id="about-section" className="bg-charcoal text-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
              {/* Brand Column */}
              <div className="col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <div className="absolute inset-0 bg-accent rounded-lg transform rotate-45"></div>
                    <span className="relative text-charcoal font-display font-bold text-lg">A</span>
                  </div>
                  <span className="font-display text-xl font-semibold">Aoklevart</span>
                </div>
                <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-xs">
                  Nền tảng đặt phòng nghỉ dưỡng hàng đầu Việt Nam, kết nối bạn với những trải nghiệm lưu trú độc đáo và đáng
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
                  <a href="#"
                    className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-accent hover:text-charcoal transition-all duration-300">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Links Columns */}
              <div>
                <h4 className="font-semibold text-white mb-5">Về Aoklevart</h4>
                <ul className="space-y-3">
                  <li><a href="about.html"
                    className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Giới
                    thiệu</a></li>
                  <li><a href="careers.html"
                    className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Tuyển
                    dụng</a></li>
                  <li><a href="#" className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Báo chí</a>
                  </li>
                  <li><a href="#" className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Blog</a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-5">Hỗ trợ</h4>
                <ul className="space-y-3">
                  <li><a href="support.html"
                    className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Trung tâm
                    trợ giúp</a></li>
                  <li><a href="support.html"
                    className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Câu hỏi
                    thường gặp</a></li>
                  <li><a href="support.html"
                    className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Liên hệ</a>
                  </li>
                  <li><a href="support.html"
                    className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Chính sách
                    hủy phòng</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-5">Pháp lý</h4>
                <ul className="space-y-3">
                  <li><a href="terms.html"
                    className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Điều khoản
                    dịch vụ</a></li>
                  <li><a href="terms.html"
                    className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Chính sách
                    bảo mật</a></li>
                  <li><a href="terms.html"
                    className="text-white/60 text-sm hover:text-accent transition-colors duration-300">Cookie</a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-white/40 text-sm">© 2024 Aoklevart. Nhóm 8386.</p>
              <div className="flex items-center gap-6">
                <span className="text-white/40 text-sm">Ngôn ngữ: Tiếng Việt</span>
                <span className="text-white/40 text-sm">VND (₫)</span>
              </div>

            </div>
          </div>
        </footer>


      </div>
    </>
  );
}
