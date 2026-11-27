import React, { useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col bg-white text-[#111827]">
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

      {/* Floating WhatsApp Support Contact Button */}
      <a
        href="https://wa.me/2348091120045?text=Hello%20ABSU%20Lodge%20Support%2C%20I%20need%20help%20with%20an%20accommodation%20booking%20in%20Uturu."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp ABSU Lodge Support"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#16A34A] text-white text-xs font-semibold shadow-lg hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">WhatsApp Support</span>
      </a>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 right-4 z-50 max-w-sm px-4 py-3 rounded-2xl shadow-lg border text-xs font-semibold ${
            toast.tone === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : toast.tone === 'success'
              ? 'bg-[#15803D] text-white border-emerald-700'
              : 'bg-[#111827] text-white border-slate-700'
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
