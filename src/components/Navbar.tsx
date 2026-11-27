import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ActivePage, useMarketplace } from '../context/MarketplaceContext';
import { isSuperAdminRole } from '../domain/types';

export function Navbar() {
  const { activePage, setActivePage, currentUser, setAuthModalOpen } = useMarketplace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const goToDashboard = () => {
    setMobileMenuOpen(false);
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (currentUser.role === 'student') setActivePage('student-dashboard');
    else if (currentUser.role === 'agent') setActivePage('agent-dashboard');
    else if (isSuperAdminRole(currentUser.role)) setActivePage('tech-dashboard');
    else setActivePage('sug-dashboard');
  };

  const navigate = (page: ActivePage, sectionId?: string) => {
    setMobileMenuOpen(false);
    setActivePage(page);
    if (sectionId) {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo(0, 0);
    }
  };

  const accountLabel = (() => {
    if (!currentUser) return 'Sign In';
    if (isSuperAdminRole(currentUser.role)) return 'Super Admin';
    if (currentUser.role === 'sug_admin' || currentUser.role === 'sug_president') return 'SUG Admin';
    return currentUser.fullName.split(' ')[0];
  })();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text wordmark */}
        <button
          type="button"
          onClick={() => navigate('home')}
          className="text-lg font-display font-bold tracking-tight text-[#16A34A] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded"
        >
          ABSU LodgeSafe
        </button>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => navigate('home', 'lodges-catalog')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#16A34A] ${
              activePage === 'home' ? 'text-[#111827] font-semibold' : ''
            }`}
          >
            Browse Lodges
          </button>
          <button
            type="button"
            onClick={() => navigate('home', 'how-it-works')}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#16A34A]"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => navigate('policies')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#16A34A] ${
              activePage === 'policies' ? 'text-[#111827] font-semibold' : ''
            }`}
          >
            Policies
          </button>
          <button
            type="button"
            onClick={goToDashboard}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#16A34A] ${
              activePage.endsWith('dashboard') ? 'text-[#111827] font-semibold' : ''
            }`}
          >
            My Dashboard
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-[#16A34A] rounded-xl hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
          >
            {accountLabel}
          </button>
          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden p-2 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
          <button
            type="button"
            onClick={() => navigate('home', 'lodges-catalog')}
            className="block w-full text-left py-2.5 text-sm font-medium text-slate-700"
          >
            Browse Lodges
          </button>
          <button
            type="button"
            onClick={() => navigate('home', 'how-it-works')}
            className="block w-full text-left py-2.5 text-sm font-medium text-slate-700"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => navigate('policies')}
            className="block w-full text-left py-2.5 text-sm font-medium text-slate-700"
          >
            Policies
          </button>
          <button
            type="button"
            onClick={goToDashboard}
            className="block w-full text-left py-2.5 text-sm font-semibold text-[#16A34A]"
          >
            My Dashboard
          </button>
        </div>
      )}
    </header>
  );
}
