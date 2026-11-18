import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.meupetchef.app',
  appName: 'Meu Pet Chef',
  webDir: 'dist',
  android: {
    allowMixedContent: true
  }
};

export default config;