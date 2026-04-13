import React, { useState, useEffect } from 'react';
import { Palette, Moon, Waves, TreePine, Sun, Crown, Heart, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const themes = [
  { id: 'dark', name: 'Dark Mode', icon: Moon, color: '#0f172a', accent: '#06b6d4' },
  { id: 'ocean-blue', name: 'Ocean Blue', icon: Waves, color: '#0c4a6e', accent: '#0ea5e9' },
  { id: 'forest-green', name: 'Forest Green', icon: TreePine, color: '#14532d', accent: '#22c55e' },
  { id: 'sunset-orange', name: 'Sunset Orange', icon: Sun, color: '#7c2d12', accent: '#f97316' },
  { id: 'royal-purple', name: 'Royal Purple', icon: Crown, color: '#3b0764', accent: '#8b5cf6' },
  { id: 'rose-pink', name: 'Rose Pink', icon: Heart, color: '#831843', accent: '#ec4899' },
];

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('mg-theme') || 'dark';
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId);
    localStorage.setItem('mg-theme', themeId);
    document.documentElement.setAttribute('data-theme', themeId);
  };

  const activeTheme = themes.find(t => t.id === currentTheme) || themes[0];
  const ActiveIcon = activeTheme.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="flex items-center gap-2 hover:bg-white/10"
          data-testid="theme-switcher-btn"
        >
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: activeTheme.accent }}
          >
            <ActiveIcon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="hidden sm:block text-sm" style={{ color: 'hsl(var(--theme-header-foreground))' }}>
            Theme
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-56"
        style={{ 
          backgroundColor: 'hsl(var(--theme-sidebar))',
          borderColor: 'hsl(var(--border))'
        }}
        data-testid="theme-dropdown-menu"
      >
        <DropdownMenuLabel 
          className="text-xs uppercase tracking-wider"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          Choose Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator style={{ backgroundColor: 'hsl(var(--border))' }} />
        
        {themes.map((theme) => {
          const Icon = theme.icon;
          const isActive = currentTheme === theme.id;
          
          return (
            <DropdownMenuItem
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className="cursor-pointer flex items-center justify-between gap-3 py-2.5 px-3 rounded-md transition-colors"
              style={{ 
                color: 'hsl(var(--theme-sidebar-foreground))',
                backgroundColor: isActive ? 'hsl(var(--accent))' : 'transparent'
              }}
              data-testid={`theme-option-${theme.id}`}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: theme.color }}
                >
                  <Icon className="w-4 h-4" style={{ color: theme.accent }} />
                </div>
                <span className="font-medium text-sm">{theme.name}</span>
              </div>
              {isActive && (
                <Check className="w-4 h-4" style={{ color: theme.accent }} />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
