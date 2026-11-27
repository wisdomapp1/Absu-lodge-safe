import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Film,
  ImagePlus,
  LogOut,
  MessageCircle,
  PhoneCall,
  PlusCircle,
  RefreshCw,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatNairaFromKobo } from '../domain/finance';
import { getUnreadNotificationsCount } from '../domain/notifications';
import {
  ALLOWED_AGENT_FEES_NAIRA,
  LocationArea,
  LodgeStatus,
  PropertyCategory,
} from '../domain/types';
import {
  buildAgentWhatsAppLink,
  detectSuspiciousListingDescription,
  validateMediaUpload,
} from '../domain/validation';
import { isCloudinaryConfigured, uploadFileToCloudinary } from '../lib/cloudinary';

type AgentTab = 'lodges' | 'alerts' | 'earnings' | 'profile';

interface UploadedMediaDraft {
  type: 'image' | 'video';
  name: string;
  previewUrl?: string;
  cloudinaryPublicId?: string;
  sizeBytes: number;
  status: 'uploading' | 'ready' | 'failed';
  error?: string;
  rawFile?: File;
}

const LOCATION_OPTIONS: LocationArea[] = ['Uturu', 'School Gate', 'ABSU Gate', 'Okigwe Road'];
const ROOM_TYPE_OPTIONS: PropertyCategory[] = [
  'Self Contain',
  'Single Room',
  '2 Bedroom',
  '3 Bedroom',
  'Face Me I Face You',
];

