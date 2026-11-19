import React, { useEffect } from 'react';
import { AuthModal } from './components/AuthModal';
import { AgentDashboard } from './components/AgentDashboard';
import { CheckoutModal } from './components/CheckoutModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LodgeDetailsView } from './components/LodgeDetailsView';
import { MarketplaceHome } from './components/MarketplaceHome';
import { Navbar } from './components/Navbar';
import { PoliciesView } from './components/PoliciesView';
import { StudentDashboard } from './components/StudentDashboard';
import { SugAdminDashboard } from './components/SugAdminDashboard';
import { TechAdminDashboard } from './components/TechAdminDashboard';
import { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext';

function AppShell() {
  const { activePage, selectedPropertyId, toast } = useMarketplace();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
  }, [activePage, selectedPropertyId]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <Navbar />
      <main className="flex-1">
        {activePage === 'home' && <MarketplaceHome />}
        {activePage === 'lodge-details' && <LodgeDetailsView />}
        {activePage === 'student-dashboard' && <StudentDashboard />}
        {activePage === 'agent-dashboard' && <AgentDashboard />}
        {activePage === 'sug-dashboard' && <SugAdminDashboard />}
        {activePage === 'tech-dashboard' && <TechAdminDashboard />}
        {activePage === 'policies' && <PoliciesView />}
      </main>
      <AuthModal />
      <CheckoutModal />
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
            toast.tone === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : toast.tone === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MarketplaceProvider>
        <AppShell />
      </MarketplaceProvider>
    </ErrorBoundary>
  );
}
