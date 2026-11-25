// frontend/src/components/GlobalSearch.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Phone, X, AlertCircle } from 'lucide-react';
import { getPatients } from '@/lib/api';
import { Patient } from '@/lib/types';
import PatientProfileModal from './PatientProfileModal';

export default function GlobalSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getPatients(searchTerm.trim());
        setResults(data.patients || []);
        setIsOpen(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative w-full max-w-md" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search MR No (e.g. MR-2026-0001), Name, or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            className="w-full pl-10 pr-9 py-2 text-sm bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 border border-transparent focus:border-blue-500 rounded-xl transition duration-150 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setIsOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-400">Searching Central Records...</div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                No patients found matching &ldquo;{searchTerm}&rdquo;
              </div>
            ) : (
              <div className="py-1 divide-y divide-slate-100 dark:divide-slate-800/50">
                {results.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatientId(patient.id);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50/70 dark:hover:bg-slate-800/60 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {patient.name}
                          </span>
                          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                            {patient.mr_no}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{patient.gender}</span>
                          <span>•</span>
                          <span>{patient.phone}</span>
                          {patient.blood_group && (
                            <>
                              <span>•</span>
                              <span className="font-bold text-red-500">{patient.blood_group}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition">
                      Open Profile &rarr;
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPatientId && (
        <PatientProfileModal
          patientId={selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
        />
      )}
    </>
  );
}
