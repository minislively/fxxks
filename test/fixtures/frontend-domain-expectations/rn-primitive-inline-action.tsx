import { Pressable, Text, TextInput, View } from "react-native";

type InlineActionRowProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function InlineActionRow({ value, onChangeText, onSubmit }: InlineActionRowProps) {
  const submitCurrentValue = () => onSubmit(value.trim());
  const isSubmitDisabled = value.trim().length === 0;

  return (
    <View accessibilityLabel="inline action row">
      <Text>Filter</Text>
      <TextInput
        value={value}
        placeholder="Type filter"
        onChangeText={onChangeText}
        keyboardType="web-search"
        autoCapitalize="sentences"
        accessibilityLabel="Inline filter"
        testID="inline-filter-input"
      />
      <Pressable onPress={submitCurrentValue} disabled={isSubmitDisabled} accessibilityLabel="Submit filter" testID="submit-filter-button">
        <Text>Submit</Text>
      </Pressable>
    </View>
  );
}
