import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

import { ScreenContainer } from "@/components/screen-container";
import { UrbicoMap } from "@/components/urbico-map";
import { colors } from "@/components/urbico-ui";
import { useUrbico } from "@/lib/urbico-context";
import { speakNorby, stopNorbyVoice } from "@/lib/norby-voice";
import { trpc } from "@/lib/trpc";

const iconGlyphs: Record<string, string> = { "arrow-back": "‹", "more-vert": "⋮", "smart-toy": "◉", "business-center": "▣", "directions-bus": "▣", "schedule": "◷", home: "⌂", "chevron-right": "›", mic: "◉", stop: "■", add: "+", send: "➤", "hourglass-top": "◷", "format-list-bulleted": "☷", "alt-route": "⌁", place: "●", "directions-walk": "●" };

function NorbyIcon({ name, size = 22, color }: { name: string; size?: number; color: string }) {
  return <Text style={{ color, fontSize: size, lineHeight: size + 3, fontWeight: "800" }}>{iconGlyphs[name] ?? "•"}</Text>;
}

const prompts = [
  { text: "Como chego ao trabalho?", icon: "business-center" as const },
  { text: "Próximos ônibus", icon: "directions-bus" as const },
  { text: "Quando meu ônibus chega?", icon: "schedule" as const },
  { text: "Quero ir para casa", icon: "home" as const },
];

function NorbyAvatar({ large = false }: { large?: boolean }) {
  return (
    <View style={[styles.avatarGlow, large && styles.avatarGlowLarge]}>
      <View style={[styles.avatarShell, large && styles.avatarShellLarge]}>
        <View style={[styles.avatarFace, large && styles.avatarFaceLarge]}>
          <View style={styles.avatarEyes}><View style={styles.avatarEye} /><View style={styles.avatarEye} /></View>
          <View style={styles.avatarSmile} />
        </View>
      </View>
      <View style={styles.onlineDot} />
    </View>
  );
}

