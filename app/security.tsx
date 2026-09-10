import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as RNShare from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, InfoCard, PrimaryButton } from "@/components/urbico-ui";
import { useUrbico } from "@/lib/urbico-context";

export default function SecurityScreen() {
  const { activeRoute, trustedContacts, addTrustedContact, removeTrustedContact, safeModeEnabled, setSafeModeEnabled } = useUrbico();
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // FIX: antes só mostrava um Alert descrevendo o que "abriria quando a
  // viagem fosse identificada" — nunca chamava o compartilhamento de
  // verdade. Agora chama o share sheet nativo já, com os dados reais da rota
  // ativa quando existir uma (mesma lógica de app/trip.tsx).
  const share = async () => {
    const message = activeRoute?.line
      ? `Estou indo para ${activeRoute.destination.name} pela linha ${activeRoute.line.label} (Urbico). Acompanhe meu status pelo aplicativo.`
      : "Estou acompanhando uma viagem pelo Urbico. Acompanhe meu status pelo aplicativo.";
    await RNShare.Share.share({ message });
  };

  const addContact = () => {
    const name = contactName.trim();
    const phone = contactPhone.trim();
    if (!name || !phone) {
      Alert.alert("Dados incompletos", "Informe nome e telefone do contato de confiança.");
      return;
    }
    addTrustedContact({ name, phone });
    setContactName("");
    setContactPhone("");
  };

  const callContact = (phone: string) => {
    void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
  };

  // FIX: antes o botão de emergência só mostrava um Alert genérico, mesmo
  // com contatos de confiança cadastrados. Agora, se houver ao menos um
  // contato, oferece ligar direto para ele; sem contato cadastrado, mantém
  // a orientação anterior (o Urbico não substitui serviços oficiais).
  const emergency = () => {
    if (trustedContacts.length > 0) {
      const first = trustedContacts[0];
      Alert.alert("Emergência", `Ligar agora para ${first.name}? Em uma situação urgente, procure também os canais oficiais de emergência.`, [
        { text: "Cancelar", style: "cancel" },
        { text: `Ligar para ${first.name}`, onPress: () => callContact(first.phone) },
      ]);
      return;
    }
    Alert.alert("Emergência", "Você ainda não tem um contato de confiança cadastrado. O Urbico não substitui os serviços oficiais de emergência — em uma situação urgente, procure os canais oficiais e pessoas de confiança.");
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={colors.text} /></Pressable>
          <Text style={styles.title}>Segurança</Text>
          <View style={styles.back} />
        </View>

        <InfoCard style={styles.shareCard}>
          <View style={styles.shareIcon}><MaterialIcons name="share" size={25} color={colors.cyan} /></View>
          <Text style={styles.shareTitle}>Compartilhar minha viagem</Text>
          <Text style={styles.shareText}>Envie o status disponível da sua viagem para alguém de confiança usando o compartilhamento do dispositivo.</Text>
          <PrimaryButton label="COMPARTILHAR AGORA" icon="share" onPress={() => void share()} style={styles.shareButton} />
        </InfoCard>

        <Text style={styles.sectionLabel}>CONTATOS DE CONFIANÇA</Text>
        <View style={styles.contactForm}>
          <TextInput value={contactName} onChangeText={setContactName} placeholder="Nome" placeholderTextColor={colors.muted} style={styles.contactInput} returnKeyType="next" />
          <TextInput value={contactPhone} onChangeText={setContactPhone} onSubmitEditing={addContact} placeholder="Telefone" placeholderTextColor={colors.muted} style={styles.contactInput} keyboardType="phone-pad" returnKeyType="done" />
          <PrimaryButton label="Adicionar contato" icon="person-add" onPress={addContact} style={styles.addContactButton} />
        </View>
        {trustedContacts.length > 0 ? (
          <View style={styles.list}>
            {trustedContacts.map((contact) => (
              <View key={contact.id} style={styles.contactRow}>
                <View style={styles.itemIcon}><MaterialIcons name="person" size={20} color={colors.text} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{contact.name}</Text>
                  <Text style={styles.itemSubtitle}>{contact.phone}</Text>
                </View>
                <Pressable onPress={() => callContact(contact.phone)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="call" size={19} color={colors.cyan} /></Pressable>
                <Pressable onPress={() => removeTrustedContact(contact.id)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={19} color={colors.muted} /></Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyContacts}>Nenhum contato de confiança cadastrado ainda.</Text>
        )}

        <View style={styles.list}>
          <View style={styles.safeMode}>
            <View style={styles.itemIcon}><MaterialIcons name="security" size={21} color={colors.text} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>Modo seguro</Text>
              <Text style={styles.itemSubtitle}>{safeModeEnabled ? "Ativado — a viagem é compartilhada automaticamente ao iniciar" : "Desativado"}</Text>
            </View>
            <Switch value={safeModeEnabled} onValueChange={setSafeModeEnabled} trackColor={{ false: "#33485C", true: colors.blue }} thumbColor="#FFFFFF" />
          </View>
        </View>

        <Pressable onPress={emergency} style={({ pressed }) => [styles.emergency, pressed && styles.pressed]}>
          <MaterialIcons name="warning-amber" size={27} color="#FFFFFF" />
          <View><Text style={styles.emergencyTitle}>EMERGÊNCIA</Text><Text style={styles.emergencyText}>Precisa de ajuda? Toque para orientação.</Text></View>
        </Pressable>
        <Text style={styles.disclaimer}>O Urbico não substitui serviços oficiais de emergência.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 10, paddingBottom: 30 },
  header: { height: 50, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  shareCard: { marginTop: 20 },
  shareIcon: { width: 47, height: 47, borderRadius: 14, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  shareTitle: { marginTop: 15, color: colors.text, fontSize: 17, fontWeight: "700" },
  shareText: { marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 18 },
  shareButton: { marginTop: 17 },
  sectionLabel: { marginTop: 22, marginBottom: 8, color: colors.cyan, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  contactForm: { padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 9 },
  contactInput: { minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 14 },
  addContactButton: { marginTop: 4 },
  emptyContacts: { marginTop: 10, color: colors.muted, fontSize: 12, textAlign: "center" },
  list: { marginTop: 12, overflow: "hidden", borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  contactRow: { minHeight: 62, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderColor: colors.border },
  iconButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  item: { minHeight: 69, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderColor: colors.border },
  safeMode: { minHeight: 69, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#172A40", alignItems: "center", justifyContent: "center" },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  itemSubtitle: { marginTop: 2, color: colors.muted, fontSize: 10, lineHeight: 14 },
  emergency: { marginTop: 21, minHeight: 88, padding: 18, borderRadius: 18, backgroundColor: colors.red, flexDirection: "row", alignItems: "center", gap: 15 },
  emergencyTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  emergencyText: { marginTop: 4, color: "#FFE5E6", fontSize: 11, lineHeight: 16 },
  disclaimer: { marginTop: 12, color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
