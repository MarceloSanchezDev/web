import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.basketstaff.app',
  appName: 'Basket Staff',
  webDir: 'dist',
  android: {
    // HTTPS conserva un origen seguro dentro del WebView.
    scheme: 'https'
  }
};

export default config;
