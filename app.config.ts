// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

// Identidade fixa do Urbico. Nenhum destes valores deve ser derivado ou
// gerado automaticamente — são a identidade definitiva do app nas lojas e no
// deep link (ver objetivo "Identidade do aplicativo").
const env = {
  appName: "Urbico",
  appSlug: "urbico",
  scheme: "urbico",
  iosBundleId: "com.app.urbico",
  androidPackage: "com.app.urbico",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "dark",
  // FIX: `newArchEnabled` foi removido do app.config a partir do Expo SDK 55
  // — a partir dessa versão a Nova Arquitetura é a única opção (não existe
  // mais Legacy Architecture para alternar), então esta chave ficou obsoleta
  // e sem efeito no SDK 57. Removida.
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
      "ITSAppUsesNonExemptEncryption": false
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS", "ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_LOCATION"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    // FIX: "static" fazia o Expo Router pré-renderizar cada rota no
    // servidor Node (SSR) antes de mandar pro navegador. Como o Urbico é um
    // app mobile e o preview web é só conveniência de desenvolvimento (sem
    // necessidade de HTML pré-gerado por rota para SEO), isso só trazia
    // problemas: código que assume ambiente de navegador (Reanimated usando
    // requestAnimationFrame, Supabase/AsyncStorage usando window/
    // localStorage) quebrava ao rodar no Node, onde esses globais não
    // existem. "single" gera uma SPA pura, 100% client-side, sem esse SSR.
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "@maplibre/maplibre-react-native",
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Permita que o Urbico use sua localização para orientar deslocamentos.",
        locationAlwaysAndWhenInUsePermission: "Permita que o Urbico acompanhe sua localização apenas durante alertas de saída ativados.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-speech-recognition",
      {
        microphonePermission: "Permita que o Urbico use o microfone para conversar com o Norby.",
        speechRecognitionPermission: "Permita que o Urbico reconheça sua fala para conversar com o Norby.",
        androidSpeechServicePackages: ["com.google.android.googlequicksearchbox"],
      },
    ],
    [
      "expo-notifications",
      {
        color: "#087DF5",
        defaultChannel: "urbico-travel",
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
