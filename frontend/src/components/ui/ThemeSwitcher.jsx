import React, { useState, useEffect } from 'react';
import { Moon, Sun, Sparkles, Leaf, Check, Palette, Gem, Sprout, Snowflake } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// MuscleGrid Command Deck — the only four themes.
const themes = [
  {
    id: 'hud-dark',
    name: 'Arc Dark',
    description: 'Deep-space HUD · cyan glow',
    icon: Moon,
    preview: '#04070e',
    accent: '#38bdf8',
    type: 'dark',
  },
  {
    id: 'hud-platinum',
    name: 'Platinum',
    description: 'Cool slate · indigo · pro',
    icon: Gem,
    preview: '#eef0f5',
    accent: '#4f46e5',
    type: 'light',
  },
  {
    id: 'hud-ivory',
    name: 'Ivory',
    description: 'Warm paper · emerald · pro',
    icon: Sprout,
    preview: '#f1ece1',
    accent: '#0f9d63',
    type: 'light',
  },
  {
    id: 'hud-frost',
    name: 'Frost',
    description: 'Crisp white · teal · pro',
    icon: Snowflake,
    preview: '#e8eef0',
    accent: '#0f766e',
    type: 'light',
  },
  {
    id: 'hud-light',
    name: 'Holo Bright',
    description: 'Holographic light · cyan',
    icon: Sun,
    preview: '#e9f0f8',
    accent: '#0284c7',
    type: 'light',
  },
  {
    id: 'hud-pink',
    name: 'Neon Pink',
    description: 'Midnight magenta glow',
    icon: Sparkles,
    preview: '#0a0410',
    accent: '#ff4fd8',
    type: 'dark',
  },
  {
    id: 'hud-green',
    name: 'Matrix Green',
    description: 'Phosphor green terminal',
    icon: Leaf,
    preview: '#03100a',
    accent: '#22e88a',
    type: 'dark',
  },
];

const DEFAULT_THEME = 'hud-platinum';
const VALID = themes.map((t) => t.id);

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    // One-time migration: Platinum is now the CRM default. Roll everyone
    // onto it once (bump the key to re-run when the default changes).
    if (!localStorage.getItem('mg-theme-v4')) {
      localStorage.setItem('mg-theme', DEFAULT_THEME);
      localStorage.setItem('mg-theme-v4', '1');
    }
    let saved = localStorage.getItem('mg-theme') || DEFAULT_THEME;
    if (!VALID.includes(saved)) {
      saved = DEFAULT_THEME;
      localStorage.setItem('mg-theme', saved);
    }
    setCurrentTheme(saved);
    applyTheme(saved);
  }, []);

  const applyTheme = (themeId) => {
    const theme = themes.find((t) => t.id === themeId) || themes[0];
    document.documentElement.setAttribute('data-theme', theme.id);
    if (theme.type === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId);
    localStorage.setItem('mg-theme', themeId);
    applyTheme(themeId);
  };

  const activeTheme = themes.find((t) => t.id === currentTheme) || themes[0];
  const ActiveIcon = activeTheme.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 hover:bg-white/10 transition-all duration-200"
          data-testid="theme-switcher-btn"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${activeTheme.preview} 0%, ${activeTheme.accent} 100%)` }}
          >
            <ActiveIcon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="hidden sm:block text-sm font-medium" style={{ color: 'hsl(var(--theme-sidebar-foreground))' }}>
            Theme
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 p-2"
        style={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '1rem' }}
        data-testid="theme-dropdown-menu"
      >
        <DropdownMenuLabel
          className="text-xs uppercase tracking-wider font-semibold px-2 py-1.5 flex items-center gap-2"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          <Palette className="w-3.5 h-3.5" />
          Command Deck Themes
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-2" style={{ backgroundColor: 'hsl(var(--border))' }} />

        <div className="space-y-1">
          {themes.map((theme) => {
            const Icon = theme.icon;
            const isActive = currentTheme === theme.id;
            return (
              <DropdownMenuItem
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className="cursor-pointer flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 focus:outline-none"
                style={{
                  color: 'hsl(var(--popover-foreground))',
                  backgroundColor: isActive ? 'hsl(var(--accent))' : 'transparent',
                }}
                data-testid={`theme-option-${theme.id}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md transition-transform hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${theme.preview} 0%, ${theme.accent} 100%)`, boxShadow: `0 0 14px ${theme.accent}55` }}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{theme.name}</div>
                    <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {theme.description}
                    </div>
                  </div>
                </div>
                {isActive && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.accent }}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="my-2" style={{ backgroundColor: 'hsl(var(--border))' }} />
        <div
          className="text-xs px-3 py-2 rounded-lg"
          style={{ color: 'hsl(var(--muted-foreground))', backgroundColor: 'hsl(var(--muted))' }}
        >
          3 dark HUD + 4 bright pro themes · the whole CRM retints instantly
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
