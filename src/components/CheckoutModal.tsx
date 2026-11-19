import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, PhoneCall, Send, X } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { calculateFinancialBreakdown, formatNairaFromKobo } from '../domain/finance';
import { BookingRecord } from '../domain/types';

const TIME_SLOTS = [
  'Morning (9:00 AM - 12:00 PM)',
  'Afternoon (12:00 PM - 3:00 PM)',
  'Late Afternoon (3:00 PM - 5:30 PM)',
];

const MEETUP_POINTS = [
  'ABSU Main School Gate',
  'Back Gate Junction',
  'SUG Secretariat Front',
  'Direct at Lodge Axis (Uturu)',
];

export function CheckoutModal() {
  const {
    checkoutProperty,
    setCheckoutProperty,
    settings,
    currentUser,
    initializeAndVerifyBooking,
    submitInspectionContactInfo,
    setActivePage,
  } = useMarketplace();

  const [inspectionDate, setInspectionDate] = useState('2026-11-22');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 2: Post-payment inspection contact form
  const [paidBooking, setPaidBooking] = useState<BookingRecord | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [meetupPoint, setMeetupPoint] = useState(MEETUP_POINTS[0]);
  const [notesForAgent, setNotesForAgent] = useState('');

  useEffect(() => {
    if (checkoutProperty) {
      setPaidBooking(null);
      setErrorMsg(null);
      setAcceptedTerms(false);
      setContactName(currentUser?.fullName || '');
      setContactPhone(currentUser?.phone || '');
      setWhatsappPhone('');
      setNotesForAgent('');
    }
  }, [checkoutProperty, currentUser]);

  if (!checkoutProperty) return null;

  const breakdown = calculateFinancialBreakdown(
    checkoutProperty.yearlyRentKobo,
    checkoutProperty.agentCommissionKobo,
    settings
  );

  const handlePayment = async (outcome: 'success' | 'fail') => {
    setErrorMsg(null);
    if (!acceptedTerms) {
      setErrorMsg('Please accept the booking terms and conditional-settlement notice first.');
      return;
    }
    setSubmitting(true);
    const res = await initializeAndVerifyBooking({
      property: checkoutProperty,
      inspectionDate,
      outcome,
    });
    setSubmitting(false);

    if (!res.ok || !res.booking) {
      setErrorMsg(res.error || 'Payment failed.');
      return;
    }

    // Payment succeeded -> immediately request inspection contact info for the listing agent
    setPaidBooking(res.booking);
  };

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paidBooking) return;
    setErrorMsg(null);
    setSubmitting(true);
    const res = await submitInspectionContactInfo({
      bookingId: paidBooking.bookingId,
      fullName: contactName,
      phoneNumber: contactPhone,
      whatsappOrAltPhone: whatsappPhone,
      preferredTimeSlot: timeSlot,
      campusMeetupPoint: meetupPoint,
      notesForAgent,
    });
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error || 'Could not send inspection contact info.');
      return;
    }

    setPaidBooking(null);
    setCheckoutProperty(null);
    setActivePage('student-dashboard');
  };

  const closeAndGoToDashboard = () => {
    setPaidBooking(null);
    setCheckoutProperty(null);
    setActivePage('student-dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-800">
              {paidBooking ? 'Step 2 of 2 · Inspection Contact Details' : 'Step 1 of 2 · ABSU LodgeSafe Checkout'}
            </p>
            <h2 className="text-lg font-display font-bold text-slate-900">
              {checkoutProperty.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close checkout"
            onClick={() => (paidBooking ? closeAndGoToDashboard() : setCheckoutProperty(null))}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!paidBooking ? (
          <div className="p-6 space-y-5">
            {/* Test Mode & Conditional Settlement Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-950 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
                <span>Test Payment Mode Active (Live Payments Disabled)</span>
              </p>
              <p className="leading-relaxed">
                Live transactions are disabled until written approval is obtained from Paystack or an authorized payment partner confirming holding/conditional settlement mechanics. Ordinary merchant splitting is never treated as legally protected escrow.
              </p>
            </div>

            {/* Exact Payment Breakdown */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-sm bg-slate-50">
              <div className="flex justify-between">
                <span className="text-slate-600">Yearly Rent</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatNairaFromKobo(breakdown.yearlyRentKobo)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Agent Commission</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatNairaFromKobo(breakdown.agentCommissionKobo)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Inspection Fee</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatNairaFromKobo(breakdown.inspectionFeeKobo)}
                </span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-slate-200 text-base font-bold">
                <span className="text-slate-900">Total Payable</span>
                <span className="font-mono text-emerald-900 tabular-nums">
                  {formatNairaFromKobo(breakdown.totalPayableKobo)}
                </span>
              </div>
            </div>

            {/* Student & Inspection Date */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Student Account
                </label>
                <div className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800">
                  <p className="font-semibold">{currentUser?.fullName}</p>
                  <p className="font-mono text-slate-500">{currentUser?.matricNumber || 'ABSU Student'}</p>
                </div>
              </div>
              <div>
                <label htmlFor="checkout-inspection-date" className="block text-xs font-medium text-slate-600 mb-1">
                  Preferred Physical Inspection Date
                </label>
                <input
                  id="checkout-inspection-date"
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>

            {/* Terms */}
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-800" />
                <span>Booking Terms &amp; Payment Protection</span>
              </p>
              <p>
                After payment verification, you will enter your contact information so the agent ({checkoutProperty.agentName}) can coordinate your physical inspection. Funds remain held until you inspect and select &quot;Confirm Lodge &amp; Release Funds&quot;.
              </p>
              <label className="flex items-start gap-2 pt-1 cursor-pointer text-slate-800 font-medium">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 accent-emerald-800"
                />
                <span>
                  I understand this is a test-mode booking and accept ABSU LodgeSafe booking and conditional settlement terms.
                </span>
              </label>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg p-3">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handlePayment('success')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Verifying...' : 'Simulate Successful Test Payment'}</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handlePayment('fail')}
                className="px-4 py-2.5 border border-rose-200 text-rose-800 bg-rose-50 text-xs font-semibold rounded-lg hover:bg-rose-100 disabled:opacity-50"
              >
                Simulate Failed Payment
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitContact} className="p-6 space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-xs text-emerald-950 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Payment Verified · Reference:{' '}
                  <span className="font-mono">{paidBooking.bookingReference}</span>
                </span>
              </p>
              <p>
                Enter your inspection contact details below. They will be sent directly to{' '}
                <strong>{paidBooking.agentName}</strong> (the verified agent who posted this lodge) so you can meet for physical inspection on{' '}
                <strong>{paidBooking.inspectionDate}</strong>.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="insp-contact-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Contact Full Name
                </label>
                <input
                  id="insp-contact-name"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="insp-contact-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number (For Agent Call)
                </label>
                <input
                  id="insp-contact-phone"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+234 80..."
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="insp-contact-whatsapp" className="block text-xs font-medium text-slate-700 mb-1">
                  WhatsApp / Alternative Number
                </label>
                <input
                  id="insp-contact-whatsapp"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="Optional WhatsApp line"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="insp-time-slot" className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Inspection Time
                </label>
                <select
                  id="insp-time-slot"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="insp-meetup" className="block text-xs font-medium text-slate-700 mb-1">
                Campus Meetup Point
              </label>
              <select
                id="insp-meetup"
                value={meetupPoint}
                onChange={(e) => setMeetupPoint(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {MEETUP_POINTS.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="insp-notes" className="block text-xs font-medium text-slate-700 mb-1">
                Additional Notes for {paidBooking.agentName} (Optional)
              </label>
              <textarea
                id="insp-notes"
                rows={2}
                value={notesForAgent}
                onChange={(e) => setNotesForAgent(e.target.value)}
                placeholder="e.g. Call me 30 minutes before arrival; coming from Faculty of Physical Sciences."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg p-3">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-800" />
                <span>Sent directly to {paidBooking.agentName}</span>
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Sending...' : 'Send Contact Info to Agent'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
