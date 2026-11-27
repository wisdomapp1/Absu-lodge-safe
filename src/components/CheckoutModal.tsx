import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { calculateFinancialBreakdown, formatNairaFromKobo } from '../domain/finance';
import { BookingRecord } from '../domain/types';
import {
  buildStudentToAgentWhatsAppLink,
  INSPECTION_TIME_SLOTS,
  MANDATORY_BOOKING_POLICY_TEXT,
} from '../domain/validation';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

const MEETUP_POINTS = [
  'ABSU Main School Gate',
  'ABSU Gate Junction',
  'Okigwe Road Junction',
  'Direct at Lodge Axis (Uturu)',
];

type CheckoutStep = 'policy' | 'payment' | 'boarding' | 'success';

export function CheckoutModal() {
  const {
    checkoutProperty,
    setCheckoutProperty,
    settings,
    currentUser,
    agents,
    initializeAndVerifyBooking,
    submitInspectionContactInfo,
    setActivePage,
  } = useMarketplace();

  const todayIso = new Date().toISOString().slice(0, 10);

  const [step, setStep] = useState<CheckoutStep>('policy');
  const [agreedPolicy, setAgreedPolicy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 3: Mandatory Boarding Form
  const [paidBooking, setPaidBooking] = useState<BookingRecord | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState(todayIso);
  const [timeSlot, setTimeSlot] = useState<string>(INSPECTION_TIME_SLOTS[0]);
  const [meetupPoint, setMeetupPoint] = useState(MEETUP_POINTS[0]);
  const [notesForAgent, setNotesForAgent] = useState('');

  useEffect(() => {
    if (checkoutProperty) {
      setStep('policy');
      setAgreedPolicy(false);
      setPaidBooking(null);
      setErrorMsg(null);
      setContactName(currentUser?.fullName || '');
      setContactPhone(currentUser?.phone || '');
      setWhatsappPhone(currentUser?.whatsappNumber || currentUser?.phone || '');
      setPreferredDate(todayIso);
      setTimeSlot(INSPECTION_TIME_SLOTS[0]);
      setMeetupPoint(MEETUP_POINTS[0]);
      setNotesForAgent('');
    }
  }, [checkoutProperty, currentUser, todayIso]);

  const paystackPublicKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined)
      : undefined;
  const hasPaystackKey = Boolean(
    paystackPublicKey &&
      !paystackPublicKey.includes('YOUR_') &&
      !paystackPublicKey.includes('MY_') &&
      paystackPublicKey.startsWith('pk_')
  );

  useEffect(() => {
    if (!checkoutProperty || !hasPaystackKey || window.PaystackPop) return;
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.head.appendChild(script);
  }, [checkoutProperty, hasPaystackKey]);

  if (!checkoutProperty) return null;

  const breakdown = calculateFinancialBreakdown(
    checkoutProperty.yearlyRentKobo,
    checkoutProperty.agentCommissionKobo,
    settings
  );

  const agentRecord = agents.find(
    (a) => a.agentId === checkoutProperty.agentId || a.ownerUid === checkoutProperty.agentUid
  );

  const livePaystackReady = Boolean(hasPaystackKey && window.PaystackPop);

  const executeBookingVerification = async (
    outcome: 'success' | 'fail',
    paystackReference?: string
  ) => {
    setErrorMsg(null);
    setSubmitting(true);
    const res = await initializeAndVerifyBooking({
      property: checkoutProperty,
      inspectionDate: preferredDate || todayIso,
      agreedPolicy,
      outcome,
      paystackReference,
    });
    setSubmitting(false);

    if (!res.ok || !res.booking) {
      setErrorMsg(res.error || 'Payment verification failed.');
      return;
    }

    setPaidBooking(res.booking);
    setStep('boarding');
  };

  const handlePayWithPaystack = () => {
    if (!agreedPolicy) {
      setErrorMsg('Please agree to the Mandatory Booking Policy first.');
      return;
    }
    if (livePaystackReady && window.PaystackPop) {
      const ref = `ABSU-${Date.now()}`;
      const handler = window.PaystackPop.setup({
        key: paystackPublicKey,
        email: currentUser?.email || 'student@absu.edu.ng',
        amount: breakdown.totalBookingFeeKobo, // ONLY Agent Fee + ₦3,000 Inspection Fee
        currency: 'NGN',
        ref,
        metadata: {
          property_id: checkoutProperty.propertyId,
          student_uid: currentUser?.uid,
          agent_fee_kobo: breakdown.agentCommissionKobo,
          inspection_fee_kobo: breakdown.inspectionFeeKobo,
        },
        callback: (response: { reference?: string }) => {
          executeBookingVerification('success', response?.reference || ref);
        },
        onClose: () => {
          setErrorMsg('Payment window closed before completion.');
        },
      });
      handler.openIframe();
      return;
    }

    executeBookingVerification('success');
  };

  const handleBoardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paidBooking) return;
    setErrorMsg(null);
    setSubmitting(true);
    const res = await submitInspectionContactInfo({
      bookingId: paidBooking.bookingId,
      fullName: contactName,
      phoneNumber: contactPhone,
      whatsappOrAltPhone: whatsappPhone,
      preferredDate,
      preferredTimeSlot: timeSlot,
      campusMeetupPoint: meetupPoint,
      notesForAgent,
    });
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error || 'Please complete all required boarding fields.');
      return;
    }

    setStep('success');
  };

  const finishToBookings = () => {
    setPaidBooking(null);
    setCheckoutProperty(null);
    setActivePage('student-dashboard');
  };

  const agentPhone =
    paidBooking?.agentPhone || agentRecord?.phone || '+2348067743102';
  const agentPhoto =
    paidBooking?.agentPhotoUrl || agentRecord?.profilePhotoUrl;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8 text-[#111827] shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#16A34A]">
              {step === 'policy' && 'Step 1 of 4 · Mandatory Booking Policy'}
              {step === 'payment' && 'Step 2 of 4 · Pay Booking Fee (Paystack)'}
              {step === 'boarding' && 'Step 3 of 4 · Mandatory Boarding Form'}
              {step === 'success' && 'Step 4 of 4 · Booking Successful'}
            </p>
            <h2 className="text-lg font-display font-bold text-[#111827]">
              {checkoutProperty.title}
            </h2>
          </div>
          {step !== 'boarding' && (
            <button
              type="button"
              aria-label="Close checkout"
              onClick={() => (step === 'success' ? finishToBookings() : setCheckoutProperty(null))}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* STEP 1: MANDATORY BOOKING POLICY MODAL */}
        {step === 'policy' && (
          <div className="p-6 space-y-5">
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                <span>Important Student Rent Protection Notice</span>
              </div>
              <p className="text-sm text-amber-950 leading-relaxed font-medium">
                {MANDATORY_BOOKING_POLICY_TEXT}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Agent Fee</span>
                <span className="font-mono font-semibold">
                  {formatNairaFromKobo(breakdown.agentCommissionKobo)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Inspection Fee (Fixed)</span>
                <span className="font-mono font-semibold">
                  {formatNairaFromKobo(breakdown.inspectionFeeKobo)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold">
                <span>Total Booking Fee Now</span>
                <span className="font-mono text-[#16A34A]">
                  {formatNairaFromKobo(breakdown.totalBookingFeeKobo)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 pt-1">
                <span>Annual Rent (Pay Direct to Landlord After Inspection)</span>
                <span className="font-mono">{formatNairaFromKobo(breakdown.yearlyRentKobo)}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:border-[#16A34A]">
              <input
                type="checkbox"
                checked={agreedPolicy}
                onChange={(e) => setAgreedPolicy(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#16A34A]"
              />
              <span className="text-sm font-semibold text-[#111827]">
                I have read and agree.
              </span>
            </label>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              disabled={!agreedPolicy}
              onClick={() => {
                setErrorMsg(null);
                setStep('payment');
              }}
              className="w-full py-3.5 px-5 min-h-[48px] bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              I Agree, Continue to Payment
            </button>
          </div>
        )}

        {/* STEP 2: PAYSTACK PAYMENT */}
        {step === 'payment' && (
          <div className="p-6 space-y-5">
            {!livePaystackReady && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1">
                <p className="font-semibold">
                  Paystack Test Mode Active (Awaiting Live Paystack Keys)
                </p>
                <p>
                  Only the Booking Fee ({formatNairaFromKobo(breakdown.totalBookingFeeKobo)}) is charged here and held for 48 hours pending physical inspection.
                </p>
              </div>
            )}

            <div className="border border-slate-200 rounded-2xl p-4 space-y-2.5 text-sm bg-slate-50">
              <div className="flex justify-between">
                <span className="text-slate-600">Agent Fee</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatNairaFromKobo(breakdown.agentCommissionKobo)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Inspection Fee</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatNairaFromKobo(breakdown.inspectionFeeKobo)}
                </span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-slate-200 text-base font-bold">
                <span>Total Booking Fee Payable Now</span>
                <span className="font-mono text-[#16A34A] tabular-nums">
                  {formatNairaFromKobo(breakdown.totalBookingFeeKobo)}
                </span>
              </div>
              <p className="text-xs text-slate-600 pt-1">
                Annual rent ({formatNairaFromKobo(breakdown.yearlyRentKobo)}) is NOT collected here — pay direct to landlord or caretaker after inspection with a receipt.
              </p>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={handlePayWithPaystack}
                className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold rounded-xl disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Verifying Payment...'
                    : livePaystackReady
                    ? `Pay ${formatNairaFromKobo(breakdown.totalBookingFeeKobo)} with Paystack`
                    : `Pay Booking Fee Now (${formatNairaFromKobo(breakdown.totalBookingFeeKobo)})`}
                </span>
              </button>
              {!livePaystackReady && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => executeBookingVerification('fail')}
                  className="min-h-[48px] px-4 py-3 border border-rose-200 text-rose-800 bg-rose-50 text-xs font-semibold rounded-xl hover:bg-rose-100 disabled:opacity-50"
                >
                  Simulate Failed Payment
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: MANDATORY BOARDING FORM (CANNOT SKIP) */}
        {step === 'boarding' && paidBooking && (
          <form onSubmit={handleBoardingSubmit} className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-xs text-[#111827] space-y-1">
              <p className="font-bold text-[#15803D] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  Payment Verified &amp; Held (48h) · Ref:{' '}
                  <span className="font-mono">{paidBooking.bookingReference}</span>
                </span>
              </p>
              <p>
                Complete this mandatory boarding form so <strong>{paidBooking.agentName}</strong> receives your inspection schedule immediately.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="board-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="board-name"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="board-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="board-phone"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+234 80..."
                  className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="board-whatsapp" className="block text-xs font-medium text-slate-700 mb-1">
                  WhatsApp Number
                </label>
                <input
                  id="board-whatsapp"
                  required
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+234 80..."
                  className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="board-date" className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Inspection Date
                </label>
                <input
                  id="board-date"
                  type="date"
                  min={todayIso}
                  required
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="board-slot" className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Inspection Time
                </label>
                <select
                  id="board-slot"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  {INSPECTION_TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="board-meetup" className="block text-xs font-medium text-slate-700 mb-1">
                  Campus Meetup Point
                </label>
                <select
                  id="board-meetup"
                  value={meetupPoint}
                  onChange={(e) => setMeetupPoint(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  {MEETUP_POINTS.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="board-notes" className="block text-xs font-medium text-slate-700 mb-1">
                Optional Note for {paidBooking.agentName}
              </label>
              <textarea
                id="board-notes"
                rows={2}
                value={notesForAgent}
                onChange={(e) => setNotesForAgent(e.target.value)}
                placeholder="e.g., Call me 20 minutes before we meet at ABSU Gate."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
              />
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] py-3.5 px-5 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold rounded-xl disabled:opacity-50"
            >
              {submitting ? 'Confirming Schedule...' : 'Complete Boarding & Notify Agent'}
            </button>
          </form>
        )}

        {/* STEP 4: BOOKING SUCCESS PAGE */}
        {step === 'success' && paidBooking && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-green-100 text-[#16A34A] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-display font-bold text-[#111827]">
                Booking Successful
              </h3>
              <p className="text-xs font-mono text-slate-600">
                Reference: <strong className="text-[#111827]">{paidBooking.bookingReference}</strong>
              </p>
            </div>

            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 text-xs space-y-1.5">
              <p className="font-bold text-sm text-[#111827]">{paidBooking.propertyTitle}</p>
              <p className="text-slate-600">
                {paidBooking.propertyRoomType || checkoutProperty.category} · {paidBooking.locationArea}, Uturu
              </p>
              <p className="text-[#111827] font-semibold">
                Inspection Scheduled: {preferredDate} ({timeSlot})
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-950 font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>REMINDER: Get receipt before paying rent. Do NOT pay rent to an agent.</span>
            </div>

            {/* Agent Contact Card */}
            <div className="border border-green-200 bg-green-50/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                {agentPhoto && (
                  <img
                    src={agentPhoto}
                    alt={paidBooking.agentName}
                    className="w-12 h-12 rounded-full object-cover border border-green-300"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold text-[#15803D]">Your Assigned Agent</p>
                  <p className="text-sm font-bold text-[#111827]">{paidBooking.agentName}</p>
                  <p className="text-xs font-mono text-slate-700">{agentPhone}</p>
                </div>
              </div>

              <p className="text-xs font-medium text-[#111827]">
                Call the agent now to confirm your inspection time.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={`tel:${agentPhone}`}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Call Agent</span>
                </a>
                <a
                  href={buildStudentToAgentWhatsAppLink({
                    agentPhone,
                    agentName: paidBooking.agentName,
                    lodgeTitle: paidBooking.propertyTitle,
                    bookingReference: paidBooking.bookingReference,
                    inspectionDate: preferredDate,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-green-300 text-[#15803D] hover:bg-green-50 text-xs font-bold rounded-xl"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Agent</span>
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={finishToBookings}
              className="w-full min-h-[48px] py-3.5 px-5 bg-[#111827] hover:bg-slate-800 text-white text-sm font-bold rounded-xl"
            >
              Go to My Bookings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
