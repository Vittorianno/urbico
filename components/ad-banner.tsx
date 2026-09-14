import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import mobileAds, { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

import { colors } from "@/components/urbico-ui";

// FIX (AdMob): SDK só precisa ser inicializado uma vez por processo, não uma
// vez por componente montado — sem essa trava, cada tela com <AdBanner />
// chamaria initialize() de novo (não quebra nada, mas gera chamadas
// redundantes ao SDK nativo).
let adsInitialized = false;
function ensureAdsInitialized() {
  if (adsInitialized) return;
  adsInitialized = true;
  mobileAds()
    .initialize()
    .catch((error) => {
      adsInitialized = false;
      console.warn("[AdMob] falha ao inicializar:", error);
    });
}

// FIX: sempre IDs de TESTE oficiais do Google em desenvolvimento (__DEV__) ou
// enquanto EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID não estiver configurado —
// clicar/impressionar anúncio real durante testes viola a política do AdMob
// e pode banir a conta. Preencha EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID (AdMob
// Console → seu app → Blocos de anúncios → Banner → ID do bloco) só para o
// build de produção real.
const PRODUCTION_BANNER_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID;
const bannerUnitId = __DEV__ || !PRODUCTION_BANNER_UNIT_ID ? TestIds.ADAPTIVE_BANNER : PRODUCTION_BANNER_UNIT_ID;

/**
 * Área reservada e padronizada de publicidade (AdMob). Usa o formato
 * adaptativo oficial (ANCHORED_ADAPTIVE_BANNER): a largura acompanha o
 * espaço disponível na tela e a altura é calculada pelo próprio AdMob para
 * aquela largura — nunca esticado/comprimido manualmente com porcentagens
 * fixas. Enquanto o anúncio não carregou (ou falhou), não reserva nenhum
 * espaço vazio na tela, para não deixar uma área em branco chamativa.
 *
 * Nunca use isto dentro do Mapa, do chat do Norby ou da tela de Rotas — o
 * objetivo é uma área própria e discreta, não sobreposta a conteúdo
 * interativo (ver decisão de produto sobre posicionamento de anúncios).
 */
export function AdBanner() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    ensureAdsInitialized();
  }, []);

  return (
    <View style={[styles.container, !loaded && styles.hidden]}>
      <BannerAd
        unitId={bannerUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  hidden: {
    height: 0,
    overflow: "hidden",
    paddingVertical: 0,
  },
});
