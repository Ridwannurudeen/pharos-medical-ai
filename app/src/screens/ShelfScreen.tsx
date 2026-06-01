import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { useShelf } from "../store/shelf";
import { colors, font, radius, spacing } from "../theme";

export function ShelfScreen() {
  const items = useShelf((s) => s.items);
  const add = useShelf((s) => s.add);
  const remove = useShelf((s) => s.remove);
  const error = useShelf((s) => s.error);
  const [draft, setDraft] = useState("");

  const submit = () => {
    add(draft);
    setDraft("");
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.head}>
        <Text style={styles.h1}>Your shelf</Text>
        <Text style={styles.sub}>
          Every scan is checked against these. Stored encrypted on this device, never uploaded.
        </Text>
      </View>

      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          placeholder="Add a medication (e.g. Warfarin)"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          style={styles.input}
        />
        <Pressable onPress={submit} style={styles.addBtn} hitSlop={8}>
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(i) => i.name}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No medications yet. Add the ones you take so scans can check against them.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Ionicons name="medkit-outline" size={18} color={colors.inkSoft} />
            <Text style={styles.name}>{item.name}</Text>
            <Pressable onPress={() => remove(item.name)} hitSlop={10}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        )}
        ListFooterComponent={<View style={styles.footer}><DisclaimerBanner /></View>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: 4 },
  h1: { fontSize: font.h1, fontWeight: "900", color: colors.ink, letterSpacing: -0.5 },
  sub: { color: colors.inkSoft, fontSize: font.small, lineHeight: 18 },
  addRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: font.body,
  },
  addBtn: {
    width: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    color: colors.danger,
    fontSize: font.small,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  empty: { color: colors.inkFaint, fontSize: font.body, lineHeight: 22, paddingVertical: spacing.xl, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  name: { flex: 1, color: colors.ink, fontSize: font.body, fontWeight: "600" },
  footer: { marginTop: spacing.lg },
});
