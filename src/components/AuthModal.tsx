import React, { useState } from 'react';
import { LogOut, Phone, Shield, UserCheck, UserPlus, X } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { LocationArea } from '../domain/types';

const OPERATING_AREAS: LocationArea[] = ['Uturu', 'School Gate', 'ABSU Gate', 'Okigwe Road'];

export function AuthModal() {
  const {
    authModalOpen,
    setAuthModalOpen,
    currentUser,
    supabaseConfigured,
    signInWithGoogle,
    signInWithSupabaseEmail,
    signInStudentWithPhonePassword,
    switchDemoRole,
    registerStudentAccount,
    registerAgentAccount,
    logoutUser,
  } = useMarketplace();

  const [tab, setTab] = useState<'signin' | 'student-reg' | 'agent-reg'>('signin');
  const [loginMode, setLoginMode] = useState<'phone' | 'email'>('phone');
  const [stuLoginPhone, setStuLoginPhone] = useState('');
  const [stuLoginPass, setStuLoginPass] = useState('');
  const [sbEmail, setSbEmail] = useState('');
  const [sbPassword, setSbPassword] = useState('');
  const [sbError, setSbError] = useState<string | null>(null);

  // Student Registration Form
  const [stuName, setStuName] = useState('');
  const [stuPhone, setStuPhone] = useState('');
  const [stuWhatsapp, setStuWhatsapp] = useState('');
  const [stuEmail, setStuEmail] = useState('');
  const [stuMatric, setStuMatric] = useState('');

  // Agent Registration Form
  const [agtName, setAgtName] = useState('');
  const [agtPhone, setAgtPhone] = useState('');
  const [agtWhatsapp, setAgtWhatsapp] = useState('');
  const [agtEmail, setAgtEmail] = useState('');
  const [agtNin, setAgtNin] = useState('');
  const [agtArea, setAgtArea] = useState<LocationArea>('School Gate');
  const [agtDoc, setAgtDoc] = useState('NIN_Slip_Verification.pdf');
  const [agtBank, setAgtBank] = useState('');
  const [agtAcctNum, setAgtAcctNum] = useState('');
  const [agtAcctName, setAgtAcctName] = useState('');
  const [agtEmergency, setAgtEmergency] = useState('');
  const [agtYears, setAgtYears] = useState('2');

  if (!authModalOpen) return null;

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuName || !stuPhone) return;
    registerStudentAccount({
      fullName: stuName,
      phone: stuPhone,
      whatsappNumber: stuWhatsapp || stuPhone,
      email: stuEmail || undefined,
      matricNumber: stuMatric || undefined,
    });
  };

  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agtName || !agtEmail || !agtPhone || !agtNin || !agtBank || !agtAcctNum) return;
    registerAgentAccount({
      fullName: agtName,
      phone: agtPhone,
      whatsappNumber: agtWhatsapp || agtPhone,
      email: agtEmail,
      ninNumber: agtNin,
      operatingArea: agtArea,
      idDocumentName: agtDoc,
      bankName: agtBank,
      accountNumber: agtAcctNum,
      accountName: agtAcctName || agtName,
      emergencyContact: agtEmergency,
      experienceYears: Number(agtYears) || 1,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto text-[#111827]">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#16A34A]">ABSU Lodge Access</p>
            <h2 className="text-lg font-display font-bold text-[#111827]">
              Sign In or Register Account
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close authentication modal"
            onClick={() => setAuthModalOpen(false)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {currentUser && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#15803D]">
                  Signed in as {currentUser.role.replace('_', ' ')}
                </p>
                <p className="text-sm font-bold text-[#111827]">{currentUser.fullName}</p>
                <p className="text-xs text-slate-600">{currentUser.phone || currentUser.email}</p>
              </div>
              <button
                type="button"
                onClick={logoutUser}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-800 bg-white border border-rose-200 rounded-xl hover:bg-rose-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          )}

          {/* Segmented Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab('signin')}
              className={`py-2.5 px-2 rounded-lg transition-colors ${
                tab === 'signin' ? 'bg-white text-[#111827] shadow-sm' : 'text-slate-600'
              }`}
            >
              Sign In / Demo Roles
            </button>
            <button
              type="button"
              onClick={() => setTab('student-reg')}
              className={`py-2.5 px-2 rounded-lg transition-colors ${
                tab === 'student-reg' ? 'bg-white text-[#111827] shadow-sm' : 'text-slate-600'
              }`}
            >
              Student Register
            </button>
            <button
              type="button"
              onClick={() => setTab('agent-reg')}
              className={`py-2.5 px-2 rounded-lg transition-colors ${
                tab === 'agent-reg' ? 'bg-white text-[#111827] shadow-sm' : 'text-slate-600'
              }`}
            >
              Agent Apply
            </button>
          </div>

          {tab === 'signin' && (
            <div className="space-y-5">
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('phone');
                    setSbError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    loginMode === 'phone'
                      ? 'bg-[#16A34A] text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Student Phone + Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('email');
                    setSbError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    loginMode === 'email'
                      ? 'bg-[#16A34A] text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Admin / Agent Email Login
                </button>
              </div>

              {loginMode === 'phone' ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSbError(null);
                    const res = await signInStudentWithPhonePassword(stuLoginPhone, stuLoginPass);
                    if (!res.ok) setSbError(res.error || 'Sign-in failed.');
                  }}
                  className="space-y-3"
                >
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <input
                      required
                      value={stuLoginPhone}
                      onChange={(e) => setStuLoginPhone(e.target.value)}
                      placeholder="Phone (+234 80...)"
                      className="px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl"
                    />
                    <input
                      type="password"
                      required
                      value={stuLoginPass}
                      onChange={(e) => setStuLoginPass(e.target.value)}
                      placeholder="Password"
                      className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                    />
                  </div>
                  {sbError && <p className="text-xs text-rose-700">{sbError}</p>}
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <button
                      type="submit"
                      className="min-h-[48px] inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold rounded-xl"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Sign In with Phone</span>
                    </button>
                    <button
                      type="button"
                      onClick={signInWithGoogle}
                      className="min-h-[48px] py-2.5 px-4 bg-[#111827] text-white text-sm font-bold rounded-xl hover:bg-slate-800"
                    >
                      Continue with Google
                    </button>
                  </div>
                </form>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSbError(null);
                    const res = await signInWithSupabaseEmail(sbEmail, sbPassword);
                    if (!res.ok) setSbError(res.error || 'Sign-in failed.');
                  }}
                  className="space-y-3"
                >
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <input
                      type="email"
                      required
                      value={sbEmail}
                      onChange={(e) => setSbEmail(e.target.value)}
                      placeholder="Email address"
                      className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                    />
                    <input
                      type="password"
                      required
                      value={sbPassword}
                      onChange={(e) => setSbPassword(e.target.value)}
                      placeholder="Password"
                      className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                    />
                  </div>
                  {sbError && <p className="text-xs text-rose-700">{sbError}</p>}
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <button
                      type="submit"
                      className="min-h-[48px] py-2.5 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold rounded-xl"
                    >
                      {supabaseConfigured ? 'Sign In with Supabase' : 'Sign In with Email'}
                    </button>
                    <button
                      type="button"
                      onClick={signInWithGoogle}
                      className="min-h-[48px] py-2.5 px-4 bg-[#111827] text-white text-sm font-bold rounded-xl hover:bg-slate-800"
                    >
                      Continue with Google
                    </button>
                  </div>
                </form>
              )}

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div>
                  <p className="text-xs font-bold text-[#15803D]">
                    Sandbox Role Switcher (ABSU Testing)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Preview Student, Verified Agent, SUG Admin, or Super Admin dashboards immediately.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => switchDemoRole('student')}
                    className="text-left p-3.5 border border-slate-200 rounded-xl hover:border-[#16A34A] hover:bg-green-50/40 transition-colors"
                  >
                    <p className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                      <span>Student (Chinedu Okafor)</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Book lodges, boarding form, confirm/refund
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchDemoRole('agent')}
                    className="text-left p-3.5 border border-slate-200 rounded-xl hover:border-[#16A34A] hover:bg-green-50/40 transition-colors"
                  >
                    <p className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-[#16A34A]" />
                      <span>Verified Agent (Emeka Nwosu)</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      My Lodges, Booking Alerts, 40% Earnings
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchDemoRole('sug_admin')}
                    className="text-left p-3.5 border border-slate-200 rounded-xl hover:border-[#16A34A] hover:bg-green-50/40 transition-colors"
                  >
                    <p className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#16A34A]" />
                      <span>SUG Admin (Comr. Kelechi)</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Approve/reject lodges, view 35% SUG earnings
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchDemoRole('super_admin')}
                    className="text-left p-3.5 border border-slate-200 rounded-xl hover:border-[#16A34A] hover:bg-green-50/40 transition-colors"
                  >
                    <p className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#111827]" />
                      <span>Super Admin (Engr. Somto)</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Agents KYC, 48h Splits, Refunds, Diagnostics
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'student-reg' && (
            <form onSubmit={handleStudentSubmit} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    required
                    value={stuName}
                    onChange={(e) => setStuName(e.target.value)}
                    placeholder="e.g. Ngozi Eze"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    required
                    value={stuPhone}
                    onChange={(e) => setStuPhone(e.target.value)}
                    placeholder="+234 80..."
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp Number</label>
                  <input
                    required
                    value={stuWhatsapp}
                    onChange={(e) => setStuWhatsapp(e.target.value)}
                    placeholder="+234 80..."
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={stuEmail}
                    onChange={(e) => setStuEmail(e.target.value)}
                    placeholder="student@absu.edu.ng"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ABSU Matriculation No. (Optional)
                  </label>
                  <input
                    value={stuMatric}
                    onChange={(e) => setStuMatric(e.target.value)}
                    placeholder="e.g. 2023/158210"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full min-h-[48px] py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold rounded-xl"
              >
                Create Student Account
              </button>
            </form>
          )}

          {tab === 'agent-reg' && (
            <form onSubmit={handleAgentSubmit} className="space-y-3">
              <p className="text-xs text-slate-600">
                Agent applications enter <strong>Pending Approval</strong> status until NIN &amp; payout bank details are verified by Super Admin.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    required
                    value={agtName}
                    onChange={(e) => setAgtName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    required
                    value={agtPhone}
                    onChange={(e) => setAgtPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp Number</label>
                  <input
                    required
                    value={agtWhatsapp}
                    onChange={(e) => setAgtWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={agtEmail}
                    onChange={(e) => setAgtEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    NIN Number (11 Digits)
                  </label>
                  <input
                    required
                    value={agtNin}
                    onChange={(e) => setAgtNin(e.target.value)}
                    placeholder="11-digit NIN"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Operating Area
                  </label>
                  <select
                    value={agtArea}
                    onChange={(e) => setAgtArea(e.target.value as LocationArea)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    {OPERATING_AREAS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Bank Name</label>
                  <input
                    required
                    value={agtBank}
                    onChange={(e) => setAgtBank(e.target.value)}
                    placeholder="e.g. Zenith Bank"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Account Number</label>
                  <input
                    required
                    value={agtAcctNum}
                    onChange={(e) => setAgtAcctNum(e.target.value)}
                    placeholder="10-digit NUBAN"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Account Name</label>
                  <input
                    required
                    value={agtAcctName}
                    onChange={(e) => setAgtAcctName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Emergency Contact
                  </label>
                  <input
                    required
                    value={agtEmergency}
                    onChange={(e) => setAgtEmergency(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ID Document Ref
                  </label>
                  <input
                    required
                    value={agtDoc}
                    onChange={(e) => setAgtDoc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={agtYears}
                    onChange={(e) => setAgtYears(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full min-h-[48px] py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold rounded-xl"
              >
                Submit Agent Application (Pending Super Admin Approval)
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
