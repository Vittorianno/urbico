import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors } from "@/components/urbico-ui";
import { useUrbico } from "@/lib/urbico-context";

const prompts = [
  { text: "Como chego ao trabalho?", icon: "business-center" as const },
  { text: "Próximos ônibus", icon: "directions-bus" as const },
  { text: "Quando meu ônibus chega?", icon: "schedule" as const },
  { text: "Quero ir para casa", icon: "home" as const },
];

export default function NorbyScreen() {
  const { messages, sendMessage, voiceEnabled } = useUrbico();
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showConversation, setShowConversation] = useState(false);

  const submit = () => {
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
    setShowConversation(true);
  };

  const choosePrompt = (text: string) => { sendMessage(text); setShowConversation(true); };

  if (showConversation) {
    return (
      <ScreenContainer>
        <View style={styles.chatScreen}>
          <View style={styles.chatHeader}><Pressable onPress={() => setShowConversation(false)} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={colors.text} /></Pressable><View style={styles.chatHeaderName}><View style={styles.headerRobot}><MaterialIcons name="smart-toy" size={19} color={colors.cyan} /></View><View><Text style={styles.chatTitle}>Norby</Text><Text style={styles.chatStatus}>{isListening ? "Norby está ouvindo..." : "Assistente de mobilidade"}</Text></View></View><Pressable onPress={() => setIsListening((value) => !value)} style={({ pressed }) => [styles.micHeader, isListening && styles.micHeaderActive, pressed && styles.pressed]}><MaterialIcons name="mic" size={20} color={isListening ? "#FFFFFF" : colors.blue} /></Pressable></View>
          <FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.messageList} renderItem={({ item }) => <View style={[styles.message, item.role === "user" ? styles.userMessage : styles.norbyMessage]}><Text style={[styles.messageText, item.role === "user" && styles.userMessageText]}>{item.content}</Text></View>} />
          <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={submit} placeholder="Escreva para o Norby" placeholderTextColor={colors.muted} style={styles.composerInput} returnKeyType="send" /><Pressable onPress={() => setIsListening((value) => !value)} style={({ pressed }) => [styles.composerMic, isListening && styles.composerMicActive, pressed && styles.pressed]}><MaterialIcons name="mic" size={21} color={isListening ? "#FFFFFF" : colors.blue} /></Pressable><Pressable onPress={submit} style={({ pressed }) => [styles.send, pressed && styles.pressed]}><MaterialIcons name="send" size={20} color="#FFFFFF" /></Pressable></View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.landing}>
        <Text style={styles.norbyTitle}>Norby</Text>
        <View style={styles.robotGlow}><View style={styles.robotShell}><View style={styles.robotFace}><View style={styles.eyes}><View style={styles.eye} /><View style={styles.eye} /></View><View style={styles.smile} /></View></View></View>
        <Text style={styles.welcomeTitle}>Olá! Eu sou o Norby.</Text>
        <Text style={styles.welcomeText}>Como posso te ajudar?</Text>
        <View style={styles.promptList}>{prompts.map((prompt) => <Pressable key={prompt.text} onPress={() => choosePrompt(prompt.text)} style={({ pressed }) => [styles.prompt, pressed && styles.pressed]}><MaterialIcons name={prompt.icon} size={20} color={colors.text} /><Text style={styles.promptText}>{prompt.text}</Text><MaterialIcons name="chevron-right" size={20} color={colors.muted} /></Pressable>)}</View>
        <Pressable onPress={() => setIsListening((value) => !value)} style={({ pressed }) => [styles.voicePrompt, isListening && styles.voicePromptActive, pressed && styles.pressed]}><MaterialIcons name="mic" size={20} color={isListening ? "#FFFFFF" : colors.blue} /><Text style={[styles.voicePromptText, isListening && styles.voicePromptTextActive]}>{voiceEnabled ? (isListening ? "Norby está ouvindo..." : "Falar com Norby") : "Ative a voz nas configurações"}</Text></Pressable>
        <Pressable onPress={() => router.push("/routes")} style={({ pressed }) => [styles.routeLink, pressed && styles.pressed]}><MaterialIcons name="alt-route" size={18} color={colors.blue} /><Text style={styles.routeLinkText}>Prefere planejar uma rota?</Text></Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  landing: { flex: 1, alignItems: "center", padding: 20, paddingTop: 17 }, norbyTitle: { color: colors.text, fontSize: 18, fontWeight: "700" }, robotGlow: { marginTop: 37, width: 176, height: 176, borderRadius: 88, backgroundColor: "rgba(0,120,255,0.16)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(83,214,255,0.28)" }, robotShell: { width: 139, height: 118, borderRadius: 56, backgroundColor: "#DCEAF4", alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: "#65C7ED", shadowColor: colors.blue, shadowOpacity: 0.8, shadowRadius: 18, elevation: 8 }, robotFace: { width: 100, height: 76, borderRadius: 35, backgroundColor: "#07111D", alignItems: "center", justifyContent: "center" }, eyes: { flexDirection: "row", gap: 24 }, eye: { width: 11, height: 20, borderRadius: 8, backgroundColor: colors.cyan }, smile: { marginTop: 9, width: 25, height: 10, borderBottomWidth: 3, borderColor: colors.cyan, borderRadius: 12 }, welcomeTitle: { marginTop: 30, color: colors.text, fontSize: 19, fontWeight: "700" }, welcomeText: { marginTop: 3, color: colors.text, fontSize: 15 }, promptList: { width: "100%", marginTop: 22, gap: 9 }, prompt: { minHeight: 50, paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 13 }, promptText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" }, voicePrompt: { width: "100%", marginTop: 12, minHeight: 51, borderRadius: 14, backgroundColor: colors.blueSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, voicePromptActive: { backgroundColor: colors.blue }, voicePromptText: { color: colors.blue, fontSize: 14, fontWeight: "700" }, voicePromptTextActive: { color: "#FFFFFF" }, routeLink: { marginTop: 16, padding: 8, flexDirection: "row", alignItems: "center", gap: 7 }, routeLinkText: { color: colors.blue, fontSize: 13, fontWeight: "700" }, chatScreen: { flex: 1 }, chatHeader: { minHeight: 65, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: colors.border }, back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, chatHeaderName: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 }, headerRobot: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" }, chatTitle: { color: colors.text, fontSize: 15, fontWeight: "700" }, chatStatus: { marginTop: 1, color: colors.muted, fontSize: 10 }, micHeader: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" }, micHeaderActive: { backgroundColor: colors.blue }, messageList: { padding: 18, gap: 11 }, message: { maxWidth: "83%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16 }, norbyMessage: { alignSelf: "flex-start", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 }, userMessage: { alignSelf: "flex-end", backgroundColor: colors.blue, borderBottomRightRadius: 4 }, messageText: { color: colors.text, fontSize: 14, lineHeight: 20 }, userMessageText: { color: "#FFFFFF" }, composer: { padding: 12, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background }, composerInput: { flex: 1, minHeight: 45, borderRadius: 14, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 14, fontSize: 14, borderWidth: 1, borderColor: colors.border }, composerMic: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" }, composerMicActive: { backgroundColor: colors.blue }, send: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
