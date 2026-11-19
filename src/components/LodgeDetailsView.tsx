import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  Flag,
  Lock,
  MapPin,
  Play,
  ShieldCheck,
  Star,
  UserCheck,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { calculateFinancialBreakdown, formatNairaFromKobo } from '../domain/finance';

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

  if (!property) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-lg font-semibold text-slate-900">Lodge not found</p>
        <button
          type="button"
          onClick={() => setActivePage('home')}
          className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-sm"
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
        (b) => b.propertyId === property.propertyId && b.studentUid === currentUser.uid
      )
  );

  const photos = property.media.filter((m) => m.type === 'image');
  const currentImage = photos[activePhotoIndex]?.url || property.coverImageUrl;

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
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <button
          type="button"
          onClick={() => setActivePage('home')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to ABSU Lodges</span>
        </button>

        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{property.locationArea}</span>
              <span aria-hidden="true">·</span>
              <span>{property.category}</span>
              <span aria-hidden="true">·</span>
              <span>{property.availableRooms} rooms available</span>
              <span aria-hidden="true">·</span>
              <span>Last confirmed: {property.lastConfirmedAt.slice(0, 10)}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
              {property.title}
            </h1>
            {property.verificationStatus === 'SUG Verified' ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <ShieldCheck className="w-4 h-4" />
                <span>SUG Verified Property · Landlord Authorization Checked</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <Lock className="w-4 h-4" />
                <span>Status: {property.verificationStatus} (Not yet SUG Verified for public booking)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setReportTarget('property')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report Property</span>
            </button>
            <button
              type="button"
              onClick={() => setReportTarget('agent')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report Agent</span>
            </button>
          </div>
        </div>

        {/* Main 2-column content + contiguous purchase module */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Gallery, Video, Description, Amenities, Map, Reviews */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-3">
              <div className="relative aspect-[16/10] bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                <img
                  src={currentImage}
                  alt={property.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                {property.videoTourUrl && (
                  <button
                    type="button"
                    onClick={() => setShowVideoModal(true)}
                    className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900/90 text-white text-xs font-semibold rounded-lg hover:bg-slate-900"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Watch Video Tour</span>
                  </button>
                )}
              </div>

              {photos.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {photos.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-colors ${
                        activePhotoIndex === idx ? 'border-emerald-800' : 'border-slate-200'
                      }`}
                    >
                      <img
                        src={m.url}
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
              <h2 className="text-lg font-display font-semibold text-slate-900">
                About This Accommodation
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed">{property.description}</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-display font-semibold text-slate-900">
                Verified Amenities
              </h2>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {property.amenities.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Uturu Location & Privacy Protection */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/70">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-900 font-display font-semibold">
                  <MapPin className="w-4 h-4 text-emerald-800" />
                  <span>Location & Privacy Protection</span>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {property.coordinates.lat.toFixed(4)}°N, {property.coordinates.lng.toFixed(4)}°E
                </span>
              </div>
              <p className="text-sm text-slate-700">
                <strong>Approved Axis:</strong> {property.locationArea}, Uturu
              </p>
              {hasAnyBookingForUser ? (
                <div className="bg-white border border-emerald-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                  <p className="font-semibold text-emerald-900">
                    Precise Inspection Directions Unlocked for Your Booking:
                  </p>
                  <p>{property.preciseAddress}</p>
                  <p className="text-slate-500">
                    Landlord contact ({property.landlordName}) is verified on file by SUG.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  To protect landlord privacy and prevent unauthorized off-platform solicitations, exact house unit directions and landlord phone details unlock once your inspection booking is initialized.
                </p>
              )}

              {/* Campus Uturu Spatial Map */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 mb-3">
                  ABSU Uturu Campus Accommodation Zones
                </p>
                <svg viewBox="0 0 600 180" className="w-full h-36 rounded bg-emerald-50/50 border border-slate-200">
                  <path d="M 30 110 Q 220 90 360 105 T 570 90" stroke="#94a3b8" strokeWidth="6" fill="none" />
                  <circle cx="110" cy="100" r="8" fill={property.locationArea === 'Eke-Okigwe Axis' ? '#065f46' : '#cbd5e1'} />
                  <text x="110" y="130" textAnchor="middle" fontSize="11" fill="#334155">Eke-Okigwe</text>
                  <circle cx="240" cy="95" r="8" fill={property.locationArea === 'School Gate' ? '#065f46' : '#cbd5e1'} />
                  <text x="240" y="125" textAnchor="middle" fontSize="11" fill="#334155">School Gate</text>
                  <circle cx="350" cy="65" r="10" fill={property.locationArea === 'Inside School' ? '#065f46' : '#0f766e'} />
                  <text x="350" y="45" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#064e3b">ABSU Campus / Inside School</text>
                  <circle cx="430" cy="115" r="8" fill={property.locationArea === 'Back Gate' ? '#065f46' : '#cbd5e1'} />
                  <text x="430" y="142" textAnchor="middle" fontSize="11" fill="#334155">Back Gate</text>
                  <circle cx="530" cy="85" r="8" fill={property.locationArea === 'Uturu Main Town' ? '#065f46' : '#cbd5e1'} />
                  <text x="530" y="115" textAnchor="middle" fontSize="11" fill="#334155">Uturu Town</text>
                </svg>
              </div>
            </div>

            {/* Verified Student Reviews */}
            <div className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-semibold text-slate-900">
                  Verified Student Reviews ({propertyReviews.length})
                </h2>
                <span className="text-xs text-slate-500">
                  Reviews allowed only after completed physical inspection
                </span>
              </div>

              {propertyReviews.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No verified reviews yet for this lodge.
                </p>
              ) : (
                <div className="space-y-3">
                  {propertyReviews.map((rev) => (
                    <div key={rev.reviewId} className="border border-slate-200 rounded-lg p-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">{rev.studentName}</span>
                        <span className="inline-flex items-center gap-1 text-emerald-800 font-mono">
                          <Star className="w-3.5 h-3.5 fill-emerald-700" />
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
                <form onSubmit={handleReviewSubmit} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-900">
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
                      className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                  >
                    Submit Verified Review
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Contiguous Price Breakdown & Booking Module */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-5">
              <div>
                <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                  Transparent Checkout Summary
                </p>
                <h2 className="text-lg font-display font-bold text-slate-900 mt-1">
                  Exact Payment Breakdown
                </h2>
              </div>

              <dl className="space-y-3 text-sm border-y border-slate-200 py-4">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-600">Yearly Rent</dt>
                  <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatNairaFromKobo(breakdown.yearlyRentKobo)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-600">Agent Commission</dt>
                  <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatNairaFromKobo(breakdown.agentCommissionKobo)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-600">Inspection Fee (Platform Fixed)</dt>
                  <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatNairaFromKobo(breakdown.inspectionFeeKobo)}
                  </dd>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-base">
                  <dt className="font-display font-bold text-slate-900">Total Payable</dt>
                  <dd className="font-mono font-bold text-emerald-900 tabular-nums">
                    {formatNairaFromKobo(breakdown.totalPayableKobo)}
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-slate-600 leading-relaxed">
                Agents cannot introduce additional charges after payment. The ₦3,000 inspection fee is fixed by SUG policy and tracked separately from rent and commission.
              </p>

              {property.verificationStatus === 'SUG Verified' && property.availabilityStatus === 'Available' ? (
                <button
                  type="button"
                  onClick={handleBookClick}
                  className="w-full py-3 px-4 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900 transition-colors"
                >
                  Book Lodge & Schedule Inspection
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 bg-slate-200 text-slate-500 text-sm font-semibold rounded-lg cursor-not-allowed"
                >
                  {property.verificationStatus !== 'SUG Verified'
                    ? 'Awaiting SUG Verification'
                    : 'Currently Unavailable'}
                </button>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                <CalendarCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Test environment active — no real debit occurs during demonstration.</span>
              </div>
            </div>

            {/* Verified Agent Card */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-800" />
                  <span className="text-sm font-semibold text-slate-900">
                    {agent?.fullName || property.agentName}
                  </span>
                </div>
                <span className="text-xs font-semibold text-emerald-800">
                  {agent?.status || 'Approved'}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <p>ABSU Agent ID: <span className="font-mono">{agent?.absuId || 'ABSU-AGT'}</span></p>
                <p>
                  Completed Inspections: <span className="font-mono tabular-nums">{agent?.completedInspections ?? 0}</span> · Rating:{' '}
                  <span className="font-mono tabular-nums">{agent?.rating || 'New'}</span>
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
          <div className="bg-white rounded-xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-display font-semibold text-slate-900">
                Video Tour — {property.title}
              </h3>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
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
                  src={property.videoTourUrl}
                  className="w-full aspect-video bg-black rounded-lg"
                />
              ) : (
                <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden flex flex-col items-center justify-center text-white p-6 text-center">
                  <img
                    src={property.coverImageUrl}
                    alt="Video tour preview frame"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover opacity-35"
                  />
                  <div className="relative z-10 space-y-2 max-w-md">
                    <Play className="w-10 h-10 mx-auto text-emerald-300" />
                    <p className="text-sm font-semibold">
                      MP4 Walkthrough Clip (Demonstration Preview)
                    </p>
                    <p className="text-xs text-slate-200">
                      In production Supabase Storage, agents upload verified MP4 walkthrough tours up to 25 MB showing entrance, room interior, bathroom, and water supply.
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
            className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 border border-slate-200"
          >
            <h3 className="text-lg font-display font-bold text-slate-900">
              Report {reportTarget === 'property' ? 'Property' : 'Agent'} to SUG
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
                placeholder="e.g., Agent demanded extra fee outside ABSU LodgeSafe..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-800"
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
