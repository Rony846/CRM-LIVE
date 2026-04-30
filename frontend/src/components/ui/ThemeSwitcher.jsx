import React from 'react';
import { Moon, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Theme indicator - MuscleGrid Pro uses a single premium dark theme
 * for guaranteed text visibility and professional appearance.
 */
export default function ThemeSwitcher() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="flex items-center gap-2 hover:bg-white/10 cursor-default"
            data-testid="theme-indicator-btn"
          >
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center bg-cyan-500"
            >
              <Moon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="hidden sm:block text-sm text-slate-300">
              Pro Theme
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom"
          className="bg-slate-800 text-slate-100 border-slate-700"
        >
          <p className="text-xs">MuscleGrid Pro Dark Theme</p>
          <p className="text-xs text-slate-400">Optimized for visibility</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
