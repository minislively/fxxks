import { Pressable, Text, TextInput, View } from "react-native";

type SearchRowProps = {
  value: string;
  onChangeText: (value: string) => void;
  onApply: () => void;
};

export function SearchRow({ value, onChangeText, onApply }: SearchRowProps) {
  return (
    <View accessibilityLabel="search row">
      <Text>Search</Text>
      <TextInput value={value} placeholder="Filter" onChangeText={onChangeText} />
      <Pressable onPress={onApply}>
        <Text>Apply</Text>
      </Pressable>
    </View>
  );
}
