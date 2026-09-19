'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GeocodingResult } from '@/services/geocoding/geocodingService';
import { IconSearch, IconClose, IconPin } from '@/components/common/Icons';

interface SearchBarProps {
  onSearch: (result: GeocodingResult) => void;
  onClear?: () => void;
  placeholder?: string;
}

export default function SearchBar({
  onSearch,
  onClear,
  placeholder = 'Where are you going?',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const { geocodeSearch } = await import(
        '@/services/geocoding/geocodingService'
      );
      const matches = await geocodeSearch(q, 6);
      setResults(matches);
      setIsOpen(matches.length > 0);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 250);
  };

  const handleSelect = (result: GeocodingResult) => {
    setQuery(result.displayName);
    setIsOpen(false);
    setResults([]);
    onSearch(result);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onClear?.();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', maxWidth: '520px' }}
    >
      <div className="pw-search">
        <span style={{ color: 'var(--pw-text-tertiary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <IconSearch size={16} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          aria-label="Search destination"
          id="search-bar"
        />
        {isLoading && (
          <span
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid var(--pw-border)',
              borderTopColor: 'var(--pw-primary)',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
              flexShrink: 0,
            }}
          />
        )}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--pw-text-tertiary)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Clear search"
          >
            <IconClose size={14} />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '6px',
            background: 'var(--pw-surface)',
            border: '1px solid var(--pw-border)',
            borderRadius: 'var(--pw-radius)',
            boxShadow: 'var(--pw-shadow-lg)',
            zIndex: 'var(--z-search)',
            overflow: 'hidden',
          }}
        >
          {results.map((r, i) => (
            <button
              key={`${r.name}-${i}`}
              type="button"
              onClick={() => handleSelect(r)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'var(--pw-text)',
                textAlign: 'left',
                borderBottom:
                  i < results.length - 1
                    ? '1px solid var(--pw-border-light)'
                    : 'none',
                transition: 'background var(--pw-transition)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--pw-primary-50)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'none')
              }
            >
              <span style={{ flexShrink: 0, color: 'var(--pw-text-tertiary)', display: 'flex', alignItems: 'center' }}>
                <IconPin size={15} />
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--pw-text-tertiary)',
                    marginTop: '2px',
                  }}
                >
                  {r.displayName}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
