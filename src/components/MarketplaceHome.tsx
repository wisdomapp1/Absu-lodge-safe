import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { IMAGES } from '../data/seedData';
import { nairaToKobo } from '../domain/finance';
import { isSuperAdminRole, LocationArea, PropertyCategory } from '../domain/types';
import { RENT_PROTECTION_BANNER_TEXT } from '../domain/validation';
import { LodgeCard } from './LodgeCard';

const LOCATIONS: Array<LocationArea | 'All'> = [
  'All',
  'School Gate',
  'ABSU Gate',
  'Uturu',
  'Okigwe Road',
];

const CATEGORIES: Array<PropertyCategory | 'All'> = [
  'All',
  'Self Contain',
  'Single Room',
  '2 Bedroom',
  '3 Bedroom',
  'Face Me I Face You',
];

export function MarketplaceHome() {
  const {
    properties,
    agents,
    openPropertyDetails,
    announcements,
    setActivePage,
    setAuthModalOpen,
    currentUser,
    isLoadingData,
    dataError,
    retryDataSync,
  } = useMarketplace();

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<LocationArea | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<PropertyCategory | 'All'>('All');
  const [minRentNaira, setMinRentNaira] = useState('');
  const [maxRentNaira, setMaxRentNaira] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'lowest'>('newest');

  const publicProperties = useMemo(
    () =>
      properties.filter(
        (p) => p.lodgeStatus === 'Approved' || p.verificationStatus === 'SUG Verified'
      ),
    [properties]
  );

  const featuredLodges = useMemo(
    () =>
      publicProperties.filter(
        (p) => p.featured && p.availabilityStatus === 'Available'
      ),
    [publicProperties]
  );

  const filteredLodges = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minKobo = minRentNaira ? nairaToKobo(Number(minRentNaira)) : 0;
    const maxKobo = maxRentNaira ? nairaToKobo(Number(maxRentNaira)) : Number.MAX_SAFE_INTEGER;

    const list = publicProperties.filter((p) => {
      if (locationFilter !== 'All' && p.locationArea !== locationFilter) return false;
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (p.yearlyRentKobo < minKobo || p.yearlyRentKobo > maxKobo) return false;
      if (
        q &&
        !p.title.toLowerCase().includes(q) &&
        !p.locationArea.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (sortBy === 'lowest') {
      return [...list].sort((a, b) => a.yearlyRentKobo - b.yearlyRentKobo);
    }
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [
    publicProperties,
    searchQuery,
    locationFilter,
    categoryFilter,
    minRentNaira,
    maxRentNaira,
    sortBy,
  ]);

  const resetFilters = () => {
    setSearchQuery('');
    setLocationFilter('All');
    setCategoryFilter('All');
    setMinRentNaira('');
    setMaxRentNaira('');
    setSortBy('newest');
  };

  const getAgentMeta = (agentId: string, agentUid: string) =>
    agents.find((a) => a.agentId === agentId || a.ownerUid === agentUid);

  return (
    <div className="bg-white">
      {/* Slim Official Protection Banner */}
      <div className="bg-[#111827] text-emerald-50 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{RENT_PROTECTION_BANNER_TEXT}</p>
          <button
            type="button"
            onClick={() => setActivePage('policies')}
            className="underline hover:text-white whitespace-nowrap shrink-0"
          >
            Governance &amp; Policies
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-slate-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <p className="text-xs font-semibold tracking-wide text-[#15803D]">
                  Abia State University · Uturu · Official SUG Student Accommodation
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-[#111827] leading-[1.12] [text-wrap:balance]">
                  Find Your ABSU Lodge. Inspect First. Never Lose Rent.
                </h1>
                <p className="text-base text-slate-600 max-w-2xl leading-relaxed">
                  Browse SUG-approved lodges around Uturu, School Gate, ABSU Gate, and Okigwe Road.
                  Pay ONLY the Agent Fee plus ₦3,000 Inspection Fee online under a 48-hour protection
                  hold—then pay annual rent directly to the landlord or caretaker with a receipt.
                </p>
              </div>

              {/* Search Accommodation Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <Search className="w-4 h-4 text-slate-500 shrink-0" />
                  <label htmlFor="hero-lodge-search" className="sr-only">
                    Search ABSU lodges
                  </label>
                  <input
                    id="hero-lodge-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search lodge name, School Gate, Self Contain..."
                    className="w-full bg-transparent text-sm text-[#111827] placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Filter by ABSU location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value as LocationArea | 'All')}
                  className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc === 'All' ? 'All Uturu Areas' : loc}
                    </option>
                  ))}
                </select>
                <a
                  href="#lodges-catalog"
                  className="min-h-[48px] px-6 py-3 text-sm font-semibold text-white bg-[#16A34A] rounded-xl hover:bg-[#15803D] transition-colors inline-flex items-center justify-center whitespace-nowrap shrink-0"
                >
                  Find Lodges
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {!currentUser ? (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="min-h-[48px] px-5 py-2.5 font-semibold text-[#15803D] bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
                  >
                    Student &amp; Agent Sign In
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setActivePage(
                        currentUser.role === 'student'
                          ? 'student-dashboard'
                          : currentUser.role === 'agent'
                          ? 'agent-dashboard'
                          : isSuperAdminRole(currentUser.role)
                          ? 'tech-dashboard'
                          : 'sug-dashboard'
                      )
                    }
                    className="min-h-[48px] px-5 py-2.5 font-semibold text-[#15803D] bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
                  >
                    Open My Dashboard
                  </button>
                )}
                <span className="text-slate-600 text-xs">
                  Fixed inspection fee: <strong className="font-mono text-[#111827]">₦3,000</strong> · 48-hour payment protection
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative h-64 sm:h-80 lg:h-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={IMAGES.hero}
                  alt="Verified student residential lodge near ABSU Uturu"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-12 p-5 text-white">
                  <p className="text-xs font-semibold text-emerald-300">
                    Direct Rent Protection Guarantee
                  </p>
                  <p className="text-sm font-semibold mt-0.5 text-white">
                    Rent is paid DIRECT to the landlord or caretaker after inspection, with a receipt.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Trust Strip below hero */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-200">
            <div>
              <p className="text-xs text-slate-500">Approved Lodges</p>
              <p className="text-xl font-display font-bold text-[#111827] tabular-nums mt-0.5">
                {publicProperties.length} Active
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Inspection Fee</p>
              <p className="text-xl font-mono font-bold text-[#15803D] tabular-nums mt-0.5">
                ₦3,000 Fixed
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Payment Hold Window</p>
              <p className="text-xl font-display font-bold text-[#111827] tabular-nums mt-0.5">
                48 Hours Held
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Rent Collection</p>
              <p className="text-xl font-display font-bold text-[#111827] mt-0.5">
                Direct to Landlord
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Error Banner with Retry if live data sync failed */}
      {dataError && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900">
            <span>{dataError}</span>
            <button
              type="button"
              onClick={retryDataSync}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-800 text-white font-semibold rounded-xl hover:bg-rose-900"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Sync</span>
            </button>
          </div>
        </section>
      )}

      {/* Latest SUG Announcement */}
      {announcements[0] && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#15803D]">
                {announcements[0].publishedBy} · {announcements[0].createdAt.slice(0, 10)}
              </p>
              <h2 className="text-sm font-semibold text-[#111827]">{announcements[0].title}</h2>
              <p className="text-xs text-slate-700 leading-relaxed">{announcements[0].body}</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('policies')}
              className="text-xs font-semibold text-[#15803D] underline whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              Read Safety Rules
            </button>
          </div>
        </section>
      )}

      {/* Featured Verified Lodges */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-[#111827]">
              Featured SUG-Approved Lodges
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Verified listings with landlord &amp; caretaker records on file around Uturu.
            </p>
          </div>
        </div>
        {isLoadingData ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-96 bg-slate-100 rounded-2xl animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {featuredLodges.map((prop) => {
              const ag = getAgentMeta(prop.agentId, prop.agentUid);
              return (
                <LodgeCard
                  key={prop.propertyId}
                  property={prop}
                  agentRating={ag?.rating}
                  agentVerified={ag?.status === 'Approved'}
                  onViewDetails={openPropertyDetails}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Main Filterable Accommodation Catalog */}
      <section id="lodges-catalog" className="border-t border-slate-200 bg-slate-50/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-[#111827]">
                Browse All ABSU Accommodation
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Filter by Uturu location, room type, annual rent budget, and sort order.
              </p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-[#15803D] hover:underline"
            >
              Reset Filters
            </button>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label htmlFor="filter-location" className="block text-xs font-medium text-slate-600 mb-1">
                Location
              </label>
              <select
                id="filter-location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value as LocationArea | 'All')}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-[#111827]"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-category" className="block text-xs font-medium text-slate-600 mb-1">
                Room Type
              </label>
              <select
                id="filter-category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as PropertyCategory | 'All')}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-[#111827]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-min-rent" className="block text-xs font-medium text-slate-600 mb-1">
                Min Annual Rent (₦)
              </label>
              <input
                id="filter-min-rent"
                type="number"
                min={0}
                value={minRentNaira}
                onChange={(e) => setMinRentNaira(e.target.value)}
                placeholder="e.g. 90000"
                className="w-full px-3 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-xl text-[#111827]"
              />
            </div>

            <div>
              <label htmlFor="filter-max-rent" className="block text-xs font-medium text-slate-600 mb-1">
                Max Annual Rent (₦)
              </label>
              <input
                id="filter-max-rent"
                type="number"
                min={0}
                value={maxRentNaira}
                onChange={(e) => setMaxRentNaira(e.target.value)}
                placeholder="e.g. 450000"
                className="w-full px-3 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-xl text-[#111827]"
              />
            </div>

            <div>
              <label htmlFor="sort-lodges" className="block text-xs font-medium text-slate-600 mb-1">
                Sort Lodges
              </label>
              <select
                id="sort-lodges"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'lowest')}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-[#111827]"
              >
                <option value="newest">Newest Approved</option>
                <option value="lowest">Lowest Annual Rent</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Showing <strong className="text-[#111827] tabular-nums">{filteredLodges.length}</strong> approved lodges
            </span>
            <span>Pending &amp; unapproved lodges stay hidden until SUG Admin verification.</span>
          </div>

          {filteredLodges.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <p className="text-base font-semibold text-[#111827]">
                No lodges match your current filters
              </p>
              <p className="text-sm text-slate-600">
                Try clearing your rent range or switching Uturu location filters.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[48px] px-5 py-2.5 text-xs font-semibold text-white bg-[#16A34A] rounded-xl hover:bg-[#15803D]"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLodges.map((prop) => {
                const ag = getAgentMeta(prop.agentId, prop.agentUid);
                return (
                  <LodgeCard
                    key={prop.propertyId}
                    property={prop}
                    agentRating={ag?.rating}
                    agentVerified={ag?.status === 'Approved'}
                    onViewDetails={openPropertyDetails}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* How ABSU LodgeSafe Works + Student Safety */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-12">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-display font-bold text-[#111827]">
            How 48-Hour Protected Inspection Booking Works
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Rent never passes through this website or any agent. Only the Agent Fee + ₦3,000 Inspection Fee are held safely until you physically verify the lodge.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="border border-slate-200 rounded-2xl p-5 space-y-2.5 bg-white">
            <Search className="w-5 h-5 text-[#16A34A]" />
            <h3 className="text-base font-display font-semibold text-[#111827]">
              01. Pick an Approved Lodge
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              See Annual Rent (Direct to Landlord) separately from Agent Fee + fixed ₦3,000 Inspection Fee.
            </p>
          </div>
          <div className="border border-slate-200 rounded-2xl p-5 space-y-2.5 bg-white">
            <Lock className="w-5 h-5 text-[#16A34A]" />
            <h3 className="text-base font-display font-semibold text-[#111827]">
              02. Pay Booking Fee (48h Hold)
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Pay Agent Fee + ₦3,000 via Paystack, then complete your inspection boarding contact form.
            </p>
          </div>
          <div className="border border-slate-200 rounded-2xl p-5 space-y-2.5 bg-white">
            <ClipboardCheck className="w-5 h-5 text-[#16A34A]" />
            <h3 className="text-base font-display font-semibold text-[#111827]">
              03. Physical Inspection
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Meet the verified agent, inspect the lodge, and verify the landlord or caretaker in person.
            </p>
          </div>
          <div className="border border-slate-200 rounded-2xl p-5 space-y-2.5 bg-white">
            <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
            <h3 className="text-base font-display font-semibold text-[#111827]">
              04. Confirm or Click REFUND
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Confirm if satisfied and pay rent directly to landlord with receipt, or click REFUND immediately if scammed.
            </p>
          </div>
        </div>

        {/* Student Safety Box */}
        <div className="bg-[#111827] text-white rounded-2xl p-6 sm:p-8 grid lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-2">
            <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>ABSU Student Rent Protection Rule</span>
            </div>
            <h3 className="text-xl font-display font-bold">
              Rent is paid DIRECT to the landlord or caretaker after inspection, with a receipt.
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              The agent must NEVER collect rent or extra charges. If an agent asks for rent or disappears during inspection, click REFUND in My Bookings before 48 hours to lock funds immediately.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-3">
            <button
              type="button"
              onClick={() => setActivePage('policies')}
              className="min-h-[48px] px-4 py-2.5 text-xs font-semibold bg-white text-[#111827] rounded-xl hover:bg-slate-100 transition-colors"
            >
              Read Refund Policy
            </button>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="min-h-[48px] px-4 py-2.5 text-xs font-semibold bg-[#16A34A] text-white rounded-xl hover:bg-[#15803D] transition-colors"
            >
              Register / Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div className="space-y-2">
            <p className="font-display font-bold text-[#16A34A] text-base">ABSU LodgeSafe</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Official Accommodation Marketplace owned by the Abia State University Students’ Union Government (SUG), Uturu, Abia State.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-[#111827] text-xs uppercase tracking-wide">
              Uturu Locations
            </p>
            <ul className="space-y-1 text-xs text-slate-600">
              <li>School Gate · ABSU Gate</li>
              <li>Uturu · Okigwe Road</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-[#111827] text-xs uppercase tracking-wide">
              Policies &amp; Protection
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>
                <button type="button" onClick={() => setActivePage('policies')} className="hover:text-[#16A34A] underline">
                  Terms &amp; Direct Rent Rule
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActivePage('policies')} className="hover:text-[#16A34A] underline">
                  48-Hour Hold &amp; Refund Policy
                </button>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-[#111827] text-xs uppercase tracking-wide">
              SUG Secretariat Support
            </p>
            <p className="text-xs text-slate-600">
              SUG Secretariat, Abia State University, Uturu
            </p>
            <p className="text-xs text-slate-600 font-mono">support@absulodgesafe.ng</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
