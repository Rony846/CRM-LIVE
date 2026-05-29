import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wrapper config. `npm run build` emits to dist/, then
// `npx cap add android` / `npx cap sync` produce the native projects.
// (Native build needs the Android SDK / Xcode installed separately.)
const config: CapacitorConfig = {
  appId: 'in.musclegrid.staff',
  appName: 'MuscleGrid Staff',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
