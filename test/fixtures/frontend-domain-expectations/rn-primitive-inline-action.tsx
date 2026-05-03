import { Pressable, Text, TextInput, View } from "react-native";

type InlineActionRowProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function InlineActionRow({ value, onChangeText, onSubmit }: InlineActionRowProps) {
  const submitCurrentValue = () => onSubmit(value.trim());

  return (
    <View accessibilityLabel="inline action row">
      <Text>Filter</Text>
      <TextInput value={value} placeholder="Type filter" onChangeText={onChangeText} />
      <Pressable onPress={submitCurrentValue}>
        <Text>Submit</Text>
      </Pressable>
    </View>
  );
}