export function AgentDashboard() {
  const {
    currentUser,
    agents,
    properties,
    bookings,
    settlements,
    notifications,
    setActivePage,
    submitNewLodge,
    toggleLodgeAvailability,
    logoutUser,
    showToast,
  } = useMarketplace();

  const [tab, setTab] = useState<AgentTab>('lodges');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add Lodge Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PropertyCategory>('Self Contain');
  const [locationArea, setLocationArea] = useState<LocationArea>('Uturu');
  const [preciseAddress, setPreciseAddress] = useState('');
  const [yearlyRentNaira, setYearlyRentNaira] = useState('200000');
  const [agentCommissionNaira, setAgentCommissionNaira] = useState<number>(20000);
  const [availableRooms, setAvailableRooms] = useState('3');
  const [description, setDescription] = useState('');
  const [amenitiesText, setAmenitiesText] = useState(
    '24/7 Borehole Water, Gated Compound, Prepaid Meter'
  );
  const [landlordName, setLandlordName] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [caretakerName, setCaretakerName] = useState('');
  const [caretakerPhone, setCaretakerPhone] = useState('');
  const [landlordDoc, setLandlordDoc] = useState('Signed_Landlord_Authorization.pdf');
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMediaDraft[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  if (!currentUser || currentUser.role !== 'agent') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[#111827]">Agent Portal Access</h1>
        <p className="text-sm text-slate-600">
          Sign in as a verified ABSU Lodge agent to manage lodges, inspection alerts, and 40% share earnings.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('home')}
          className="px-5 py-3 min-h-[48px] text-sm font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  const agentProfile = agents.find((a) => a.ownerUid === currentUser.uid) || {
    agentId: 'pending',
    ownerUid: currentUser.uid,
    fullName: currentUser.fullName,
    phone: currentUser.phone,
    whatsappNumber: currentUser.whatsappNumber || currentUser.phone,
    email: currentUser.email,
    absuId: 'Pending',
    ninLast4: '----',
    operatingArea: 'Uturu' as LocationArea,
    idDocumentName: 'Pending',
    profilePhotoUrl: '',
    bankName: 'Pending',
    accountNumber: 'Pending',
    accountName: currentUser.fullName,
    emergencyContact: 'Pending',
    experienceYears: 1,
    status: 'Pending Approval' as const,
    rating: 0,
    completedInspections: 0,
    complaintsCount: 0,
    createdAt: currentUser.createdAt,
  };

  const myLodges = useMemo(
    () => properties.filter((p) => p.agentUid === currentUser.uid),
    [properties, currentUser.uid]
  );
  const myBookings = useMemo(
    () => bookings.filter((b) => b.agentUid === currentUser.uid),
    [bookings, currentUser.uid]
  );
  const myBookingIds = useMemo(() => new Set(myBookings.map((b) => b.bookingId)), [myBookings]);
  const myAgentTransfers = useMemo(
    () =>
      settlements.filter(
        (s) => s.recipientType === 'agent' && myBookingIds.has(s.bookingId)
      ),
    [settlements, myBookingIds]
  );
  const unreadAlertsCount = useMemo(
    () => getUnreadNotificationsCount(notifications, currentUser.uid),
    [notifications, currentUser.uid]
  );

  // 40% Agent Share ledger (Strictly separated: Pending 48h Hold vs Available vs Total)
  const earningsStats = useMemo(() => {
    let pending48hHoldKobo = 0;
    let availableBalanceKobo = 0;
    let totalEarnedKobo = 0;
    let refundFrozenKobo = 0;

    for (const bk of myBookings) {
      if (bk.status === 'Pending Payment' || bk.status === 'Payment Failed' || bk.status === 'Cancelled') {
        continue;
      }
      if (bk.status === 'Refunded' || bk.paymentHoldStatus === 'refunded') {
        continue;
      }
      if (bk.paymentHoldStatus === 'refund_pending' || bk.status === 'Under SUG Review') {
        refundFrozenKobo += bk.breakdown.agentEarningsKobo;
        continue;
      }
      if (bk.paymentHoldStatus === 'settled' || bk.status === 'Settled') {
        availableBalanceKobo += bk.breakdown.agentEarningsKobo;
        totalEarnedKobo += bk.breakdown.agentEarningsKobo;
      } else {
        pending48hHoldKobo += bk.breakdown.agentEarningsKobo;
        totalEarnedKobo += bk.breakdown.agentEarningsKobo;
      }
    }

    return {
      pending48hHoldKobo,
      availableBalanceKobo,
      totalEarnedKobo,
      refundFrozenKobo,
    };
  }, [myBookings]);

  const descriptionWarning = useMemo(
    () => detectSuspiciousListingDescription(description),
    [description]
  );

  const cloudinaryEnabled = isCloudinaryConfigured();

  const processSingleMediaUpload = async (
    file: File,
    kind: 'image' | 'video',
    targetName: string
  ) => {
    if (!cloudinaryEnabled) {
      return;
    }
    try {
      const result = await uploadFileToCloudinary(file, kind, (pct) => setUploadProgress(pct));
      setUploadedMedia((prev) =>
        prev.map((m) =>
          m.name === targetName
            ? {
                ...m,
                previewUrl: result.secureUrl,
                cloudinaryPublicId: result.publicId,
                status: 'ready',
                error: undefined,
              }
            : m
        )
      );
    } catch (err: any) {
      setUploadedMedia((prev) =>
        prev.map((m) =>
          m.name === targetName
            ? {
                ...m,
                status: 'failed',
                error: err?.message || 'Cloudinary upload failed.',
              }
            : m
        )
      );
      showToast('error', `Upload failed for ${targetName}. Click Retry to re-upload.`);
    }
  };

  const handleImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentImages = uploadedMedia.filter((m) => m.type === 'image');
    const currentVideos = uploadedMedia.filter((m) => m.type === 'video');
    const nextImages = [...currentImages];

    for (const file of files) {
      const check = validateMediaUpload({ name: file.name, type: file.type, size: file.size });
      if (!check.valid || check.kind !== 'image') {
        showToast('error', check.error || `${file.name} must be JPG/PNG/WebP (≤ 5MB).`);
        continue;
      }
      if (nextImages.length >= 6) {
        showToast('info', 'Maximum 6 photos allowed per lodge.');
        break;
      }
      const item: UploadedMediaDraft = {
        type: 'image',
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        sizeBytes: file.size,
        status: cloudinaryEnabled ? 'uploading' : 'ready',
        rawFile: file,
      };
      nextImages.push(item);
      if (cloudinaryEnabled) {
        processSingleMediaUpload(file, 'image', file.name);
      }
    }

    setUploadedMedia([...nextImages.slice(0, 6), ...currentVideos]);
    setUploadProgress(100);
    e.target.value = '';
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateMediaUpload({ name: file.name, type: file.type, size: file.size });
    if (!check.valid || check.kind !== 'video') {
      showToast('error', check.error || `${file.name} must be MP4/MOV/WebM (≤ 25MB).`);
      e.target.value = '';
      return;
    }
    const currentImages = uploadedMedia.filter((m) => m.type === 'image');
    const videoItem: UploadedMediaDraft = {
      type: 'video',
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      sizeBytes: file.size,
      status: cloudinaryEnabled ? 'uploading' : 'ready',
      rawFile: file,
    };
    setUploadedMedia([...currentImages, videoItem]);
    if (cloudinaryEnabled) {
      processSingleMediaUpload(file, 'video', file.name);
    } else {
      setUploadProgress(100);
    }
    e.target.value = '';
  };

  const retryFailedMedia = (item: UploadedMediaDraft) => {
    if (!item.rawFile) return;
    setUploadedMedia((prev) =>
      prev.map((m) => (m.name === item.name ? { ...m, status: 'uploading', error: undefined } : m))
    );
    processSingleMediaUpload(item.rawFile, item.type, item.name);
  };

  const removeMediaByName = (name: string) => {
    setUploadedMedia((prev) => prev.filter((m) => m.name !== name));
  };

  const submitLodgeForm = (saveAsDraft: boolean) => {
    const res = submitNewLodge({
      title,
      category,
      locationArea,
      preciseAddress,
      yearlyRentNaira: Number(yearlyRentNaira),
      agentCommissionNaira,
      availableRooms: Number(availableRooms),
      description,
      amenities: amenitiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      landlordName,
      landlordPhone,
      caretakerName,
      caretakerPhone,
      landlordAuthorizationDoc: landlordDoc,
      saveAsDraft,
      mediaNames: uploadedMedia.map((m) => ({
        type: m.type,
        name: m.name,
        previewUrl: m.previewUrl,
        cloudinaryPublicId: m.cloudinaryPublicId,
        sizeBytes: m.sizeBytes,
      })),
    });

    if (!res.ok) {
      showToast('error', res.error || 'Failed to submit lodge.');
      return;
    }

    setTitle('');
    setPreciseAddress('');
    setDescription('');
    setLandlordName('');
    setLandlordPhone('');
    setCaretakerName('');
    setCaretakerPhone('');
    setUploadedMedia([]);
    setUploadProgress(0);
    setShowAddForm(false);
  };

  const is2HourReminderDue = (dateStr: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today;
  };

  const images = uploadedMedia.filter((m) => m.type === 'image');
  const videoItem = uploadedMedia.find((m) => m.type === 'video');
  const netAgentPreviewNaira = Math.round(agentCommissionNaira * 0.4);

  const navTabs: { id: AgentTab; label: string; icon: React.ReactNode }[] = [
    { id: 'lodges', label: 'My Lodges', icon: <Building2 className="w-4 h-4" /> },
    {
      id: 'alerts',
      label: unreadAlertsCount > 0 ? `Booking Alerts (${unreadAlertsCount})` : 'Booking Alerts',
      icon: <Bell className="w-4 h-4" />,
    },
    { id: 'earnings', label: 'My Earnings', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-slate-50 min-h-screen text-[#111827]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Top Agent Workspace Header with Strictly 4 Tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#16A34A]">
                Verified Agent Workspace · {agentProfile.operatingArea}
              </p>
              <h1 className="text-2xl font-display font-bold text-[#111827] mt-0.5">
                {agentProfile.fullName}
              </h1>
              <p className="text-xs font-semibold mt-1 text-slate-600">
                Account Status:{' '}
                <span
                  className={
                    agentProfile.status === 'Approved' ? 'text-[#15803D]' : 'text-amber-700'
                  }
                >
                  {agentProfile.status}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={logoutUser}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 self-start"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-slate-100 pt-4">
            {navTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setShowAddForm(false);
                }}
                className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-colors ${
                  tab === t.id
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {agentProfile.status !== 'Approved' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950">
            <strong>Approval Gate:</strong> Your account is <strong>{agentProfile.status}</strong>. Super Admin must approve your NIN &amp; bank KYC before your lodges go live.
          </div>
        )}

        {/* TAB 1: MY LODGES (with Add New Lodge sub-form) */}
        {tab === 'lodges' && !showAddForm && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-display font-bold text-[#111827]">My Lodges</h2>
                <p className="text-xs text-slate-500">
                  Statuses: Draft, Pending, Approved, Rejected, Booked, Taken
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add New Lodge</span>
              </button>
            </div>

            {myLodges.length === 0 ? (
              <p className="text-sm text-slate-500">No lodges uploaded yet.</p>
            ) : (
              <div className="space-y-4">
                {myLodges.map((p) => (
                  <div
                    key={p.propertyId}
                    className="border border-slate-200 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex gap-3.5">
                        <img
                          src={p.coverImageUrl}
                          alt={p.title}
                          className="w-20 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-[#111827]">{p.locationArea}</span>
                            <span>·</span>
                            <span className="text-slate-600">{p.category}</span>
                            <span>·</span>
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full ${
                                p.lodgeStatus === 'Approved'
                                  ? 'bg-green-50 text-[#15803D]'
                                  : p.lodgeStatus === 'Rejected'
                                  ? 'bg-rose-50 text-rose-700'
                                  : p.lodgeStatus === 'Taken' || p.lodgeStatus === 'Booked'
                                  ? 'bg-slate-200 text-slate-800'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {p.lodgeStatus}
                            </span>
                          </div>
                          <p className="text-base font-bold text-[#111827]">{p.title}</p>
                          <p className="text-xs font-mono text-slate-600 tabular-nums">
                            Rent: {formatNairaFromKobo(p.yearlyRentKobo)} · Agent Fee:{' '}
                            {formatNairaFromKobo(p.agentCommissionKobo)} · Rooms: {p.availableRooms}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 shrink-0">
                        {p.lodgeStatus === 'Draft' && (
                          <button
                            type="button"
                            onClick={() => toggleLodgeAvailability(p.propertyId, 'Pending')}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#16A34A] rounded-xl"
                          >
                            Submit for Approval
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            toggleLodgeAvailability(
                              p.propertyId,
                              p.lodgeStatus === 'Taken' ? 'Approved' : ('Taken' as LodgeStatus)
                            )
                          }
                          className="px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
                        >
                          {p.lodgeStatus === 'Taken' || p.availabilityStatus === 'Unavailable'
                            ? 'Mark Available'
                            : 'Mark Taken'}
                        </button>
                      </div>
                    </div>

                    {p.lodgeStatus === 'Rejected' && p.rejectionReason && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900">
                        <strong>SUG Rejection Reason:</strong> {p.rejectionReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD LODGE FORM */}
        {tab === 'lodges' && showAddForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitLodgeForm(false);
            }}
            className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-display font-bold text-[#111827]">
                  Add New Lodge (3–6 Photos + Optional Video)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Annual rent is paid directly to the landlord after inspection. Choose one SUG-approved Agent Fee tier below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl"
              >
                Back to My Lodges
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Lodge Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Victory Scholars Lodge — Self Contain"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Room Type</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PropertyCategory)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  {ROOM_TYPE_OPTIONS.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                <select
                  value={locationArea}
                  onChange={(e) => setLocationArea(e.target.value as LocationArea)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  {LOCATION_OPTIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Available Rooms
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  required
                  value={availableRooms}
                  onChange={(e) => setAvailableRooms(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Annual Rent Paid Direct to Landlord (₦)
                </label>
                <input
                  type="number"
                  min={10000}
                  required
                  value={yearlyRentNaira}
                  onChange={(e) => setYearlyRentNaira(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Agent Fee (Your 40% Net Share: ₦{netAgentPreviewNaira.toLocaleString()})
                </label>
                <select
                  value={agentCommissionNaira}
                  onChange={(e) => setAgentCommissionNaira(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl bg-white"
                >
                  {ALLOWED_AGENT_FEES_NAIRA.map((fee) => (
                    <option key={fee} value={fee}>
                      ₦{fee.toLocaleString()} (You earn ₦{(fee * 0.4).toLocaleString()} after 48h)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Precise Lodge Address (Hidden until booked)
              </label>
              <input
                required
                value={preciseAddress}
                onChange={(e) => setPreciseAddress(e.target.value)}
                placeholder="Plot & street name in Uturu..."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Lodge Description (Do NOT include payment links, bank account numbers, or rent collection requests)
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
              />
              {descriptionWarning.flagged && (
                <div className="mt-2 bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Warning: {descriptionWarning.reason}. Remove links/account numbers before submitting.
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amenities (comma-separated)
              </label>
              <input
                value={amenitiesText}
                onChange={(e) => setAmenitiesText(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
              />
            </div>

            {/* Mandatory Landlord & Caretaker Details */}
            <div className="grid sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Landlord Full Name (Mandatory)
                </label>
                <input
                  required
                  value={landlordName}
                  onChange={(e) => setLandlordName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Landlord Phone (Mandatory)
                </label>
                <input
                  required
                  value={landlordPhone}
                  onChange={(e) => setLandlordPhone(e.target.value)}
                  placeholder="+234 80..."
                  className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Caretaker Full Name (Mandatory)
                </label>
                <input
                  required
                  value={caretakerName}
                  onChange={(e) => setCaretakerName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Caretaker Phone (Mandatory)
                </label>
                <input
                  required
                  value={caretakerPhone}
                  onChange={(e) => setCaretakerPhone(e.target.value)}
                  placeholder="+234 80..."
                  className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Landlord Authorization Document Reference
                </label>
                <input
                  required
                  value={landlordDoc}
                  onChange={(e) => setLandlordDoc(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* Cloudinary Media Upload & Pre-Post Preview (3–6 photos + optional 1 video) */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-display font-bold text-[#111827]">
                    Lodge Photos (3–6) &amp; Optional Video (max 1)
                  </h3>
                  <p className="text-xs text-slate-600">
                    {cloudinaryEnabled
                      ? 'Direct Cloudinary upload active with automatic optimization.'
                      : 'Local preview mode (configure VITE_CLOUDINARY_CLOUD_NAME & VITE_CLOUDINARY_UPLOAD_PRESET for live CDN).'}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#16A34A]">
                  Photos: {images.length}/6 (min 3) · Video: {videoItem ? '1/1' : '0/1'}
                </span>
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#16A34A] h-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-[#111827] hover:border-[#16A34A] cursor-pointer">
                  <ImagePlus className="w-4 h-4 text-[#16A34A]" />
                  <span>Upload Photos (3–6)</span>
                  <input
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleImagesChange}
                    className="hidden"
                  />
                </label>

                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-[#111827] hover:border-[#16A34A] cursor-pointer">
                  <Film className="w-4 h-4 text-[#16A34A]" />
                  <span>{videoItem ? 'Replace Video' : 'Upload Optional Video (Max 1)'}</span>
                  <input
                    type="file"
                    accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                    onChange={handleVideoChange}
                    className="hidden"
                  />
                </label>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img) => (
                    <div
                      key={img.name}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                    >
                      <div className="relative aspect-[4/3] bg-slate-100">
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeMediaByName(img.name)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2">
                        <span className="truncate">{img.name}</span>
                        {img.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => retryFailedMedia(img)}
                            className="inline-flex items-center gap-1 text-rose-700 font-bold shrink-0"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {videoItem && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <video controls playsInline src={videoItem.previewUrl} className="w-full max-h-56 bg-black" />
                  <div className="px-3.5 py-2 flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{videoItem.name}</span>
                    <div className="flex items-center gap-3">
                      {videoItem.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => retryFailedMedia(videoItem)}
                          className="text-rose-700 font-bold"
                        >
                          Retry Upload
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMediaByName(videoItem.name)}
                        className="text-rose-700 font-semibold"
                      >
                        Remove Video
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold rounded-xl"
              >
                <Upload className="w-4 h-4" />
                <span>Submit Lodge for SUG Approval</span>
              </button>
              <button
                type="button"
                onClick={() => submitLodgeForm(true)}
                className="min-h-[48px] px-5 py-3 border border-slate-300 text-slate-800 text-sm font-semibold rounded-xl hover:bg-slate-50"
              >
                Save as Draft
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: BOOKING ALERTS */}
        {tab === 'alerts' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-[#111827]">
              Booking Alerts &amp; Inspection Coordination
            </h2>
            {myBookings.length === 0 ? (
              <p className="text-sm text-slate-500">No student inspection bookings yet.</p>
            ) : (
              <div className="space-y-4">
                {myBookings.map((bk) => {
                  const studentPhone = bk.inspectionContact?.phoneNumber || bk.studentPhone || '+2348034128890';
                  const studentWa = bk.inspectionContact?.whatsappOrAltPhone || studentPhone;
                  const timeWindow =
                    bk.inspectionContact?.preferredTimeSlot || bk.inspectionTimeSlot || 'Morning: 9am–12pm';
                  const reminderDue = is2HourReminderDue(bk.inspectionDate);

                  return (
                    <div
                      key={bk.bookingId}
                      className="border border-slate-200 rounded-2xl p-5 space-y-3 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="font-mono text-slate-500">
                            {bk.bookingReference} · Inspection: {bk.inspectionDate} ({timeWindow})
                          </p>
                          <h3 className="text-base font-bold text-[#111827]">{bk.propertyTitle}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {reminderDue && bk.paymentHoldStatus === 'held' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 font-bold rounded-full">
                              <Clock className="w-3 h-3" />
                              2h Inspection Reminder Active
                            </span>
                          )}
                          <span className="font-bold text-[#16A34A]">{bk.status}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid sm:grid-cols-2 gap-2">
                        <p>
                          Student Name: <strong>{bk.inspectionContact?.fullName || bk.studentName}</strong>
                        </p>
                        <p>
                          Phone: <strong className="font-mono">{studentPhone}</strong>
                        </p>
                        <p>
                          WhatsApp: <strong className="font-mono">{studentWa}</strong>
                        </p>
                        <p>
                          Your 40% Share:{' '}
                          <strong className="font-mono text-[#16A34A]">
                            {formatNairaFromKobo(bk.breakdown.agentEarningsKobo)}
                          </strong>
                        </p>
                        {bk.inspectionContact?.notesForAgent && (
                          <p className="sm:col-span-2 text-slate-600">
                            Notes: &quot;{bk.inspectionContact.notesForAgent}&quot;
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        <a
                          href={`tel:${studentPhone}`}
                          className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-xl"
                        >
                          <PhoneCall className="w-4 h-4" />
                          <span>Call Student</span>
                        </a>
                        <a
                          href={buildAgentWhatsAppLink({
                            phone: studentWa,
                            studentName: bk.inspectionContact?.fullName || bk.studentName,
                            lodgeTitle: bk.propertyTitle,
                            bookingReference: bk.bookingReference,
                            inspectionDate: bk.inspectionDate,
                            inspectionTime: timeWindow,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-green-300 text-[#15803D] hover:bg-green-50 font-bold rounded-xl"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>WhatsApp Student</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY EARNINGS */}
        {tab === 'earnings' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-lg font-display font-bold text-[#111827]">
                  My Earnings (40% of Agent Fee · Released After 48h Hold)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Pending 48-hour hold balances cannot be withdrawn until the student confirms or 48 hours pass without a refund claim.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-amber-900">
                    Pending (48-Hour Hold — Not Withdrawable)
                  </p>
                  <p className="text-xl font-mono font-bold text-amber-900 tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.pending48hHoldKobo)}
                  </p>
                </div>
                <div className="border border-green-200 bg-green-50/60 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-[#15803D]">
                    Available Balance (Settled 40%)
                  </p>
                  <p className="text-xl font-mono font-bold text-[#16A34A] tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.availableBalanceKobo)}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">Total Earned (Excl. Refunds)</p>
                  <p className="text-xl font-mono font-bold text-[#111827] tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.totalEarnedKobo)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <h3 className="text-base font-display font-bold text-[#111827] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span>Successful Transfers</span>
                </h3>
                {myAgentTransfers.filter((s) => s.status === 'successful').length === 0 ? (
                  <p className="text-xs text-slate-500">No completed transfers yet.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {myAgentTransfers
                      .filter((s) => s.status === 'successful')
                      .map((s) => (
                        <div
                          key={s.settlementId}
                          className="border border-slate-200 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-mono font-semibold text-[#111827]">
                              {s.bookingReference}
                            </p>
                            <p className="text-slate-500">
                              Ref: {s.transferCode || s.settlementId} · {s.updatedAt.slice(0, 10)}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-[#16A34A]">
                            {formatNairaFromKobo(s.amountKobo)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <h3 className="text-base font-display font-bold text-[#111827] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Failed Transfers</span>
                </h3>
                {myAgentTransfers.filter((s) => s.status === 'failed').length === 0 ? (
                  <p className="text-xs text-slate-500">No failed bank transfers.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {myAgentTransfers
                      .filter((s) => s.status === 'failed')
                      .map((s) => (
                        <div
                          key={s.settlementId}
                          className="border border-rose-200 bg-rose-50 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-mono font-semibold text-rose-900">
                              {s.bookingReference}
                            </p>
                            <p className="text-rose-700">
                              {s.failureReason || 'Transfer retry scheduled by Super Admin.'}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-rose-900">
                            {formatNairaFromKobo(s.amountKobo)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE */}
        {tab === 'profile' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                {agentProfile.profilePhotoUrl && (
                  <img
                    src={agentProfile.profilePhotoUrl}
                    alt={agentProfile.fullName}
                    className="w-12 h-12 rounded-full object-cover border border-slate-200"
                  />
                )}
                <div>
                  <h2 className="text-lg font-display font-bold text-[#111827]">
                    Agent KYC &amp; Payout Profile
                  </h2>
                  <p className="text-xs text-slate-500">
                    Status: {agentProfile.status} · Operating Area: {agentProfile.operatingArea}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logoutUser}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Full Name</dt>
                <dd className="font-semibold text-[#111827]">{agentProfile.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">NIN Verification Ref</dt>
                <dd className="font-mono text-[#111827]">••••••{agentProfile.ninLast4 || '0000'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone &amp; WhatsApp</dt>
                <dd className="font-mono text-slate-800">
                  {agentProfile.phone} / {agentProfile.whatsappNumber || agentProfile.phone}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd className="text-slate-800">{agentProfile.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Settlement Bank Account</dt>
                <dd className="font-mono text-[#111827]">
                  {agentProfile.bankName} · {agentProfile.accountNumber} ({agentProfile.accountName})
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Emergency Contact</dt>
                <dd className="text-slate-800">{agentProfile.emergencyContact}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
