import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Lock,
  MapPin,
  Play,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserCheck,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { calculateFinancialBreakdown, formatNairaFromKobo } from '../domain/finance';
import { getOptimizedImageUrl, getOptimizedVideoUrl } from '../lib/cloudinary';

export function LodgeDetailsView() {
  const {
    properties,
    selectedPropertyId,
    setActivePage,
    agents,
    reviews,
    bookings,
    settings,
    currentUser,
    setAuthModalOpen,
    setCheckoutProperty,
    submitPropertyReview,
    reportPropertyOrAgent,
  } = useMarketplace();

  const property =
    properties.find((p) => p.propertyId === selectedPropertyId) || properties[0];

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<'property' | 'agent' | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const touchStartX = useRef<number | null>(null);

  if (!property) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-lg font-semibold text-[#111827]">Lodge not found</p>
        <button
          type="button"
          onClick={() => setActivePage('home')}
          className="px-5 py-3 min-h-[48px] bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-sm font-semibold"
        >
          Back to Marketplace
        </button>
      </div>
    );
  }

  const agent = agents.find((a) => a.agentId === property.agentId || a.ownerUid === property.agentUid);
  const breakdown = calculateFinancialBreakdown(
    property.yearlyRentKobo,
    property.agentCommissionKobo,
    settings
  );
  const propertyReviews = reviews.filter((r) => r.propertyId === property.propertyId);
  const hasConfirmedBookingForUser = Boolean(
    currentUser &&
      bookings.some(
        (b) =>
          b.propertyId === property.propertyId &&
          b.studentUid === currentUser.uid &&
          b.status === 'Settled'
      )
  );
  const hasAnyBookingForUser = Boolean(
    currentUser &&
      bookings.some(
        (b) =>
          b.propertyId === property.propertyId &&
          b.studentUid === currentUser.uid &&
          b.status !== 'Payment Failed' &&
          b.status !== 'Cancelled'
      )
  );

  const photos = property.media.filter((m) => m.type === 'image');
  const safePhotoIdx = Math.min(activePhotoIndex, Math.max(0, photos.length - 1));
  const currentImage = getOptimizedImageUrl(
    photos[safePhotoIdx]?.url || property.coverImageUrl,
    1200
  );

  const isApproved =
    property.lodgeStatus === 'Approved' || property.verificationStatus === 'SUG Verified';
  const isAvailable =
    property.availabilityStatus === 'Available' && property.lodgeStatus !== 'Taken';

  const handlePrevPhoto = () => {
    if (photos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleNextPhoto = () => {
    if (photos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const diff = touchStartX.current - endX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNextPhoto();
      else handlePrevPhoto();
    }
    touchStartX.current = null;
  };

  const handleBookClick = () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    setCheckoutProperty(property);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    const res = submitPropertyReview({
      propertyId: property.propertyId,
      bookingReference: '',
      rating: reviewRating,
      comment: reviewComment,
    });
    if (res.ok) setReviewComment('');
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget || !reportReason.trim()) return;
    reportPropertyOrAgent({
      targetType: reportTarget,
      targetId: reportTarget === 'property' ? property.propertyId : property.agentId,
      targetName: reportTarget === 'property' ? property.title : property.agentName,
      reason: reportReason.trim(),
    });
    setReportTarget(null);
    setReportReason('');
  };

  return (
    <div className="bg-white min-h-screen text-[#111827]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <button
          type="button"
          onClick={() => setActivePage('home')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#16A34A] min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to ABSU Lodges</span>
        </button>

        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-[#111827]">{property.locationArea}, Uturu</span>
              <span aria-hidden="true">·</span>
              <span>{property.category}</span>
              <span aria-hidden="true">·</span>
              <span>{property.availableRooms} rooms available</span>
              <span aria-hidden="true">·</span>
              <span>Last confirmed: {property.lastConfirmedAt.slice(0, 10)}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#111827]">
              {property.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              {isApproved ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                  <ShieldCheck className="w-4 h-4" />
                  <span>SUG Approved Lodge</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  <Lock className="w-4 h-4" />
                  <span>Status: {property.lodgeStatus}</span>
                </div>
              )}
              {property.landlordVerified && (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111827] bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                  <UserCheck className="w-4 h-4 text-[#16A34A]" />
                  <span>Verified Landlord On File</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setReportTarget('property')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report Lodge</span>
            </button>
            <button
              type="button"
              onClick={() => setReportTarget('agent')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report Agent</span>
            </button>
          </div>
        </div>

        {/* Main 2-column content + contiguous booking module */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Swipeable Gallery, Video, Description, Amenities, Privacy, Reviews */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-3">
              <div
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="relative aspect-[16/10] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 select-none"
              >
                <img
                  src={currentImage}
                  alt={property.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />

                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous photo"
                      onClick={handlePrevPhoto}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next photo"
                      onClick={handleNextPhoto}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="absolute bottom-4 left-4 px-2.5 py-1 bg-black/70 text-white text-xs font-mono rounded-lg">
                      {safePhotoIdx + 1} / {photos.length}
                    </span>
                  </>
                )}

                {property.videoTourUrl && (
                  <button
                    type="button"
                    onClick={() => setShowVideoModal(true)}
                    className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-4 py-2.5 bg-[#111827]/90 text-white text-xs font-semibold rounded-xl hover:bg-[#111827]"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Watch Video Walkthrough</span>
                  </button>
                )}
              </div>

              {photos.length > 1 && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {photos.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`aspect-[4/3] rounded-xl overflow-hidden border-2 transition-colors ${
                        safePhotoIdx === idx ? 'border-[#16A34A]' : 'border-slate-200'
                      }`}
                    >
                      <img
                        src={getOptimizedImageUrl(m.url, 320)}
                        alt={m.caption}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-display font-bold text-[#111827]">
                About This Lodge
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed">{property.description}</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-display font-bold text-[#111827]">
                Verified Amenities
              </h2>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {property.amenities.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  >
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy Protection for Landlord & Caretaker Details */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/70">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[#111827] font-display font-bold">
                  <MapPin className="w-4 h-4 text-[#16A34A]" />
                  <span>Location &amp; Landlord Privacy Protection</span>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {property.coordinates.lat.toFixed(4)}°N, {property.coordinates.lng.toFixed(4)}°E
                </span>
              </div>
              <p className="text-sm text-slate-700">
                <strong>Approved Axis:</strong> {property.locationArea}, Uturu
              </p>
              {hasAnyBookingForUser ? (
                <div className="bg-white border border-green-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
                  <p className="font-semibold text-[#15803D]">
                    Inspection Address &amp; Verified Property Contacts Unlocked:
                  </p>
                  <p>
                    <strong>Address:</strong> {property.preciseAddress}
                  </p>
                  <p>
                    <strong>Landlord:</strong> {property.landlordName} ({property.landlordPhone})
                  </p>
                  <p>
                    <strong>Caretaker:</strong> {property.caretakerName} ({property.caretakerPhone})
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <p>
                    Landlord and caretaker phone numbers and exact unit numbers are hidden before booking to prevent off-platform bypass scams and protect property owners. They unlock automatically after booking.
                  </p>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500 mb-3">
                  ABSU Uturu Campus Accommodation Zones
                </p>
                <svg viewBox="0 0 600 170" className="w-full h-36 rounded-lg bg-green-50/50 border border-slate-200">
                  <path d="M 30 105 Q 220 85 360 100 T 570 85" stroke="#94a3b8" strokeWidth="6" fill="none" />
                  <circle cx="110" cy="95" r="9" fill={property.locationArea === 'Okigwe Road' ? '#16A34A' : '#cbd5e1'} />
                  <text x="110" y="128" textAnchor="middle" fontSize="11" fill="#111827">Okigwe Road</text>
                  <circle cx="240" cy="90" r="9" fill={property.locationArea === 'School Gate' ? '#16A34A' : '#cbd5e1'} />
                  <text x="240" y="122" textAnchor="middle" fontSize="11" fill="#111827">School Gate</text>
                  <circle cx="370" cy="70" r="10" fill={property.locationArea === 'ABSU Gate' ? '#16A34A' : '#cbd5e1'} />
                  <text x="370" y="48" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#111827">ABSU Gate</text>
                  <circle cx="500" cy="85" r="9" fill={property.locationArea === 'Uturu' ? '#16A34A' : '#cbd5e1'} />
                  <text x="500" y="118" textAnchor="middle" fontSize="11" fill="#111827">Uturu Axis</text>
                </svg>
              </div>
            </div>

            {/* Verified Student Reviews */}
            <div className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-[#111827]">
                  Verified Student Reviews ({propertyReviews.length})
                </h2>
                <span className="text-xs text-slate-500">
                  Only students who completed physical inspection
                </span>
              </div>

              {propertyReviews.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No verified reviews yet for this lodge.
                </p>
              ) : (
                <div className="space-y-3">
                  {propertyReviews.map((rev) => (
                    <div key={rev.reviewId} className="border border-slate-200 rounded-2xl p-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#111827]">{rev.studentName}</span>
                        <span className="inline-flex items-center gap-1 text-[#15803D] font-mono">
                          <Star className="w-3.5 h-3.5 fill-[#16A34A] text-[#16A34A]" />
                          {rev.rating}.0
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{rev.comment}</p>
                      <p className="text-xs text-slate-400 font-mono">
                        Verified Booking: {rev.bookingReference}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {hasConfirmedBookingForUser && (
                <form onSubmit={handleReviewSubmit} className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50">
                  <p className="text-sm font-semibold text-[#111827]">
                    Leave a Verified Student Review
                  </p>
                  <div className="flex items-center gap-3">
                    <label htmlFor="review-rating" className="text-xs text-slate-600">
                      Rating:
                    </label>
                    <select
                      id="review-rating"
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      {[5, 4, 3, 2, 1].map((r) => (
                        <option key={r} value={r}>
                          {r} Stars
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    required
                    rows={2}
                    placeholder="Share how the physical inspection compared to photos and amenities..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 min-h-[48px] text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
                  >
                    Submit Verified Review
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Contiguous Price Breakdown & Booking Module */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div className="border border-slate-200 rounded-2xl p-6 bg-white space-y-5 shadow-sm">
              <div>
                <p className="text-xs font-semibold text-[#16A34A] uppercase tracking-wide">
                  Transparent Fee Breakdown
                </p>
                <h2 className="text-lg font-display font-bold text-[#111827] mt-1">
                  Pay Booking Fee Now · Pay Rent Direct Later
                </h2>
              </div>

              <dl className="space-y-3 text-sm border-y border-slate-200 py-4">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-600">Annual Rent (Direct to Landlord)</dt>
                  <dd className="font-mono font-semibold text-[#111827] tabular-nums">
                    {formatNairaFromKobo(breakdown.yearlyRentKobo)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-600">Agent Fee</dt>
                  <dd className="font-mono font-semibold text-[#111827] tabular-nums">
                    {formatNairaFromKobo(breakdown.agentCommissionKobo)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-600">Inspection Fee</dt>
                  <dd className="font-mono font-semibold text-[#111827] tabular-nums">
                    {formatNairaFromKobo(breakdown.inspectionFeeKobo)}
                  </dd>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-base">
                  <dt className="font-display font-bold text-[#111827]">
                    Total Booking Fee (Pay Now)
                  </dt>
                  <dd className="font-mono font-bold text-[#16A34A] tabular-nums">
                    {formatNairaFromKobo(breakdown.totalBookingFeeKobo)}
                  </dd>
                </div>
              </dl>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 flex items-start gap-2.5 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="font-medium">
                  Rent is paid DIRECT to the landlord or caretaker after inspection, with a receipt. The agent must never collect rent.
                </p>
              </div>

              {isApproved && isAvailable ? (
                <button
                  type="button"
                  onClick={handleBookClick}
                  className="w-full py-3.5 px-5 min-h-[48px] bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold rounded-xl transition-colors"
                >
                  BOOK LODGE ({formatNairaFromKobo(breakdown.totalBookingFeeKobo)})
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-5 min-h-[48px] bg-slate-200 text-slate-500 text-sm font-bold rounded-xl cursor-not-allowed"
                >
                  {!isApproved ? 'Awaiting SUG Approval' : 'Currently Taken / Unavailable'}
                </button>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                <CalendarCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span>48-hour payment protection hold · Full refund if agent fails inspection.</span>
              </div>
            </div>

            {/* Verified Agent Card */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {agent?.profilePhotoUrl && (
                    <img
                      src={getOptimizedImageUrl(agent.profilePhotoUrl, 120)}
                      alt={agent.fullName}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                  )}
                  <div>
                    <p className="text-sm font-bold text-[#111827]">
                      {agent?.fullName || property.agentName}
                    </p>
                    <p className="text-xs text-slate-500">
                      ABSU Verified Agent · {agent?.operatingArea || property.locationArea}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#15803D] bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                  {agent?.status || 'Approved'}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-200">
                <p>
                  Completed Inspections:{' '}
                  <span className="font-mono font-semibold text-[#111827]">
                    {agent?.completedInspections ?? 0}
                  </span>{' '}
                  · Rating:{' '}
                  <span className="font-mono font-semibold text-[#111827]">
                    {agent?.rating || 'New'} ★
                  </span>
                </p>
                <p>Experience: {agent?.experienceYears ?? 1} years in Uturu</p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Video Tour Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-[#111827]">
                Video Walkthrough — {property.title}
              </h3>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="text-xs font-semibold text-slate-600 hover:text-[#111827] px-3 py-1.5 rounded-lg"
              >
                Close
              </button>
            </div>
            <div className="p-5 space-y-4">
              {property.videoTourUrl &&
              (property.videoTourUrl.startsWith('blob:') ||
                property.videoTourUrl.startsWith('http') ||
                property.videoTourUrl.startsWith('data:')) ? (
                <video
                  controls
                  autoPlay
                  playsInline
                  src={getOptimizedVideoUrl(property.videoTourUrl)}
                  className="w-full aspect-video bg-black rounded-xl"
                />
              ) : (
                <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden flex flex-col items-center justify-center text-white p-6 text-center">
                  <img
                    src={property.coverImageUrl}
                    alt="Video tour preview frame"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover opacity-35"
                  />
                  <div className="relative z-10 space-y-2 max-w-md">
                    <Play className="w-10 h-10 mx-auto text-[#16A34A]" />
                    <p className="text-sm font-semibold">
                      MP4 Walkthrough Preview
                    </p>
                    <p className="text-xs text-slate-200">
                      Walkthrough videos uploaded by agents stream directly via Cloudinary CDN when configured.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleReportSubmit}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200"
          >
            <h3 className="text-lg font-display font-bold text-[#111827]">
              Report {reportTarget === 'property' ? 'Lodge' : 'Agent'} to SUG
            </h3>
            <p className="text-xs text-slate-600">
              Target: {reportTarget === 'property' ? property.title : property.agentName}
            </p>
            <div>
              <label htmlFor="report-reason" className="block text-xs font-medium text-slate-700 mb-1">
                Describe the issue or suspicious conduct
              </label>
              <textarea
                id="report-reason"
                required
                rows={3}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="e.g., Agent demanded extra fee or rent payment before inspection..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="px-4 py-2.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 text-xs font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-800"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
