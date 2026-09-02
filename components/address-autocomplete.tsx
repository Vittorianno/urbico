import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "@/components/urbico-ui";
import { trpc } from "@/lib/trpc";

export type AddressSuggestion = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type AddressAutocompleteProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  onSubmit?: () => void;
  compact?: boolean;
};

export function AddressAutocomplete({
  value,
  onChangeText,
  onSelect,
  placeholder = "Endereço",
  onSubmit,
  compact = false,
}: AddressAutocompleteProps) {
  const enabled = value.trim().length >= 3;
  const suggestions = trpc.routing.suggestAddresses.useQuery(
    { query: value.trim() },
    { enabled, staleTime: 30_000 },
  );

  const confirm = () => {
    if (suggestions.data?.[0]) onSelect(suggestions.data[0]);
    onSubmit?.();
  };

  const handleSearch = () => {
    if (suggestions.data?.[0]) {
      confirm();
      return;
    }
    void suggestions.refetch();
    onSubmit?.();
  };

  const showManualHint = enabled && !suggestions.isFetching && !suggestions.data?.length;

  return (
    <View style={styles.container}>
      <View style={[styles.field, compact && styles.fieldCompact]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={confirm}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={styles.input}
          returnKeyType="done"
          autoCorrect={false}
          accessibilityLabel={placeholder}
        />
        <Pressable
          accessibilityLabel="Buscar endereço"
          onPress={handleSearch}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <MaterialIcons
            name={suggestions.isFetching ? "hourglass-top" : "search"}
            size={18}
            color="#FFFFFF"
          />
        </Pressable>
      </View>

      {enabled && suggestions.data?.length ? (
        <FlatList
          data={suggestions.data}
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => `${item.latitude}-${item.longitude}-${item.address}`}
          style={styles.results}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.result, pressed && styles.pressed]}
            >
              <MaterialIcons name="place" size={17} color={colors.blue} />
              <View style={styles.resultCopy}>
                <Text numberOfLines={1} style={styles.resultName}>
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={styles.resultAddress}>
                  {item.address}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : null}

      {showManualHint ? (
        <Text style={styles.hint}>
          {suggestions.error
            ? "Sugestões automáticas indisponíveis. Você pode usar o endereço digitado manualmente."
            : "Você pode confirmar o endereço digitado manualmente."}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  field: {
    minHeight: 46,
    borderRadius: 12,
    paddingLeft: 4,
    paddingRight: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  fieldCompact: { minHeight: 42 },
  input: { flex: 1, color: colors.text, fontSize: 14, paddingHorizontal: 10, paddingVertical: 9 },
  search: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  results: {
    marginTop: 6,
    maxHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  result: {
    minHeight: 53,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  resultCopy: { flex: 1 },
  resultName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  resultAddress: { color: colors.muted, fontSize: 11, marginTop: 2 },
  hint: { marginTop: 6, color: colors.muted, fontSize: 11, lineHeight: 15 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
