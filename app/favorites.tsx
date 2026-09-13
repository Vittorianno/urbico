import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AddressAutocomplete, type AddressSuggestion } from "@/components/address-autocomplete";
import { ScreenContainer } from "@/components/screen-container";
import { colors, PrimaryButton } from "@/components/urbico-ui";
import { favoriteRouteParams, isFavoriteConfigured } from "@/lib/favorite-navigation";
import { useUrbico } from "@/lib/urbico-context";

export default function FavoritesScreen() {
  const { favorites, addFavorite, updateFavorite, removeFavorite } = useUrbico();
  const [label, setLabel] = useState(""); const [address, setAddress] = useState(""); const [place, setPlace] = useState<AddressSuggestion | null>(null);
  // FIX (REGRA 3 e 4): editar um favorito é uma ação separada de criar um
  // novo. `editingId` guarda qual favorito está sendo editado; ao salvar,
  // chama updateFavorite (atualiza o registro existente) em vez de
  // addFavorite (que criaria um duplicado). Sem editingId, o formulário
  // continua funcionando como "adicionar novo local", igual antes.
  const [editingId, setEditingId] = useState<string | null>(null);
  const resetForm = () => { setLabel(""); setAddress(""); setPlace(null); setEditingId(null); };
  const save = () => {
    if (!label.trim() || !address.trim()) return;
    const patch = { label: label.trim(), address: address.trim(), latitude: place?.latitude, longitude: place?.longitude };
    if (editingId) updateFavorite(editingId, patch);
    else addFavorite(patch);
    resetForm();
  };
  const selectAddress = (selected: AddressSuggestion) => { setPlace(selected); setAddress(selected.address); };
  const startEdit = (favorite: (typeof favorites)[number]) => {
    setEditingId(favorite.id);
    setLabel(favorite.label);
    setAddress(isFavoriteConfigured(favorite) ? favorite.address : "");
    setPlace(isFavoriteConfigured(favorite) ? { name: favorite.label, address: favorite.address, latitude: favorite.latitude!, longitude: favorite.longitude! } : null);
  };
  // FIX: toque principal no cartão agora só faz uma coisa (REGRA 1/2 do
  // brief): se o favorito já está configurado, vai direto para Rotas com o
  // destino pronto — nunca mais abre edição por engano. Se ainda não está
  // configurado, abre o formulário de configuração aqui em cima. Editar um
  // favorito JÁ configurado agora exige o ícone de lápis (ação separada).
  const openFavorite = (favorite: (typeof favorites)[number]) => {
    if (!isFavoriteConfigured(favorite)) {
      startEdit(favorite);
      return;
    }
    router.push(favoriteRouteParams(favorite));
  };
  return <ScreenContainer><View style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={colors.text} /></Pressable><Text style={styles.title}>Locais salvos</Text><View style={styles.back} /></View><Text style={styles.copy}>Salve os lugares que você acessa com frequência para planejar a viagem mais rapidamente.</Text><View style={styles.form}>{editingId ? <View style={styles.editingBanner}><MaterialIcons name="edit" size={14} color={colors.blue} /><Text style={styles.editingText}>Editando local salvo</Text><Pressable onPress={resetForm}><Text style={styles.editingCancel}>Cancelar</Text></Pressable></View> : null}<View style={styles.labelRow}><TextInput value={label} onChangeText={setLabel} onSubmitEditing={save} placeholder="Nome do local" placeholderTextColor={colors.muted} style={styles.input} returnKeyType="done" /><Pressable accessibilityLabel="Salvar local" onPress={save} style={({ pressed }) => [styles.inlineSend, pressed && styles.pressed]}><MaterialIcons name="send" size={17} color="#FFFFFF" /></Pressable></View><View style={styles.divider} /><AddressAutocomplete value={address} onChangeText={(text) => { setAddress(text); setPlace(null); }} onSelect={selectAddress} onSubmit={save} placeholder="Endereço" compact /><PrimaryButton label={editingId ? "Salvar alterações" : "Salvar local"} icon={editingId ? "check" : "add"} onPress={save} style={styles.addButton} /></View><FlatList data={favorites} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.favorite}><Pressable onPress={() => openFavorite(item)} style={({ pressed }) => [styles.favoriteMain, pressed && styles.pressed]}><View style={styles.favoriteIcon}><MaterialIcons name={item.label === "Trabalho" ? "business-center" : "place"} size={21} color={colors.blue} /></View><View style={{ flex: 1 }}><Text style={styles.favoriteLabel}>{item.label}</Text><Text style={styles.favoriteAddress}>{item.address}</Text></View></Pressable>{isFavoriteConfigured(item) ? <Pressable accessibilityLabel="Editar local" onPress={() => startEdit(item)} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><MaterialIcons name="edit" size={18} color={colors.muted} /></Pressable> : null}<Pressable accessibilityLabel="Excluir local" onPress={() => removeFavorite(item.id)} style={({ pressed }) => [styles.delete, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={20} color={colors.muted} /></Pressable></View>} /></View></ScreenContainer>;
}
const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, paddingTop: 10 }, header: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, title: { color: colors.text, fontSize: 18, fontWeight: "700" }, copy: { marginTop: 15, color: colors.muted, fontSize: 13, lineHeight: 19 }, form: { marginTop: 20, padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, editingBanner: { minHeight: 28, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 6 }, editingText: { flex: 1, color: colors.blue, fontSize: 11, fontWeight: "700" }, editingCancel: { color: colors.muted, fontSize: 11, fontWeight: "700" }, labelRow: { minHeight: 43, flexDirection: "row", alignItems: "center" }, input: { flex: 1, minHeight: 43, color: colors.text, fontSize: 14, paddingHorizontal: 4 }, inlineSend: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" }, divider: { height: 1, backgroundColor: colors.border, marginBottom: 9 }, addButton: { marginTop: 12 }, list: { paddingTop: 16, gap: 10 }, favorite: { minHeight: 70, paddingLeft: 13, paddingRight: 8, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 2 }, favoriteMain: { flex: 1, minHeight: 70, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 11 }, favoriteIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" }, favoriteLabel: { color: colors.text, fontSize: 14, fontWeight: "700" }, favoriteAddress: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 15 }, edit: { width: 36, height: 39, alignItems: "center", justifyContent: "center" }, delete: { width: 36, height: 39, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] } });
