import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { IMAGES } from '../data/seedData';
import { formatNairaFromKobo, nairaToKobo } from '../domain/finance';
import { AvailabilityStatus, LocationArea, PropertyCategory } from '../domain/types';
import { LodgeCard } from './LodgeCard';

const LOCATIONS: Array<LocationArea | 'All'> = [
  'All',
  'School Gate',
  'Back Gate',
  'Inside School',
  'Uturu Main Town',
  'Eke-Okigwe Axis',
];

const CATEGORIES: Array<PropertyCategory | 'All'> = [
  'All',
  'Self-Contain',
  'Single Room',
  'Two-Bedroom',
  'Apartment',
  'Shared Hostel',
];

export function MarketplaceHome() {
  const {
    properties,
    openPropertyDetails,
    announcements,
    setActivePage,
    setAuthModalOpen,
    currentUser,
  } = useMarketplace();

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<LocationArea | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<PropertyCategory | 'All'>('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityStatus | 'All'>('All');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [minRentNaira, setMinRentNaira] = useState('');
  const [maxRentNaira, setMaxRentNaira] = useState('');

  // Never show unverified properties publicly as SUG Verified; only show SUG Verified unless user unchecks verifiedOnly (and unverified never shows the badge)
  const publicProperties = useMemo(
    () =>
      properties.filter(
        (p) => p.verificationStatus === 'SUG Verified' || p.verificationStatus === 'Pending Verification'
      ),
    [properties]
  );

  const featuredLodges = useMemo(
    () =>
      publicProperties.filter(
        (p) => p.verificationStatus === 'SUG Verified' && p.featured && p.availabilityStatus === 'Available'
      ),
    [publicProperties]
  );

  const filteredLodges = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minKobo = minRentNaira ? nairaToKobo(Number(minRentNaira)) : 0;
    const maxKobo = maxRentNaira ? nairaToKobo(Number(maxRentNaira)) : Number.MAX_SAFE_INTEGER;

    return publicProperties.filter((p) => {
      if (verifiedOnly && p.verificationStatus !== 'SUG Verified') return false;
      if (locationFilter !== 'All' && p.locationArea !== locationFilter) return false;
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (availabilityFilter !== 'All' && p.availabilityStatus !== availabilityFilter) return false;
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
  }, [
    publicProperties,
    searchQuery,
    locationFilter,
    categoryFilter,
    availabilityFilter,
    verifiedOnly,
    minRentNaira,
    maxRentNaira,
  ]);

  const resetFilters = () => {
    setSearchQuery('');
    setLocationFilter('All');
    setCategoryFilter('All');
    setAvailabilityFilter('All');
    setVerifiedOnly(true);
    setMinRentNaira('');
    setMaxRentNaira('');
  };

  return (
    <div className="bg-white">
      {/* Slim Official Notice Banner */}
      <div className="bg-emerald-950 text-emerald-50 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">
            ABSU SUG Supervised Marketplace · Demonstration Data &amp; Test Payment Mode
          </p>
          <button
            type="button"
            onClick={() => setActivePage('policies')}
            className="underline hover:text-white whitespace-nowrap shrink-0"
          >
            Governance &amp; Handover Charter
          </button>
        </div>
      </div>

      {/* Hero Section (Balanced 2-column items-stretch split) */}
      <section className="border-b border-slate-200 bg-slate-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <p className="text-xs font-semibold tracking-wide text-emerald-800">
                  Abia State University · Uturu · Students’ Union Government
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
                  Find Your Lodge. Inspect With Confidence. Book With Trust.
                </h1>
                <p className="text-base text-slate-600 max-w-2xl leading-relaxed">
                  ABSU LodgeSafe connects students with SUG-verified agents and genuine lodges around
                  School Gate, Back Gate, and Inside School. Pay transparently through the platform
                  and confirm your physical inspection before settlement is released.
                </p>
              </div>

              {/* Search Accommodation Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                  <Search className="w-4 h-4 text-slate-500 shrink-0" />
                  <label htmlFor="hero-lodge-search" className="sr-only">
                    Search ABSU lodges
                  </label>
                  <input
                    id="hero-lodge-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search lodge name, School Gate, Self-Contain..."
                    className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Filter by ABSU location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value as LocationArea | 'All')}
                  className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc === 'All' ? 'All Uturu Areas' : loc}
                    </option>
                  ))}
                </select>
                <a
                  href="#lodges-catalog"
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors text-center whitespace-nowrap shrink-0"
                >
                  Find Lodges
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {!currentUser ? (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="px-4 py-2 font-semibold text-emerald-900 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-colors"
                  >
                    Student & Agent Registration
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
                          : currentUser.role === 'tech_manager'
                          ? 'tech-dashboard'
                          : 'sug-dashboard'
                      )
                    }
                    className="px-4 py-2 font-semibold text-emerald-900 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-colors"
                  >
                    Open {currentUser.role.replace('_', ' ')} Dashboard
                  </button>
                )}
                <span className="text-slate-500 text-xs">
                  Fixed platform inspection fee: <strong className="font-mono text-slate-800">₦3,000</strong> · Zero hidden agent surcharges
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative h-64 sm:h-80 lg:h-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={IMAGES.hero}
                  alt="Verified student residential lodge near ABSU Uturu"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-12 p-5 text-white">
                  <p className="text-xs font-semibold text-emerald-300">
                    SUG Supervised Inspection Protection
                  </p>
                  <p className="text-sm font-semibold mt-0.5 text-white">
                    Every verified lodge includes physical verification before fund release.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Trust Strip below hero */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-200">
            <div>
              <p className="text-xs text-slate-500">SUG Verified Lodges</p>
              <p className="text-xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
                {properties.filter((p) => p.verificationStatus === 'SUG Verified').length} Active
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Inspection Fee Standard</p>
              <p className="text-xl font-mono font-bold text-emerald-800 tabular-nums mt-0.5">
                ₦3,000 Fixed
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Commission Transparency</p>
              <p className="text-xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
                Upfront Breakdown
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Dispute Oversight</p>
              <p className="text-xl font-display font-bold text-slate-900 mt-0.5">
                ABSU SUG Desk
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Latest SUG Announcement */}
      {announcements[0] && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-900">
                {announcements[0].publishedBy} · {announcements[0].createdAt.slice(0, 10)}
              </p>
              <h2 className="text-sm font-semibold text-slate-900">{announcements[0].title}</h2>
              <p className="text-xs text-slate-700 leading-relaxed">{announcements[0].body}</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('policies')}
              className="text-xs font-semibold text-emerald-900 underline whitespace-nowrap shrink-0 self-start sm:self-center"
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
            <h2 className="text-2xl font-display font-bold text-slate-900">
              Featured SUG-Verified Lodges
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Inspected listings with verified landlord authorization around Uturu.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {featuredLodges.map((prop) => (
            <LodgeCard key={prop.propertyId} property={prop} onViewDetails={openPropertyDetails} />
          ))}
        </div>
      </section>

      {/* Main Filterable Accommodation Catalog */}
      <section id="lodges-catalog" className="border-t border-slate-200 bg-slate-50/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-900">
                Browse All ABSU Accommodation
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Filter by campus area, lodge category, yearly rent budget, availability, and SUG verification.
              </p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline"
            >
              Reset Filters
            </button>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label htmlFor="filter-location" className="block text-xs font-medium text-slate-600 mb-1">
                Location
              </label>
              <select
                id="filter-location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value as LocationArea | 'All')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900"
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
                Category
              </label>
              <select
                id="filter-category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as PropertyCategory | 'All')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900"
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
                Min Yearly Rent (₦)
              </label>
              <input
                id="filter-min-rent"
                type="number"
                min={0}
                value={minRentNaira}
                onChange={(e) => setMinRentNaira(e.target.value)}
                placeholder="e.g. 100000"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="filter-max-rent" className="block text-xs font-medium text-slate-600 mb-1">
                Max Yearly Rent (₦)
              </label>
              <input
                id="filter-max-rent"
                type="number"
                min={0}
                value={maxRentNaira}
                onChange={(e) => setMaxRentNaira(e.target.value)}
                placeholder="e.g. 400000"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="filter-availability" className="block text-xs font-medium text-slate-600 mb-1">
                Availability
              </label>
              <select
                id="filter-availability"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value as AvailabilityStatus | 'All')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900"
              >
                <option value="All">All Statuses</option>
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
              </select>
            </div>

            <div className="flex items-center h-10">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="w-4 h-4 accent-emerald-800 rounded"
                />
                <span>SUG Verified Only</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Showing <strong className="text-slate-900 tabular-nums">{filteredLodges.length}</strong> lodges
            </span>
            <span>
              Pending listings never display an SUG Verified badge and cannot be booked until approved.
            </span>
          </div>

          {filteredLodges.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <p className="text-base font-semibold text-slate-900">
                No lodges match your current filters
              </p>
              <p className="text-sm text-slate-600">
                Try clearing your rent range or switching Uturu location filters.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLodges.map((prop) => (
                <LodgeCard key={prop.propertyId} property={prop} onViewDetails={openPropertyDetails} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How ABSU LodgeSafe Works + Student Safety */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-12">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-display font-bold text-slate-900">
            How Inspection-Based Booking Works
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Built to eliminate off-campus accommodation scams, bait-and-switch inspections, and unauthorized agent fees in Uturu.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="border border-slate-200 rounded-xl p-5 space-y-2.5 bg-white">
            <Search className="w-5 h-5 text-emerald-800" />
            <h3 className="text-base font-display font-semibold text-slate-900">
              01. Discover Verified Lodges
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Compare yearly rent, agent commission, and the fixed ₦3,000 inspection fee upfront with zero hidden charges.
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-5 space-y-2.5 bg-white">
            <Lock className="w-5 h-5 text-emerald-800" />
            <h3 className="text-base font-display font-semibold text-slate-900">
              02. Conditional Checkout
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your payment generates a unique booking reference and enters conditional inspection hold—agents cannot withdraw unconfirmed funds.
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-5 space-y-2.5 bg-white">
            <ClipboardCheck className="w-5 h-5 text-emerald-800" />
            <h3 className="text-base font-display font-semibold text-slate-900">
              03. Physical Inspection
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Visit the lodge in Uturu with the verified agent, verify room condition, water, security, and landlord authorization.
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-5 space-y-2.5 bg-white">
            <CheckCircle2 className="w-5 h-5 text-emerald-800" />
            <h3 className="text-base font-display font-semibold text-slate-900">
              04. Confirm or Request Refund
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Confirm acceptance to release settlement, or file a refund dispute directly to the SUG Dispute Centre.
            </p>
          </div>
        </div>

        {/* Student Safety Box */}
        <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-8 grid lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-2">
            <div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>ABSU Student Accommodation Safety Standard</span>
            </div>
            <h3 className="text-xl font-display font-bold">
              Never pay cash directly to unverified agents or bypass platform records.
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Agents on ABSU LodgeSafe are prohibited from adding extra fees after checkout, confirming bookings for students, or altering room prices. Report suspicious activity immediately to the SUG Accommodation Desk.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-3">
            <button
              type="button"
              onClick={() => setActivePage('policies')}
              className="px-4 py-2.5 text-xs font-semibold bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Read Refund & Dispute Policy
            </button>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="px-4 py-2.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors"
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
            <p className="font-display font-bold text-emerald-900 text-base">ABSU LodgeSafe</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Official Accommodation Marketplace owned by the Abia State University Students’ Union Government (SUG), Uturu, Abia State.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900 text-xs uppercase tracking-wide">
              Campus Areas
            </p>
            <ul className="space-y-1 text-xs text-slate-600">
              <li>School Gate · Back Gate</li>
              <li>Inside School · Uturu Main Town</li>
              <li>Eke-Okigwe Axis</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900 text-xs uppercase tracking-wide">
              Legal & Policies
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>
                <button type="button" onClick={() => setActivePage('policies')} className="hover:text-emerald-800 underline">
                  Terms, Privacy & Agreements
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActivePage('policies')} className="hover:text-emerald-800 underline">
                  Conditional Settlement & Refund Policy
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActivePage('policies')} className="hover:text-emerald-800 underline">
                  SUG Succession & Handover Charter
                </button>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900 text-xs uppercase tracking-wide">
              SUG Accommodation Desk
            </p>
            <p className="text-xs text-slate-600">
              SUG Secretariat, Abia State University, Uturu
            </p>
            <p className="text-xs text-slate-600 font-mono">support@absulodgesafe.ng</p>
            <p className="text-xs text-slate-500">
              Demonstration environment · Live payments disabled pending partner approval.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
