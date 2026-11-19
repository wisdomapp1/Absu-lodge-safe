import React, { useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Film,
  HelpCircle,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  PhoneCall,
  PlusCircle,
  Upload,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatNairaFromKobo } from '../domain/finance';
import { getUnreadNotificationsCount } from '../domain/notifications';
import { LocationArea, PropertyCategory } from '../domain/types';
import { validateMediaUpload } from '../domain/validation';
import { NotificationsPanel } from './NotificationsPanel';

type AgentSection =
  | 'overview'
  | 'lodges'
  | 'add-lodge'
  | 'inspections'
  | 'bookings'
  | 'earnings'
  | 'payouts'
  | 'notifications'
  | 'profile'
  | 'support';

export function AgentDashboard() {
  const {
    currentUser,
    agents,
    properties,
    bookings,
    notifications,
    settings,
    setActivePage,
    openPropertyDetails,
    submitNewLodge,
    toggleLodgeAvailability,
    logoutUser,
    showToast,
  } = useMarketplace();

  const [section, setSection] = useState<AgentSection>('overview');

  // Add New Lodge Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PropertyCategory>('Self-Contain');
  const [locationArea, setLocationArea] = useState<LocationArea>('School Gate');
  const [preciseAddress, setPreciseAddress] = useState('');
  const [yearlyRentNaira, setYearlyRentNaira] = useState('200000');
  const [agentCommissionNaira, setAgentCommissionNaira] = useState('20000');
  const [availableRooms, setAvailableRooms] = useState('3');
  const [description, setDescription] = useState('');
  const [amenitiesText, setAmenitiesText] = useState('24/7 Borehole Water, Gated Compound, Prepaid Meter');
  const [landlordName, setLandlordName] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [landlordDoc, setLandlordDoc] = useState('Signed_Landlord_Authorization.pdf');
  const [uploadedMedia, setUploadedMedia] = useState<
    { type: 'image' | 'video'; name: string; previewUrl?: string; sizeBytes: number }[]
  >([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  if (!currentUser || currentUser.role !== 'agent') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-slate-900">Agent Portal Access</h1>
        <p className="text-sm text-slate-600">
          Sign in as an ABSU LodgeSafe Accommodation Agent to manage lodges, inspections, and 45% commission settlements.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('home')}
          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-800 rounded-lg"
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
    email: currentUser.email,
    absuId: 'Pending',
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

  // Strict agent isolation: agent sees ONLY their own lodges and bookings
  const myLodges = useMemo(
    () => properties.filter((p) => p.agentUid === currentUser.uid),
    [properties, currentUser.uid]
  );
  const myBookings = useMemo(
    () => bookings.filter((b) => b.agentUid === currentUser.uid),
    [bookings, currentUser.uid]
  );
  const myNotifications = useMemo(
    () => notifications.filter((n) => n.recipientUid === currentUser.uid),
    [notifications, currentUser.uid]
  );
  const unreadNotificationCount = useMemo(
    () => getUnreadNotificationsCount(notifications, currentUser.uid),
    [notifications, currentUser.uid]
  );

  // Earnings aggregation (55% platform deduction / 45% agent earnings)
  const earningsStats = useMemo(() => {
    let grossCommission = 0;
    let platformDeduction = 0;
    let agentEarnings = 0;
    let pendingSettlement = 0;
    let completedPayouts = 0;
    let disputedAmount = 0;
    let refundAdjusted = 0;

    for (const bk of myBookings) {
      if (bk.status === 'Pending Payment' || bk.status === 'Payment Failed' || bk.status === 'Cancelled') {
        continue;
      }
      if (bk.status === 'Refunded') {
        refundAdjusted += bk.breakdown.agentEarningsKobo;
        continue;
      }
      grossCommission += bk.breakdown.agentCommissionKobo;
      platformDeduction += bk.breakdown.platformCommissionKobo;
      agentEarnings += bk.breakdown.agentEarningsKobo;
      if (bk.status === 'Settled') {
        completedPayouts += bk.breakdown.agentEarningsKobo;
      } else if (bk.status === 'Dispute Requested' || bk.status === 'Under SUG Review') {
        disputedAmount += bk.breakdown.agentEarningsKobo;
      } else {
        pendingSettlement += bk.breakdown.agentEarningsKobo;
      }
    }

    return {
      grossCommission,
      platformDeduction,
      agentEarnings,
      pendingSettlement,
      completedPayouts,
      disputedAmount,
      refundAdjusted,
    };
  }, [myBookings]);

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>, slotIndex?: number) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentImages = uploadedMedia.filter((m) => m.type === 'image');
    const currentVideos = uploadedMedia.filter((m) => m.type === 'video');
    const nextImages = [...currentImages];

    for (const file of files) {
      const check = validateMediaUpload({ name: file.name, type: file.type, size: file.size });
      if (!check.valid || check.kind !== 'image') {
        showToast('error', check.error || `${file.name} must be a valid JPG, JPEG, PNG, or WebP image (≤ 5 MB).`);
        continue;
      }
      const item = {
        type: 'image' as const,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        sizeBytes: file.size,
      };
      if (typeof slotIndex === 'number') {
        nextImages[slotIndex] = item;
        break;
      }
      if (nextImages.length < 4) {
        nextImages.push(item);
      } else {
        showToast('info', 'Maximum of 4 lodge images selected. Remove one to replace.');
        break;
      }
    }

    const compactImages = nextImages.filter(Boolean).slice(0, 4);
    setUploadedMedia([...compactImages, ...currentVideos]);
    setUploadProgress(Math.round(((compactImages.length + currentVideos.length) / 5) * 100));
    e.target.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateMediaUpload({ name: file.name, type: file.type, size: file.size });
    if (!check.valid || check.kind !== 'video') {
      showToast('error', check.error || `${file.name} must be an MP4 walkthrough video (≤ 25 MB).`);
      e.target.value = '';
      return;
    }
    const currentImages = uploadedMedia.filter((m) => m.type === 'image');
    const videoItem = {
      type: 'video' as const,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      sizeBytes: file.size,
    };
    setUploadedMedia([...currentImages, videoItem]);
    setUploadProgress(Math.round(((currentImages.length + 1) / 5) * 100));
    e.target.value = '';
  };

  const removeImageAt = (idx: number) => {
    const currentImages = uploadedMedia.filter((m) => m.type === 'image');
    const currentVideos = uploadedMedia.filter((m) => m.type === 'video');
    currentImages.splice(idx, 1);
    setUploadedMedia([...currentImages, ...currentVideos]);
    setUploadProgress(Math.round(((currentImages.length + currentVideos.length) / 5) * 100));
  };

  const removeVideo = () => {
    const currentImages = uploadedMedia.filter((m) => m.type === 'image');
    setUploadedMedia(currentImages);
    setUploadProgress(Math.round((currentImages.length / 5) * 100));
  };

  const handleAddLodge = (e: React.FormEvent) => {
    e.preventDefault();
    const res = submitNewLodge({
      title,
      category,
      locationArea,
      preciseAddress,
      yearlyRentNaira: Number(yearlyRentNaira),
      agentCommissionNaira: Number(agentCommissionNaira),
      availableRooms: Number(availableRooms),
      description,
      amenities: amenitiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      landlordName,
      landlordPhone,
      landlordAuthorizationDoc: landlordDoc,
      mediaNames: uploadedMedia,
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
    setUploadedMedia([]);
    setUploadProgress(0);
    setSection('lodges');
  };

  const navItems: { id: AgentSection; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'lodges', label: 'My Lodges', icon: <Building2 className="w-4 h-4" /> },
    { id: 'add-lodge', label: 'Add New Lodge', icon: <PlusCircle className="w-4 h-4" /> },
    { id: 'inspections', label: 'Inspections', icon: <Calendar className="w-4 h-4" /> },
    { id: 'bookings', label: 'Bookings', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'earnings', label: 'Earnings', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'payouts', label: 'Payout History', icon: <Wallet className="w-4 h-4" /> },
    {
      id: 'notifications',
      label:
        unreadNotificationCount > 0
          ? `Notifications (${unreadNotificationCount})`
          : 'Notifications',
      icon: <Bell className="w-4 h-4" />,
    },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'support', label: 'Support', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 min-w-0 bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <p className="text-xs font-semibold text-emerald-800">Agent Workspace</p>
            <h1 className="text-base font-display font-bold text-slate-900 mt-0.5">
              {agentProfile.fullName}
            </h1>
            <p className="text-xs font-semibold mt-1 text-slate-600">
              Account Status:{' '}
              <span
                className={
                  agentProfile.status === 'Approved' ? 'text-emerald-800' : 'text-amber-700'
                }
              >
                {agentProfile.status}
              </span>
            </p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                  section === item.id
                    ? 'bg-emerald-800 text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={logoutUser}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        <main className="lg:col-span-9 min-w-0 space-y-6">
          {agentProfile.status !== 'Approved' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950">
              <strong>Verification Gate:</strong> Your agent account status is{' '}
              <strong>{agentProfile.status}</strong>. Unapproved agents cannot publish verified lodges. SUG Accommodation Administrators must approve your profile first.
            </div>
          )}

          {section === 'overview' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">My Lodges</p>
                  <p className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-1">
                    {myLodges.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Bookings Received</p>
                  <p className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-1">
                    {myBookings.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">My 45% Net Earnings</p>
                  <p className="text-2xl font-mono font-bold text-emerald-800 tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.agentEarnings)}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Pending Settlement</p>
                  <p className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.pendingSettlement)}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="text-lg font-display font-bold text-slate-900">
                  Agent Compliance Restrictions
                </h2>
                <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5">
                  <li>Agents cannot modify prices on paid bookings or introduce post-payment charges.</li>
                  <li>Agents cannot confirm bookings on behalf of students or close disputed cases.</li>
                  <li>Withdrawals are strictly blocked on unconfirmed or disputed bookings.</li>
                </ul>
              </div>
            </div>
          )}

          {section === 'lodges' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-slate-900">My Lodges</h2>
                <button
                  type="button"
                  onClick={() => setSection('add-lodge')}
                  className="px-3 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg"
                >
                  Add New Lodge
                </button>
              </div>
              {myLodges.length === 0 ? (
                <p className="text-sm text-slate-500">No lodges submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {myLodges.map((p) => (
                    <div
                      key={p.propertyId}
                      className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">
                          {p.locationArea} · {p.category} · Verification:{' '}
                          <strong className="text-slate-800">{p.verificationStatus}</strong>
                        </p>
                        <p className="text-base font-semibold text-slate-900">{p.title}</p>
                        <p className="text-xs font-mono text-slate-600 tabular-nums">
                          Rent: {formatNairaFromKobo(p.yearlyRentKobo)} · Commission:{' '}
                          {formatNairaFromKobo(p.agentCommissionKobo)} · Rooms: {p.availableRooms}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLodgeAvailability(p.propertyId)}
                        className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"
                      >
                        {p.availabilityStatus === 'Available' ? 'Mark Unavailable' : 'Mark Available'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'add-lodge' && (
            <form
              onSubmit={handleAddLodge}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
            >
              <div>
                <h2 className="text-lg font-display font-bold text-slate-900">
                  Submit New Lodge for SUG Verification
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  The ₦3,000 inspection fee is generated automatically by the platform. Max commission allowed: {settings.maxCommissionPctOfRent}% of yearly rent.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Lodge Name</label>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Royal Scholars Annex — Self-Contain"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Accommodation Type
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PropertyCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Self-Contain">Self-Contain</option>
                    <option value="Single Room">Single Room</option>
                    <option value="Two-Bedroom">Two-Bedroom</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Shared Hostel">Shared Hostel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Location Axis</label>
                  <select
                    value={locationArea}
                    onChange={(e) => setLocationArea(e.target.value as LocationArea)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="School Gate">School Gate</option>
                    <option value="Back Gate">Back Gate</option>
                    <option value="Inside School">Inside School</option>
                    <option value="Uturu Main Town">Uturu Main Town</option>
                    <option value="Eke-Okigwe Axis">Eke-Okigwe Axis</option>
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
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Yearly Rent (₦)
                  </label>
                  <input
                    type="number"
                    min={10000}
                    required
                    value={yearlyRentNaira}
                    onChange={(e) => setYearlyRentNaira(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Agent Commission (₦)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={agentCommissionNaira}
                    onChange={(e) => setAgentCommissionNaira(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Platform Fixed Inspection Fee (Non-Editable)
                </label>
                <input
                  disabled
                  value="₦3,000 (Generated Automatically by ABSU LodgeSafe)"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-100 text-slate-600 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Precise Address (Masked until student books)
                </label>
                <input
                  required
                  value={preciseAddress}
                  onChange={(e) => setPreciseAddress(e.target.value)}
                  placeholder="Plot & street name in Uturu..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Amenities (comma-separated)
                </label>
                <input
                  value={amenitiesText}
                  onChange={(e) => setAmenitiesText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3 border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Landlord Full Name
                  </label>
                  <input
                    required
                    value={landlordName}
                    onChange={(e) => setLandlordName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Landlord Phone
                  </label>
                  <input
                    required
                    value={landlordPhone}
                    onChange={(e) => setLandlordPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Landlord Authorization Evidence
                  </label>
                  <input
                    required
                    value={landlordDoc}
                    onChange={(e) => setLandlordDoc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* 4 Images + 1 Video Upload with Live Preview Before Posting */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-5 bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-display font-bold text-slate-900">
                      Lodge Media Upload &amp; Pre-Post Preview
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Upload <strong>4 photos</strong> (JPG, JPEG, PNG, WebP ≤ 5MB each) and{' '}
                      <strong>1 walkthrough video</strong> (MP4 ≤ 25MB). Preview every file below before posting.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span
                      className={
                        uploadedMedia.filter((m) => m.type === 'image').length === 4
                          ? 'text-emerald-800 font-bold'
                          : 'text-slate-600'
                      }
                    >
                      Photos: {uploadedMedia.filter((m) => m.type === 'image').length}/4
                    </span>
                    <span className="text-slate-300">|</span>
                    <span
                      className={
                        uploadedMedia.some((m) => m.type === 'video')
                          ? 'text-emerald-800 font-bold'
                          : 'text-slate-600'
                      }
                    >
                      Video: {uploadedMedia.some((m) => m.type === 'video') ? '1/1' : '0/1'}
                    </span>
                  </div>
                </div>

                {uploadProgress > 0 && (
                  <div className="w-full bg-slate-200 h-1.5 rounded overflow-hidden">
                    <div
                      className="bg-emerald-700 h-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}

                {/* Bulk / Multi Image Upload + 4 Image Preview Slots */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <ImagePlus className="w-4 h-4 text-emerald-800" />
                      <span>Lodge Photographs (4 Required)</span>
                    </span>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 hover:border-emerald-700 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-emerald-800" />
                      <span>Select up to 4 Photos</span>
                      <input
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={(e) => handleImagesChange(e)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((slotIdx) => {
                      const images = uploadedMedia.filter((m) => m.type === 'image');
                      const img = images[slotIdx];
                      const slotLabels = [
                        'Photo 1 (Cover)',
                        'Photo 2 (Room)',
                        'Photo 3 (Bath/Kitchen)',
                        'Photo 4 (Compound)',
                      ];
                      return (
                        <div
                          key={slotIdx}
                          className="min-w-0 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col"
                        >
                          <div className="relative aspect-[4/3] bg-slate-100 flex items-center justify-center">
                            {img?.previewUrl ? (
                              <>
                                <img
                                  src={img.previewUrl}
                                  alt={slotLabels[slotIdx]}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove ${slotLabels[slotIdx]}`}
                                  onClick={() => removeImageAt(slotIdx)}
                                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-700"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <label className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-center cursor-pointer hover:bg-emerald-50/50 transition-colors">
                                <ImagePlus className="w-5 h-5 text-slate-400" />
                                <span className="text-[11px] font-medium text-slate-600">
                                  {slotLabels[slotIdx]}
                                </span>
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp"
                                  onChange={(e) => handleImagesChange(e, slotIdx)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                          <div className="px-2.5 py-1.5 border-t border-slate-100 text-[11px] text-slate-600 truncate">
                            {img ? img.name : 'Empty slot'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 1 Walkthrough Video Upload + Live Video Preview */}
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Film className="w-4 h-4 text-emerald-800" />
                      <span>Walkthrough Video Tour (1 MP4 Required ≤ 25MB)</span>
                    </span>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 hover:border-emerald-700 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-emerald-800" />
                      <span>
                        {uploadedMedia.some((m) => m.type === 'video')
                          ? 'Replace Walkthrough Video'
                          : 'Upload MP4 Video'}
                      </span>
                      <input
                        type="file"
                        accept=".mp4,video/mp4"
                        onChange={handleVideoChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {(() => {
                    const videoItem = uploadedMedia.find((m) => m.type === 'video');
                    if (!videoItem) {
                      return (
                        <label className="block border border-dashed border-slate-300 bg-white rounded-lg p-5 text-center cursor-pointer hover:border-emerald-700">
                          <Film className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                          <p className="text-xs font-medium text-slate-700">
                            Click to attach MP4 walkthrough tour video for live preview
                          </p>
                          <input
                            type="file"
                            accept=".mp4,video/mp4"
                            onChange={handleVideoChange}
                            className="hidden"
                          />
                        </label>
                      );
                    }
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-black">
                          <video
                            controls
                            playsInline
                            src={videoItem.previewUrl}
                            className="w-full max-h-64 mx-auto"
                          />
                        </div>
                        <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs border-t border-slate-100">
                          <div className="min-w-0 flex-1 flex items-center gap-2 text-slate-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span className="font-medium truncate">{videoItem.name}</span>
                            <span className="font-mono text-slate-400 shrink-0">
                              ({(videoItem.sizeBytes / (1024 * 1024)).toFixed(2)} MB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={removeVideo}
                            className="text-rose-700 font-semibold hover:underline shrink-0"
                          >
                            Remove Video
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900"
              >
                Submit Lodge for SUG Verification
              </button>
            </form>
          )}

          {(section === 'inspections' || section === 'bookings') && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-display font-bold text-slate-900">
                {section === 'inspections' ? 'Scheduled Student Inspections' : 'Lodge Bookings'}
              </h2>
              {myBookings.length === 0 ? (
                <p className="text-sm text-slate-500">No bookings recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {myBookings.map((bk) => (
                    <div
                      key={bk.bookingId}
                      className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-mono text-slate-500">
                            {bk.bookingReference} · Inspection Date: {bk.inspectionDate}
                          </p>
                          <p className="text-sm font-semibold text-slate-900">{bk.propertyTitle}</p>
                          <p className="text-slate-600">
                            Student: <strong>{bk.studentName}</strong> ({bk.studentMatric})
                          </p>
                        </div>
                        <div className="sm:text-right space-y-1">
                          <p className="font-semibold text-emerald-800">{bk.status}</p>
                          <p className="font-mono tabular-nums text-slate-700">
                            Your 45% share: {formatNairaFromKobo(bk.breakdown.agentEarningsKobo)}
                          </p>
                        </div>
                      </div>

                      {bk.inspectionContact ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 space-y-1.5">
                          <p className="font-semibold text-emerald-950 flex items-center gap-1.5">
                            <PhoneCall className="w-3.5 h-3.5 text-emerald-800" />
                            <span>Student Inspection Contact Information</span>
                          </p>
                          <div className="grid sm:grid-cols-2 gap-2 text-slate-800">
                            <p>
                              Contact Name: <strong>{bk.inspectionContact.fullName}</strong>
                            </p>
                            <p>
                              Phone:{' '}
                              <a
                                href={`tel:${bk.inspectionContact.phoneNumber}`}
                                className="font-mono font-semibold text-emerald-900 underline"
                              >
                                {bk.inspectionContact.phoneNumber}
                              </a>
                            </p>
                            {bk.inspectionContact.whatsappOrAltPhone && (
                              <p>
                                WhatsApp / Alt:{' '}
                                <span className="font-mono font-semibold">
                                  {bk.inspectionContact.whatsappOrAltPhone}
                                </span>
                              </p>
                            )}
                            <p>
                              Time Window: <strong>{bk.inspectionContact.preferredTimeSlot}</strong>
                            </p>
                            <p className="sm:col-span-2">
                              Campus Meetup Point:{' '}
                              <strong>{bk.inspectionContact.campusMeetupPoint}</strong>
                            </p>
                            {bk.inspectionContact.notesForAgent && (
                              <p className="sm:col-span-2 text-slate-700">
                                Student Note: &quot;{bk.inspectionContact.notesForAgent}&quot;
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-600">
                          Awaiting student inspection contact submission after payment.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'earnings' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-lg font-display font-bold text-slate-900">
                  Agent Commission &amp; 55/45 Earnings Ledger
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Example split: On ₦20,000 agent commission, Platform receives ₦11,000 (55%) and Agent receives ₦9,000 (45%). Agents do not earn a percentage of landlord rent.
                </p>
              </div>
              <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="border border-slate-200 rounded-lg p-4">
                  <dt className="text-xs text-slate-500">Total Agent Commissions</dt>
                  <dd className="text-lg font-mono font-bold text-slate-900 tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.grossCommission)}
                  </dd>
                </div>
                <div className="border border-slate-200 rounded-lg p-4">
                  <dt className="text-xs text-slate-500">Platform Deduction (55%)</dt>
                  <dd className="text-lg font-mono font-bold text-slate-700 tabular-nums mt-1">
                    -{formatNairaFromKobo(earningsStats.platformDeduction)}
                  </dd>
                </div>
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4">
                  <dt className="text-xs text-emerald-900">Agent Earnings (45%)</dt>
                  <dd className="text-lg font-mono font-bold text-emerald-900 tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.agentEarnings)}
                  </dd>
                </div>
                <div className="border border-slate-200 rounded-lg p-4">
                  <dt className="text-xs text-slate-500">Pending Settlements (Held)</dt>
                  <dd className="text-lg font-mono font-bold text-amber-800 tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.pendingSettlement)}
                  </dd>
                </div>
                <div className="border border-slate-200 rounded-lg p-4">
                  <dt className="text-xs text-slate-500">Completed Payouts</dt>
                  <dd className="text-lg font-mono font-bold text-emerald-800 tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.completedPayouts)}
                  </dd>
                </div>
                <div className="border border-slate-200 rounded-lg p-4">
                  <dt className="text-xs text-slate-500">Disputed / Refund Adjusted</dt>
                  <dd className="text-lg font-mono font-bold text-rose-800 tabular-nums mt-1">
                    {formatNairaFromKobo(earningsStats.disputedAmount + earningsStats.refundAdjusted)}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-slate-500">
                Note: Agents cannot withdraw funds from unconfirmed or disputed bookings.
              </p>
            </div>
          )}

          {section === 'payouts' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-display font-bold text-slate-900">Payout History</h2>
              <div className="space-y-2 text-xs">
                {myBookings.filter((b) => b.status === 'Settled').length === 0 ? (
                  <p className="text-slate-500">No settled payouts yet.</p>
                ) : (
                  myBookings
                    .filter((b) => b.status === 'Settled')
                    .map((b) => (
                      <div
                        key={b.bookingId}
                        className="border border-slate-200 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{b.propertyTitle}</p>
                          <p className="font-mono text-slate-500">
                            {b.bookingReference} · Settled {b.updatedAt.slice(0, 10)}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-emerald-800 tabular-nums">
                          {formatNairaFromKobo(b.breakdown.agentEarningsKobo)}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <NotificationsPanel
              role="agent"
              notifications={myNotifications}
              onNavigate={(target) => {
                if (target.type === 'property') {
                  openPropertyDetails(target.propertyId);
                } else {
                  setSection(target.section as AgentSection);
                }
              }}
            />
          )}

          {section === 'profile' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-display font-bold text-slate-900">
                    Agent Verification Profile
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ABSU Agent KYC record, settlement bank account, and session controls.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={logoutUser}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
              <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Full Name</dt>
                  <dd className="font-semibold text-slate-900">{agentProfile.fullName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">ABSU Agent ID</dt>
                  <dd className="font-mono text-slate-900">{agentProfile.absuId}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="text-slate-800">{agentProfile.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Phone</dt>
                  <dd className="text-slate-800">{agentProfile.phone}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Bank Account</dt>
                  <dd className="font-mono text-slate-900">
                    {agentProfile.bankName} · {agentProfile.accountNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Emergency Contact</dt>
                  <dd className="text-slate-800">{agentProfile.emergencyContact}</dd>
                </div>
              </dl>
            </div>
          )}

          {section === 'support' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="text-lg font-display font-bold text-slate-900">Agent Support</h2>
              <p className="text-sm text-slate-600">
                Contact the SUG Accommodation Verification Committee at{' '}
                <span className="font-mono">agents@absulodgesafe.ng</span> for KYC review or landlord authorization updates.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
