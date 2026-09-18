import { Alert, Platform } from "react-native";

/**
 * FIX (auditoria — "botão de confirmação não faz nada na Web"): Alert.alert
 * com múltiplos botões customizados (ex.: "Cancelar" / "Limpar") não tem
 * suporte confiável no react-native-web — o toque no gatilho é registrado
 * normalmente, mas nenhuma caixa de diálogo chega a aparecer na tela, então
 * a ação de confirmação nunca é executada. Isso afeta qualquer fluxo
 * destrutivo (limpar conversa, revogar monitoramento, excluir favorito/
 * contato, etc.) sempre que testado via Web (`npx expo start` aberto no
 * navegador) — que é como o ambiente deste projeto tem sido testado.
 *
 * confirmAsync() resolve o mesmo caso de uso de forma multiplataforma: no
 * Android/iOS usa Alert.alert normalmente; na Web usa window.confirm, que o
 * navegador de fato exibe. A API do chamador continua simples — só precisa
 * saber se a pessoa confirmou ou não.
 */
export function confirmAsync(title: string, message: string, confirmLabel = "Confirmar", destructive = false): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof window.confirm !== "function") return Promise.resolve(false);
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}