export default function NorbyScreen() {
  const { messages, sendMessage, addNorbyMessage, voiceEnabled, activeRoute, currentLocation, startTrip } = useUrbico();
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showConversation, setShowConversation] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const transcriptRef = useRef("");
  const completedTurnRef = useRef(false);
  const chatMutation = trpc.norby.chat.useMutation();

  const askNorby = async (question: string) => {
    const message = question.trim();
    if (!message || chatMutation.isPending) return;
    sendMessage(message);
    setDraft("");
    setShowConversation(true);
    try {
      const response = await chatMutation.mutateAsync({ message });
      addNorbyMessage(response.message);
      if (voiceEnabled) void speakNorby(response.message);
    } catch {
      addNorbyMessage("Não consegui consultar o serviço do Norby agora. Tente novamente em instantes.");
    }
  };

  const submit = () => { void askNorby(draft); };
  const finishVoiceTurn = (spokenText?: string) => {
    if (completedTurnRef.current) return;
    const finalText = (spokenText ?? transcriptRef.current).trim();
    setIsListening(false);
    if (!finalText) return;
    completedTurnRef.current = true;
    transcriptRef.current = "";
    setDraft("");
    void askNorby(finalText);
  };

  useSpeechRecognitionEvent("result", (event) => {
    const candidate = event.results?.[0]?.transcript?.trim() ?? "";
    if (!candidate) return;
    transcriptRef.current = candidate;
    setDraft(candidate);
    if (event.isFinal) finishVoiceTurn(candidate);
  });
  useSpeechRecognitionEvent("speechend", () => finishVoiceTurn());
  useSpeechRecognitionEvent("end", () => { setIsListening(false); finishVoiceTurn(); });
  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    if (event.error !== "aborted") setVoiceError(event.error === "no-speech" ? "Não detectei fala. Tente novamente." : "A escuta não pôde ser concluída. Tente novamente.");
  });

  const startVoiceTurn = async () => {
    if (!voiceEnabled) {
      Alert.alert("Voz desativada", "Ative a entrada por voz nas configurações para conversar com o Norby.");
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize o microfone e o reconhecimento de fala para conversar por voz.");
      return;
    }
    await stopNorbyVoice();
    completedTurnRef.current = false;
    transcriptRef.current = "";
    setVoiceError(null);
    setShowConversation(true);
    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: "pt-BR",
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1400 },
      iosTaskHint: "dictation",
      volumeChangeEventOptions: { enabled: true, intervalMillis: 200 },
    });
  };

  const stopVoiceTurn = () => {
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  };

  const showAbout = () => Alert.alert("Sobre o Norby", "Seu assistente de mobilidade para consultar linhas, organizar rotas e acompanhar decisões de viagem.");
  const showMore = () => Alert.alert("Opções do Norby", "Você pode consultar ônibus, planejar uma rota ou abrir suas configurações de voz.", [{ text: "Fechar", style: "cancel" }, { text: "Abrir Perfil", onPress: () => router.push("/profile") }]);
  const showComposerOptions = () => Alert.alert("Adicionar ao chat", "Escolha uma ação rápida.", [{ text: "Cancelar", style: "cancel" }, { text: "Planejar rota", onPress: () => router.push("/routes") }, { text: "Consultar ônibus", onPress: () => setDraft("Próximos ônibus") }]);

  if (!showConversation) {
    return (
      <ScreenContainer>
        <View style={styles.landing}>
          <Text style={styles.landingTitle}>Norby</Text>
          <NorbyAvatar large />
          <Text style={styles.welcomeTitle}>Olá! Eu sou o Norby.</Text>
          <Text style={styles.welcomeText}>Como posso te ajudar?</Text>
          <View style={styles.promptList}>{prompts.map((prompt) => <Pressable key={prompt.text} onPress={() => void askNorby(prompt.text)} style={({ pressed }) => [styles.prompt, pressed && styles.pressed]}><NorbyIcon name={prompt.icon} size={21} color={colors.text} /><Text style={styles.promptText}>{prompt.text}</Text><NorbyIcon name="chevron-right" size={21} color={colors.muted} /></Pressable>)}</View>
          <Pressable onPress={() => void startVoiceTurn()} style={({ pressed }) => [styles.voicePrompt, isListening && styles.voicePromptActive, pressed && styles.pressed]}><NorbyIcon name={isListening ? "stop" : "mic"} size={21} color={isListening ? "#FFFFFF" : colors.blue} /><Text style={[styles.voicePromptText, isListening && styles.voicePromptTextActive]}>{isListening ? "Ouvindo — pare de falar para enviar" : "Falar com Norby"}</Text></Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.chatScreen}>
        <View style={styles.chatHeader}>
          <Pressable accessibilityLabel="Voltar" onPress={() => setShowConversation(false)} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}><NorbyIcon name="arrow-back" size={29} color={colors.text} /></Pressable>
          <View style={styles.headerCenter}><Text style={styles.chatTitle}>Norby</Text><Text style={styles.chatSubtitle}>Seu assistente de mobilidade</Text></View>
          <Pressable accessibilityLabel="Mais opções" onPress={showMore} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}><NorbyIcon name="more-vert" size={28} color={colors.text} /></Pressable>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<>
            <View style={styles.profileRow}><NorbyAvatar large /><View style={styles.profileCopy}><View style={styles.nameLine}><Text style={styles.profileName}>Norby</Text><View style={styles.onlineBadge}><Text style={styles.onlineText}>ONLINE</Text></View></View><Text style={styles.profileDescription}>Estou aqui para te ajudar <Text style={styles.busEmoji}>🚌</Text> <Text style={styles.heartEmoji}>♥</Text></Text></View><Pressable onPress={showAbout} style={({ pressed }) => [styles.aboutButton, pressed && styles.pressed]}><Text style={styles.aboutText}>Sobre o Norby</Text></Pressable></View>
            {activeRoute ? <RouteCard onStart={() => { startTrip(); router.push("/trip"); }} /> : null}
          </>}
          renderItem={({ item }) => {
            const isUser = item.role === "user";
            return <View style={[styles.messageRow, isUser && styles.messageRowUser]}>{!isUser ? <NorbyAvatar /> : null}<View style={[styles.messageColumn, isUser && styles.messageColumnUser]}><View style={[styles.messageBubble, isUser ? styles.userMessage : styles.norbyMessage]}><Text style={[styles.messageText, isUser && styles.userMessageText]}>{item.content}</Text></View><Text style={[styles.messageTime, isUser && styles.messageTimeUser]}>{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{isUser ? "  ✓✓" : ""}</Text></View></View>;
          }}
        />

        {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
        <View style={styles.composer}>
          <Pressable accessibilityLabel="Adicionar ação" onPress={showComposerOptions} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><NorbyIcon name="add" size={27} color={colors.blue} /></Pressable>
          <TextInput editable={!chatMutation.isPending} value={draft} onChangeText={setDraft} onSubmitEditing={submit} placeholder="Digite sua mensagem..." placeholderTextColor={colors.muted} style={styles.composerInput} returnKeyType="send" />
          <Pressable accessibilityLabel={isListening ? "Encerrar fala" : "Falar com Norby"} onPress={() => isListening ? stopVoiceTurn() : void startVoiceTurn()} style={({ pressed }) => [styles.composerMic, isListening && styles.composerMicActive, pressed && styles.pressed]}><NorbyIcon name={isListening ? "stop" : "mic"} size={23} color={isListening ? "#FFFFFF" : colors.blue} /></Pressable>
          <Pressable accessibilityLabel="Enviar mensagem" disabled={chatMutation.isPending || !draft.trim()} onPress={submit} style={({ pressed }) => [styles.send, (pressed || chatMutation.isPending) && styles.pressed, !draft.trim() && styles.sendDisabled]}><NorbyIcon name={chatMutation.isPending ? "hourglass-top" : "send"} size={21} color="#FFFFFF" /></Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

function RouteCard({ onStart }: { onStart: () => void }) {
  const { activeRoute, currentLocation } = useUrbico();
  if (!activeRoute) return null;
  const minutes = Math.max(1, Math.ceil(activeRoute.durationSeconds / 60));
  return <View style={styles.routeCard}><Text style={styles.routeIntro}>Aqui está uma rota preparada para você:</Text><View style={styles.routeMap}><UrbicoMap center={activeRoute.origin} userLocation={currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null} path={activeRoute.points} vehicles={[]} stops={[]} /></View><View style={styles.routeSummary}><View style={styles.linePill}><NorbyIcon name="directions-bus" size={19} color="#FFFFFF" /><Text style={styles.linePillText}>{activeRoute.line?.label ?? "Rota urbana"}</Text></View><Text style={styles.routeMinutes}>{minutes} min</Text></View><View style={styles.routeMeta}><View style={styles.routeStep}><NorbyIcon name="directions-walk" size={18} color={colors.blue} /><Text style={styles.routeStepText}>Saída{`\n`}a pé</Text></View><View style={styles.routeDash} /><View style={styles.routeStep}><NorbyIcon name="directions-bus" size={18} color={colors.blue} /><Text style={styles.routeStepText}>Ônibus{`\n`}SPTrans</Text></View><View style={styles.routeDash} /><View style={styles.routeStep}><NorbyIcon name="place" size={18} color={colors.blue} /><Text style={styles.routeStepText}>Chegada{`\n`}destino</Text></View></View><View style={styles.routeActions}><Pressable onPress={() => Alert.alert("Etapas da rota", `${Math.round(activeRoute.distanceMeters)} m · ${minutes} min estimados.`, [{ text: "Fechar", style: "cancel" }])} style={({ pressed }) => [styles.outlineAction, pressed && styles.pressed]}><NorbyIcon name="format-list-bulleted" size={19} color={colors.blue} /><Text style={styles.outlineText}>Ver etapas</Text></Pressable><Pressable onPress={() => Alert.alert("Outras opções", "Abra Rotas para trocar origem, destino ou linha acompanhada.", [{ text: "Cancelar", style: "cancel" }, { text: "Abrir Rotas", onPress: () => router.push("/routes") }])} style={({ pressed }) => [styles.outlineAction, pressed && styles.pressed]}><NorbyIcon name="alt-route" size={19} color={colors.blue} /><Text style={styles.outlineText}>Outras opções</Text></Pressable><Pressable onPress={onStart} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><NorbyIcon name="send" size={19} color="#FFFFFF" /><Text style={styles.primaryText}>Iniciar viagem</Text></Pressable></View></View>;
}

const styles = StyleSheet.create({
  chatScreen: { flex: 1 },
  chatHeader: { minHeight: 78, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: colors.border },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  chatTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  chatSubtitle: { marginTop: 2, color: colors.muted, fontSize: 12 },
  messageList: { padding: 18, paddingBottom: 24, gap: 12 },
  profileRow: { minHeight: 105, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 15, marginBottom: 5 },
  profileCopy: { flex: 1 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileName: { color: colors.text, fontSize: 22, fontWeight: "800" },
  onlineBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(131, 65, 255, 0.2)", borderWidth: 1, borderColor: "#733CF5" },
  onlineText: { color: "#AA86FF", fontSize: 10, fontWeight: "800" },
  profileDescription: { marginTop: 7, color: colors.muted, fontSize: 15 },
  busEmoji: { color: colors.blue },
  heartEmoji: { color: "#19BFF2", fontSize: 20 },
  aboutButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 22, borderWidth: 1, borderColor: colors.blue, alignItems: "center", justifyContent: "center" },
  aboutText: { color: colors.blue, fontSize: 12, fontWeight: "700" },
  avatarGlow: { width: 47, height: 47, borderRadius: 24, backgroundColor: "rgba(0,120,255,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(83,214,255,0.4)" },
  avatarGlowLarge: { width: 70, height: 70, borderRadius: 35 },
  avatarShell: { width: 35, height: 31, borderRadius: 14, backgroundColor: "#DCEAF4", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#65C7ED" },
  avatarShellLarge: { width: 53, height: 46, borderRadius: 21, borderWidth: 3 },
  avatarFace: { width: 25, height: 19, borderRadius: 8, backgroundColor: "#07111D", alignItems: "center", justifyContent: "center" },
  avatarFaceLarge: { width: 38, height: 28, borderRadius: 12 },
  avatarEyes: { flexDirection: "row", gap: 7 },
  avatarEye: { width: 3, height: 7, borderRadius: 3, backgroundColor: colors.cyan },
  avatarSmile: { marginTop: 2, width: 9, height: 4, borderBottomWidth: 1.5, borderColor: colors.cyan, borderRadius: 4 },
  onlineDot: { position: "absolute", right: -1, bottom: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: "#31D158", borderWidth: 1.5, borderColor: colors.background },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  messageRowUser: { justifyContent: "flex-end" },
  messageColumn: { maxWidth: "82%" },
  messageColumnUser: { alignItems: "flex-end" },
  messageBubble: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18 },
  norbyMessage: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 5 },
  userMessage: { backgroundColor: colors.blue, borderBottomRightRadius: 5 },
  messageText: { color: colors.text, fontSize: 16, lineHeight: 22 },
  userMessageText: { color: "#FFFFFF" },
  messageTime: { marginTop: 5, marginLeft: 3, color: colors.muted, fontSize: 10 },
  messageTimeUser: { marginRight: 3 },
  routeCard: { marginTop: 3, padding: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  routeIntro: { color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: 10 },
  routeMap: { height: 180, overflow: "hidden", borderRadius: 15, backgroundColor: "#10233A" },
  routeSummary: { marginTop: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  linePill: { paddingHorizontal: 11, minHeight: 32, borderRadius: 9, backgroundColor: colors.blue, flexDirection: "row", alignItems: "center", gap: 7 },
  linePillText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  routeMinutes: { color: colors.text, fontSize: 24, fontWeight: "800" },
  routeMeta: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  routeStep: { flexDirection: "row", alignItems: "center", gap: 5 },
  routeStepText: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  routeDash: { flex: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.muted, marginHorizontal: 5 },
  routeActions: { marginTop: 13, flexDirection: "row", gap: 7 },
  outlineAction: { flex: 1, minHeight: 46, borderRadius: 18, borderWidth: 1, borderColor: colors.blue, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, paddingHorizontal: 4 },
  outlineText: { color: colors.blue, fontSize: 11, fontWeight: "700" },
  primaryAction: { flex: 1.15, minHeight: 46, borderRadius: 18, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, paddingHorizontal: 5 },
  primaryText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  composer: { minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 7, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  addButton: { width: 43, height: 43, borderRadius: 22, borderWidth: 2, borderColor: colors.blue, alignItems: "center", justifyContent: "center" },
  composerInput: { flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  composerMic: { width: 43, height: 43, borderRadius: 22, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  composerMicActive: { backgroundColor: colors.blue },
  send: { width: 43, height: 43, borderRadius: 22, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.45 },
  voiceError: { paddingHorizontal: 18, paddingBottom: 4, color: colors.warning, fontSize: 12 },
  landing: { flex: 1, alignItems: "center", padding: 20, paddingTop: 17 },
  landingTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  welcomeTitle: { marginTop: 22, color: colors.text, fontSize: 19, fontWeight: "700" },
  welcomeText: { marginTop: 3, color: colors.text, fontSize: 15 },
  promptList: { width: "100%", marginTop: 22, gap: 9 },
  prompt: { minHeight: 50, paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 13 },
  promptText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  voicePrompt: { width: "100%", marginTop: 12, minHeight: 51, borderRadius: 14, backgroundColor: colors.blueSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  voicePromptActive: { backgroundColor: colors.blue },
  voicePromptText: { color: colors.blue, fontSize: 14, fontWeight: "700" },
  voicePromptTextActive: { color: "#FFFFFF" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
