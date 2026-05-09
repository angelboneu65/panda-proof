import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.colorpandamedia.pandaproof',
  appName: 'Panda AdLab',
  webDir: 'dist',
  bundledWebRuntime: false,

  // En producción la app carga el backend remoto (Render).
  // El frontend bundleado se sirve desde el WebView nativo.
  server: {
    androidScheme: 'https',
    // Para desarrollo en vivo, descomenta y apunta a tu IP local:
    // url: 'http://192.168.12.165:5173',
    // cleartext: true,
  },

  ios: {
    contentInset: 'always',
    backgroundColor: '#070812',
  },

  android: {
    backgroundColor: '#070812',
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#070812',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#070812',
    },
  },
};

export default config;
