import React, { useState } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import { formatNairaFromKobo } from '../domain/finance';
import { PropertyListing } from '../domain/types';

interface LodgeCardProps {
  property: PropertyListing;
  onViewDetails: (propertyId: string) => void;
}

export function LodgeCard({ property, onViewDetails }: LodgeCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <article className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:border-emerald-300">
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {!imgError && property.coverImageUrl ? (
          <img
            src={property.coverImageUrl}
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
          {/* Unboxed typographic metadata row (Zero-pill discipline) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{property.locationArea}</span>
            <span aria-hidden="true">·</span>
            <span>{property.category}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                property.availabilityStatus === 'Available'
                  ? 'text-emerald-800 font-medium'
                  : 'text-rose-700 font-medium'
              }
            >
              {property.availabilityStatus}
              {property.availabilityStatus === 'Available' ? ` (${property.availableRooms})` : ''}
            </span>
          </div>

          <h3 className="text-base font-display font-semibold text-slate-900 leading-snug">
            {property.title}
          </h3>

          {/* SUG Verified indicator rendered ONLY when explicitly verified */}
          {property.verificationStatus === 'SUG Verified' && (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>SUG Verified</span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Yearly Rent</p>
            <p className="text-lg font-mono font-semibold text-slate-900 tabular-nums">
              {formatNairaFromKobo(property.yearlyRentKobo)}
            </p>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              Agent fee {formatNairaFromKobo(property.agentCommissionKobo)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onViewDetails(property.propertyId)}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
          >
            View Details
          </button>
        </div>
      </div>
    </article>
  );
}
