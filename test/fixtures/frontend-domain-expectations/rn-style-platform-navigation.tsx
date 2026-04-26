import { StyleSheet, Platform, View, Text, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

export function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params as { userId: string };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>User {userId}</Text>
      </View>
      <View style={styles.actions}>
        <Text
          style={Platform.select({
            ios: styles.iosAction,
            android: styles.androidAction,
            default: styles.defaultAction,
          })}
          onPress={() => navigation.navigate("Settings")}
        >
          Go to Settings
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { padding: 16, borderBottomWidth: 1, borderColor: "#ddd" },
  title: { fontSize: 24, fontWeight: "bold" },
  subtitle: { fontSize: 14, color: "#666" },
  actions: { padding: 16 },
  iosAction: { color: "#007AFF", fontSize: 16 },
  androidAction: { color: "#2196F3", fontSize: 16 },
  defaultAction: { color: "#000", fontSize: 16 },
});
