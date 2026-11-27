import React, { useState } from 'react';
import { Building2, ShieldCheck, Star } from 'lucide-react';
import { formatNairaFromKobo } from '../domain/finance';
import { PropertyListing } from '../domain/types';
import { getOptimizedImageUrl } from '../lib/cloudinary';

interface LodgeCardProps {
  property: PropertyListing;
  agentRating?: number;
  agentVerified?: boolean;
  onViewDetails: (propertyId: string) => void;
}

export function LodgeCard({
  property,
  agentRating,
  agentVerified,
  onViewDetails,
}: LodgeCardProps) {
  const [imgError, setImgError] = useState(false);
  const totalBookingFeeKobo = property.agentCommissionKobo + property.inspectionFeeKobo;
  const isApproved = property.lodgeStatus === 'Approved' || property.verificationStatus === 'SUG Verified';

  return (
    <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#16A34A]/50">
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {!imgError && property.coverImageUrl ? (
          <img
            src={getOptimizedImageUrl(property.coverImageUrl, 800)}
            alt={property.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 text-emerald-900 p-4 text-center">
            <Building2 className="w-8 h-8 mb-2 opacity-70" />
            <span className="text-xs font-medium">{property.title}</span>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1 justify-between gap-4">
        <div className="space-y-2">
          {/* Clean unboxed typographic metadata row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-medium text-slate-800">{property.locationArea}</span>
            <span aria-hidden="true">·</span>
            <span>{property.category}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                property.availabilityStatus === 'Available'
                  ? 'text-[#15803D] font-medium'
                  : 'text-rose-700 font-medium'
              }
            >
              {property.availabilityStatus}
              {property.availabilityStatus === 'Available' ? ` (${property.availableRooms})` : ''}
            </span>
          </div>

          <h3 className="text-base font-display font-semibold text-[#111827] leading-snug">
            {property.title}
          </h3>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            <span>Agent: {property.agentName}</span>
            {agentRating && agentRating > 0 ? (
              <span className="inline-flex items-center gap-1 font-mono text-[#111827] tabular-nums">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                {agentRating.toFixed(1)}
              </span>
            ) : null}
            {(isApproved || agentVerified) && (
              <span className="inline-flex items-center gap-1 font-semibold text-[#15803D]">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>SUG Approved</span>
              </span>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-slate-500">Annual Rent (Direct to Landlord)</p>
              <p className="text-base font-mono font-bold text-[#111827] tabular-nums mt-0.5">
                {formatNairaFromKobo(property.yearlyRentKobo)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Booking Fee Now</p>
              <p className="text-base font-mono font-bold text-[#15803D] tabular-nums mt-0.5">
                {formatNairaFromKobo(totalBookingFeeKobo)}
              </p>
              <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                {formatNairaFromKobo(property.agentCommissionKobo)} + ₦3,000
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onViewDetails(property.propertyId)}
            className="w-full min-h-[48px] px-4 py-2.5 text-sm font-semibold text-white bg-[#16A34A] rounded-xl hover:bg-[#15803D] transition-colors whitespace-nowrap"
          >
            View Lodge &amp; Book
          </button>
        </div>
      </div>
    </article>
  );
}
