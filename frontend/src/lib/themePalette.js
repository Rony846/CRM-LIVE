/**
 * Theme-aware palette for Recharts series colors, grid lines, axis ticks
 * and pie/donut slices. Recharts wants concrete colour strings (CSS vars
 * don't pass through), so we read `data-theme` off the document root and
 * return the right hex codes per theme. Subscribes to attribute mutations
 * so charts re-paint when the user switches themes from the dropdown.
 */
import { useEffect, useState } from 'react';

const PALETTES = {
  // Obsidian Elite — dark "command center"
  obsidian: {
    line:     '#c3c0ff', // lavender — primary series for lines/areas
    bar:      '#4f46e5', // cobalt — primary series for bars
    success:  '#a4d64c', // acid lime
    warning:  '#ffb695', // peach
    danger:   '#ffb4ab', // soft red
    accent:   '#c3c0ff',
    grid:     '#ffffff', gridOpacity: 0.06,
    axis:     '#8a8794',
    tooltipBg: 'hsl(0 0% 10%)',
    activeDotStroke: '#131313',
    pie: ['#4f46e5', '#c3c0ff', '#a4d64c', '#ffb695', '#ffb4ab', '#8a8794'],
  },
  // Lumina Prime — light "executive precision"
  lumina: {
    line:     '#131b2e', // navy
    bar:      '#000000', // pure black per design
    success:  '#047857', // emerald-700
    warning:  '#b45309', // amber-700
    danger:   '#be123c', // rose-700
    accent:   '#131b2e',
    grid:     '#191c1e', gridOpacity: 0.08,
    axis:     '#45464d',
    tooltipBg: '#ffffff',
    activeDotStroke: '#ffffff',
    pie: ['#131b2e', '#505f76', '#7c839b', '#bec6e0', '#b45309', '#be123c'],
  },
};

// Themes we haven't explicitly tuned chart colours for fall back to Obsidian
// (since it's the system default).
const FALLBACK = PALETTES.obsidian;

function currentTheme() {
  if (typeof document === 'undefined') return 'obsidian';
  return document.documentElement.dataset.theme || 'obsidian';
}

export function getChartPalette() {
  return PALETTES[currentTheme()] || FALLBACK;
}

/** React hook — re-renders the consuming chart when the document theme changes. */
export function useChartPalette() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const target = document.documentElement;
    // Resync once on mount (e.g. App.js sets data-theme after first paint).
    setTheme(target.dataset.theme || 'obsidian');
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-theme') {
          setTheme(target.dataset.theme || 'obsidian');
        }
      }
    });
    obs.observe(target, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return PALETTES[theme] || FALLBACK;
}
