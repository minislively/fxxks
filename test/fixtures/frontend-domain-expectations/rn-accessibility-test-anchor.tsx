import { View, Text, TextInput, Pressable } from "react-native";

type AccessibilityAnchorRowProps = {
  value: string;
  onChangeText: (value: string) => void;
  onApply: () => void;
};

export function AccessibilityAnchorRow({ value, onChangeText, onApply }: AccessibilityAnchorRowProps) {
  return (
    <View accessibilityLabel="Search form" testID="search-form">
      <Text accessibilityRole="header">Filters</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel="Search input"
        accessibilityHint="Type a query to filter results"
        testID="search-input"
      />
      <Pressable
        onPress={onApply}
        accessibilityLabel="Apply filters"
        accessibilityRole="button"
        accessibilityHint="Applies the current filter query"
        testID="apply-filters"
      >
        <Text>Apply</Text>
      </Pressable>
    </View>
  );
}
