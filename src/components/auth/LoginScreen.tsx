import React, { useState } from 'react';
import { ShieldCheck, Lock, LogOut, ArrowRight, RefreshCw } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { ImageWithFallback } from '../common/ImageWithFallback';

export const LoginScreen: React.FC = () => {
  const { firebaseUser, accessDeniedReason, login, logout, retryAuthBootstrap } = useCRM();
  const [signingIn, setSigningIn] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await login();
    } finally {
      setSigningIn(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryAuthBootstrap();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-black p-0.5">
            <ImageWithFallback
              src="/assets/aistudio/Screenshot_2026-11-23_132939_51fcd266.png"
              alt="Little Monk Travels Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Little Monk Travels CRM
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Operations, Sales & Accounts Workspace
            </p>
          </div>
        </div>

        {firebaseUser && accessDeniedReason ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm mb-1.5">
                <Lock className="w-4 h-4 shrink-0" />
                Access Authorization Required
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-200/90 leading-relaxed">
                {accessDeniedReason}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={retrying}
                onClick={handleRetry}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Connecting...' : 'Retry Connection'}
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out & Switch Account
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Sign in with your authorized Google Workspace account to access customer enquiries, quotations, confirmed bookings, fleet schedules, and financial ledgers.
            </p>

            <button
              type="button"
              disabled={signingIn}
              onClick={handleLogin}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span>{signingIn ? 'Authenticating...' : 'Sign in with Google'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>Protected by Firebase Authentication & Role-Based Security Rules</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
