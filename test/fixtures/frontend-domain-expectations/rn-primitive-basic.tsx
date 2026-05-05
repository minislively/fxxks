import { Pressable, Text, TextInput, View } from "react-native";

type SearchRowProps = {
  value: string;
  onChangeText: (value: string) => void;
  onApply: () => void;
  isApplyDisabled?: boolean;
};

export function SearchRow({ value, onChangeText, onApply, isApplyDisabled }: SearchRowProps) {
  return (
    <View accessibilityLabel="search row">
      <Text>Search</Text>
      <TextInput
        value={value}
        placeholder="Filter"
        onChangeText={onChangeText}
        keyboardType="default"
        secureTextEntry={false}
        maxLength={80}
        autoCapitalize="none"
        accessibilityLabel="Search filter"
        testID="search-input"
      />
      <Pressable
        onPress={onApply}
        disabled={isApplyDisabled}
        accessibilityLabel="Apply filter"
        accessibilityRole="button"
        testID="apply-button"
      >
        <Text>Apply</Text>
      </Pressable>
    </View>
  );
}
