"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'dw:recent-colors';
const MAX_RECENT_COLORS = 8;

type RecentColorsContextValue = {
  recentColors: string[];
  addColor: (color: string) => void;
  setColorAt: (index: number, color: string) => void;
  removeColor: (color: string) => void;
  setColors: (colors: string[]) => void;
};

const RecentColorsContext = createContext<RecentColorsContextValue | null>(null);

export function RecentColorsProvider({ children }: { children: React.ReactNode }) {
  const [recentColors, setRecentColors] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setRecentColors(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to load recent colors', e);
      }
    }
  }, []);

  const addColor = useCallback((color: string) => {
    if (!color || color === 'transparent') return;

    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      const updated = [color, ...filtered].slice(0, MAX_RECENT_COLORS);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save recent colors', e);
        }
      }

      return updated;
    });
  }, []);

  const setColorAt = useCallback((index: number, color: string) => {
    if (!color || color === 'transparent') return;
    if (index < 0 || index >= MAX_RECENT_COLORS) return;

    setRecentColors(prev => {
      const updated = [...prev];
      const existingIndex = updated.indexOf(color);
      if (existingIndex !== -1) {
        updated.splice(existingIndex, 1);
      }
      if (updated[index]) {
        updated.splice(index, 1);
      }
      updated.splice(index, 0, color);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save recent colors', e);
        }
      }

      return updated;
    });
  }, []);

  const removeColor = useCallback((color: string) => {
    setRecentColors(prev => {
      const updated = prev.filter(c => c !== color);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save recent colors', e);
        }
      }

      return updated;
    });
  }, []);

  const setColors = useCallback((colors: string[]) => {
    const filtered = colors.filter(c => c && c !== 'transparent').slice(0, MAX_RECENT_COLORS);
    setRecentColors(filtered);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      } catch (e) {
        console.error('Failed to save recent colors', e);
      }
    }
  }, []);

  const value: RecentColorsContextValue = { recentColors, addColor, setColorAt, removeColor, setColors };
  return (
    <RecentColorsContext.Provider value={value}>
      {children}
    </RecentColorsContext.Provider>
  );
}

export function useRecentColors() {
  const ctx = useContext(RecentColorsContext);
  if (!ctx) {
    throw new Error('useRecentColors must be used within RecentColorsProvider');
  }
  return ctx;
}
