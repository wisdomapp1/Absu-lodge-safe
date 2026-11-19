import React, { useState } from 'react';
import { BookOpen, Mail, ShieldCheck } from 'lucide-react';
import { POLICY_DOCUMENTS } from '../data/policies';

export function PoliciesView() {
  const [selectedId, setSelectedId] = useState(POLICY_DOCUMENTS[0].id);
  const currentDoc = POLICY_DOCUMENTS.find((d) => d.id === selectedId) || POLICY_DOCUMENTS[0];

  return (
    <div className="bg-slate-50 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
            ABSU LodgeSafe Governance &amp; Legal Registry
          </p>
          <h1 className="text-3xl font-display font-bold text-slate-900 mt-1">
            Official Policies, Agreements &amp; SUG Handover Charter
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-3xl">
            All operational, payment, refund, and succession documents must be ratified by the ABSU Students’ Union Government before live payment processing is enabled.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-3 space-y-1">
            {POLICY_DOCUMENTS.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedId(doc.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedId === doc.id
                    ? 'bg-emerald-800 text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="block">{doc.title}</span>
                <span
                  className={`block text-xs mt-0.5 ${
                    selectedId === doc.id ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {doc.category}
                </span>
              </button>
            ))}
          </aside>

          <main className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-200 pb-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{currentDoc.category}</span>
                <span>·</span>
                <span>Effective: {currentDoc.effectiveDate}</span>
                <span>·</span>
                <span className="font-semibold text-emerald-800">{currentDoc.approvalStatus}</span>
              </div>
              <h2 className="text-2xl font-display font-bold text-slate-900">
                {currentDoc.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">{currentDoc.summary}</p>
            </div>

            <ol className="space-y-3 list-decimal pl-5 text-sm text-slate-800 leading-relaxed">
              {currentDoc.clauses.map((clause, i) => (
                <li key={i} className="pl-1">
                  {clause}
                </li>
              ))}
            </ol>

            {/* Frequently Asked Questions & SUG Contact */}
            <div className="border-t border-slate-200 pt-6 grid sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-800" />
                  <span>Why is ₦3,000 Inspection Fee Fixed?</span>
                </p>
                <p className="text-slate-600 leading-relaxed">
                  To prevent arbitrary inspection charges around Uturu, the platform generates a fixed ₦3,000 fee tracked separately from landlord rent and agent commission.
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-emerald-800" />
                  <span>Contact ABSU SUG Secretariat</span>
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Students’ Union Government Secretariat, ABSU Uturu · Email: <span className="font-mono">sug@absulodgesafe.ng</span>
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
