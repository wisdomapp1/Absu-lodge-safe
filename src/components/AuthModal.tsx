import React, { useState } from 'react';
import { LogOut, Shield, UserCheck, UserPlus, X } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';

export function AuthModal() {
  const {
    authModalOpen,
    setAuthModalOpen,
    currentUser,
    supabaseConfigured,
    signInWithGoogle,
    signInWithSupabaseEmail,
    switchDemoRole,
    registerStudentAccount,
    registerAgentAccount,
    logoutUser,
  } = useMarketplace();

  const [tab, setTab] = useState<'signin' | 'student-reg' | 'agent-reg'>('signin');
  const [sbEmail, setSbEmail] = useState('');
  const [sbPassword, setSbPassword] = useState('');
  const [sbError, setSbError] = useState<string | null>(null);

  // Student Registration Form
  const [stuName, setStuName] = useState('');
  const [stuEmail, setStuEmail] = useState('');
  const [stuPhone, setStuPhone] = useState('');
  const [stuMatric, setStuMatric] = useState('');
  const [stuDept, setStuDept] = useState('');
  const [stuFaculty, setStuFaculty] = useState('');

  // Agent Registration Form
  const [agtName, setAgtName] = useState('');
  const [agtPhone, setAgtPhone] = useState('');
  const [agtEmail, setAgtEmail] = useState('');
  const [agtAbsuId, setAgtAbsuId] = useState('');
  const [agtDoc, setAgtDoc] = useState('NIN_Slip_Verification.pdf');
  const [agtBank, setAgtBank] = useState('');
  const [agtAcctNum, setAgtAcctNum] = useState('');
  const [agtAcctName, setAgtAcctName] = useState('');
  const [agtEmergency, setAgtEmergency] = useState('');
  const [agtYears, setAgtYears] = useState('2');

  if (!authModalOpen) return null;

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuName || !stuEmail || !stuMatric) return;
    registerStudentAccount({
      fullName: stuName,
      email: stuEmail,
      phone: stuPhone,
      matricNumber: stuMatric,
      department: stuDept,
      faculty: stuFaculty,
    });
  };

  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agtName || !agtEmail || !agtPhone || !agtBank || !agtAcctNum) return;
    registerAgentAccount({
      fullName: agtName,
      phone: agtPhone,
      email: agtEmail,
      absuId: agtAbsuId,
      idDocumentName: agtDoc,
      bankName: agtBank,
      accountNumber: agtAcctNum,
      accountName: agtAcctName || agtName,
      emergencyContact: agtEmergency,
      experienceYears: Number(agtYears) || 1,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-800">ABSU LodgeSafe Access</p>
            <h2 className="text-lg font-display font-bold text-slate-900">
              Account & Role Workspace
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close authentication modal"
            onClick={() => setAuthModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {currentUser && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-900">
                  Signed in as {currentUser.role.replace('_', ' ')}
                </p>
                <p className="text-sm font-bold text-slate-900">{currentUser.fullName}</p>
                <p className="text-xs text-slate-600">{currentUser.email}</p>
              </div>
              <button
                type="button"
                onClick={logoutUser}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-800 bg-white border border-rose-200 rounded-lg hover:bg-rose-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          )}

          {/* Segmented Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setTab('signin')}
              className={`py-2 px-2 rounded-md transition-colors ${
                tab === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Sign In / Demo Roles
            </button>
            <button
              type="button"
              onClick={() => setTab('student-reg')}
              className={`py-2 px-2 rounded-md transition-colors ${
                tab === 'student-reg' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Student Register
            </button>
            <button
              type="button"
              onClick={() => setTab('agent-reg')}
              className={`py-2 px-2 rounded-md transition-colors ${
                tab === 'agent-reg' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Agent Apply
            </button>
          </div>

          {tab === 'signin' && (
            <div className="space-y-5">
              {supabaseConfigured ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSbError(null);
                    const res = await signInWithSupabaseEmail(sbEmail, sbPassword);
                    if (!res.ok) setSbError(res.error || 'Sign-in failed.');
                  }}
                  className="space-y-3"
                >
                  <p className="text-xs font-semibold text-slate-700">
                    Supabase Account Authentication
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <input
                      type="email"
                      required
                      value={sbEmail}
                      onChange={(e) => setSbEmail(e.target.value)}
                      placeholder="Email address"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                    <input
                      type="password"
                      required
                      value={sbPassword}
                      onChange={(e) => setSbPassword(e.target.value)}
                      placeholder="Password"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  {sbError && <p className="text-xs text-rose-700">{sbError}</p>}
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <button
                      type="submit"
                      className="py-2.5 px-4 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900 transition-colors"
                    >
                      Sign In with Supabase
                    </button>
                    <button
                      type="button"
                      onClick={signInWithGoogle}
                      className="py-2.5 px-4 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Continue with Google
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Google Sign-In &amp; Account Access
                  </p>
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="w-full py-2.5 px-4 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Continue with Google Sign-In
                  </button>
                  <p className="text-xs text-slate-500">
                    To connect your own Supabase PostgreSQL &amp; Auth project, configure{' '}
                    <span className="font-mono">VITE_SUPABASE_URL</span> and{' '}
                    <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> in AI Studio Secrets and apply the SQL schema.
                  </p>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-emerald-900">
                    Demonstration Role Sandbox (For SUG Evaluation & Testing)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select any role below to inspect its dedicated permissions and workflows using demonstration ABSU data.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => switchDemoRole('student')}
                    className="text-left p-3 border border-slate-200 rounded-lg hover:border-emerald-700 hover:bg-emerald-50/40 transition-colors"
                  >
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-800" />
                      <span>Student (Chinedu Okafor)</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Browse, book, confirm inspection, request refund
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchDemoRole('agent')}
                    className="text-left p-3 border border-slate-200 rounded-lg hover:border-emerald-700 hover:bg-emerald-50/40 transition-colors"
                  >
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-800" />
                      <span>Verified Agent (Emeka Nwosu)</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Submit lodges, manage rooms, view 45% earnings
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchDemoRole('sug_president')}
                    className="text-left p-3 border border-slate-200 rounded-lg hover:border-emerald-700 hover:bg-emerald-50/40 transition-colors"
                  >
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-800" />
                      <span>SUG President (Project Owner)</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Verify agents/lodges, resolve disputes, CSV financials
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchDemoRole('tech_manager')}
                    className="text-left p-3 border border-slate-200 rounded-lg hover:border-emerald-700 hover:bg-emerald-50/40 transition-colors"
                  >
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-slate-700" />
                      <span>Technical Manager (Admin)</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Webhooks, backups, audit logs, system health
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ABSU Matriculation No.
                  </label>
                  <input
                    required
                    value={stuMatric}
                    onChange={(e) => setStuMatric(e.target.value)}
                    placeholder="e.g. 2023/158210"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={stuEmail}
                    onChange={(e) => setStuEmail(e.target.value)}
                    placeholder="student@absu.edu.ng"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    required
                    value={stuPhone}
                    onChange={(e) => setStuPhone(e.target.value)}
                    placeholder="+234 80..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Faculty</label>
                  <input
                    required
                    value={stuFaculty}
                    onChange={(e) => setStuFaculty(e.target.value)}
                    placeholder="e.g. Physical Sciences"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                  <input
                    required
                    value={stuDept}
                    onChange={(e) => setStuDept(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900"
              >
                Create Student Account
              </button>
            </form>
          )}

          {tab === 'agent-reg' && (
            <form onSubmit={handleAgentSubmit} className="space-y-3">
              <p className="text-xs text-slate-600">
                Agent applications enter <strong>Pending Approval</strong> status until reviewed and verified by SUG Accommodation Administrators.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    required
                    value={agtName}
                    onChange={(e) => setAgtName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    required
                    value={agtPhone}
                    onChange={(e) => setAgtPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={agtEmail}
                    onChange={(e) => setAgtEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ABSU ID (Optional)</label>
                  <input
                    value={agtAbsuId}
                    onChange={(e) => setAgtAbsuId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Bank Name</label>
                  <input
                    required
                    value={agtBank}
                    onChange={(e) => setAgtBank(e.target.value)}
                    placeholder="e.g. Zenith Bank"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Account Number</label>
                  <input
                    required
                    value={agtAcctNum}
                    onChange={(e) => setAgtAcctNum(e.target.value)}
                    placeholder="10-digit NUBAN"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Account Name</label>
                  <input
                    required
                    value={agtAcctName}
                    onChange={(e) => setAgtAcctName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ID Document Reference
                  </label>
                  <input
                    required
                    value={agtDoc}
                    onChange={(e) => setAgtDoc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={agtYears}
                    onChange={(e) => setAgtYears(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900"
              >
                Submit Agent Application (Pending Approval)
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
