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

// FIX (AdMob): IDs de APP de TESTE oficiais do Google — documentados
// publicamente em https://developers.google.com/admob/android/test-ads e
// .../ios/test-ads, não são segredo nenhum. Usados como fallback sempre que
// EXPO_PUBLIC_ADMOB_ANDROID_APP_ID/EXPO_PUBLIC_ADMOB_IOS_APP_ID não estiverem
// definidos — assim o app builda e mostra anúncios de teste mesmo antes de
// você ter uma conta AdMob própria. Troque para os seus IDs reais (do
// AdMob Console → Apps → seu app → ID do app) no .env quando tiver.
const GOOGLE_TEST_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const GOOGLE_TEST_IOS_APP_ID = "ca-app-pub-3940256099942544~1458002511";

// FIX (auditoria — branch feature/norby-local-llama): react-native-google-mobile-ads
// 16.5.0 traz play-services-ads 25.4.0, compilado com metadados Kotlin 2.3.0
// — mais novo do que o compilador Kotlin deste projeto (2.1.20) consegue
// ler ("Module was compiled with an incompatible version of Kotlin").
// Isso é um problema real e separado do trabalho do Llama local, não algo
// que devo arriscar "consertar" às pressas sem testar isoladamente.
// Desativado SÓ NESTA BRANCH para não bloquear a validação do llama.rn (que
// já compila limpo). Resolver isso na main é tarefa separada — provavelmente
// vai precisar de outra versão do react-native-google-mobile-ads ou de
// bump do Kotlin do projeto via expo-build-properties, mas isso não deve
// ser testado no mesmo build que ainda está validando o motor local.
const ADMOB_TEMPORARILY_DISABLED = true;

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
    // FIX (AdMob): plugin de config nativo do react-native-google-mobile-ads
    // — precisa rodar `npx expo install react-native-google-mobile-ads` e
    // depois `pnpm expo prebuild` (ou um build EAS) para os IDs abaixo
    // entrarem de fato no AndroidManifest.xml/Info.plist; não tem efeito no
    // preview web nem no Expo Go, só em development build nativo. Ver
    // components/ad-banner.tsx para o componente de anúncio em si.
    // Temporariamente comentado nesta branch (ver ADMOB_TEMPORARILY_DISABLED acima).
    ...(ADMOB_TEMPORARILY_DISABLED
      ? []
      : [
          [
            "react-native-google-mobile-ads",
            {
              androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ?? GOOGLE_TEST_ANDROID_APP_ID,
              iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? GOOGLE_TEST_IOS_APP_ID,
            },
          ] as const,
        ]),
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
    // FIX (auditoria — Inconsistent JVM Target Compatibility): ver
    // plugins/withAndroidKotlinJvmTarget.js. Precisa vir depois dos outros
    // plugins que mexem em android/build.gradle, para o bloco `subprojects`
    // que ele injeta valer para todos os módulos já registrados.
    "./plugins/withAndroidKotlinJvmTarget",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
