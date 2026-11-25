// frontend/src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'SEHAT Hospital - Hospital Management System (HMS)',
  description: 'Privilege-based HMS powered by Next.js, PHP 8 REST API, SQLite, and Cloudflare R2 storage.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased font-sans">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
          <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-xs text-slate-500 text-center">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">SEHAT Hospital Management System</span> • Privilege-Based Access • Unified MR No Core
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live 5s Polling Active
                </span>
                <span>•</span>
                <span>PHP 8+ REST Engine</span>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
