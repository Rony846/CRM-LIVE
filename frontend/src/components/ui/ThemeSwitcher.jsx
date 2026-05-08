import React, { useState, useEffect } from 'react';
import { Moon, Waves, TreePine, Sun, Heart, Check, Palette } from 'lucide-react';
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
  { 
    id: 'pro-dark', 
    name: 'Pro Dark', 
    description: 'Midnight elegance',
    icon: Moon, 
    preview: '#0f172a',
    accent: '#3B82F6',
    type: 'dark'
  },
  { 
    id: 'pro-ocean', 
    name: 'Pro Ocean', 
    description: 'Calm & professional',
    icon: Waves, 
    preview: '#0284c7',
    accent: '#0EA5E9',
    type: 'light'
  },
  { 
    id: 'pro-forest', 
    name: 'Pro Forest', 
    description: 'Natural & refreshing',
    icon: TreePine, 
    preview: '#16a34a',
    accent: '#22C55E',
    type: 'light'
  },
  { 
    id: 'pro-sunset', 
    name: 'Pro Sunset', 
    description: 'Warm & energetic',
    icon: Sun, 
    preview: '#ea580c',
    accent: '#F97316',
    type: 'light'
  },
  { 
    id: 'pro-rose', 
    name: 'Pro Rose', 
    description: 'Elegant & modern',
    icon: Heart, 
    preview: '#db2777',
    accent: '#EC4899',
    type: 'light'
  },
];

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState('pro-dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('mg-theme') || 'pro-dark';
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (themeId) => {
    const theme = themes.find(t => t.id === themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    
    // Add or remove dark class based on theme type
    if (theme?.type === 'dark') {
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

  const activeTheme = themes.find(t => t.id === currentTheme) || themes[0];
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
            style={{ 
              background: `linear-gradient(135deg, ${activeTheme.preview} 0%, ${activeTheme.accent} 100%)`
            }}
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
        style={{ 
          backgroundColor: 'hsl(var(--popover))',
          borderColor: 'hsl(var(--border))',
          borderRadius: '1rem'
        }}
        data-testid="theme-dropdown-menu"
      >
        <DropdownMenuLabel 
          className="text-xs uppercase tracking-wider font-semibold px-2 py-1.5 flex items-center gap-2"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          <Palette className="w-3.5 h-3.5" />
          Pro Themes
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
                  backgroundColor: isActive ? 'hsl(var(--accent))' : 'transparent'
                }}
                data-testid={`theme-option-${theme.id}`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md transition-transform hover:scale-105"
                    style={{ 
                      background: `linear-gradient(135deg, ${theme.preview} 0%, ${theme.accent} 100%)`
                    }}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{theme.name}</div>
                    <div 
                      className="text-xs"
                      style={{ color: 'hsl(var(--muted-foreground))' }}
                    >
                      {theme.description}
                    </div>
                  </div>
                </div>
                {isActive && (
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: theme.accent }}
                  >
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
          style={{ 
            color: 'hsl(var(--muted-foreground))',
            backgroundColor: 'hsl(var(--muted))'
          }}
        >
          All Pro themes ensure perfect text visibility
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
