import { Button, Text, TextInput, TouchableOpacity, View } from "react-native";

type InlineCallbackRowProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function InlineCallbackRow({ value, onChangeText, onSubmit }: InlineCallbackRowProps) {
  return (
    <View accessibilityLabel="inline callback row">
      <Text>Inline callback</Text>
      <TextInput
        value={value}
        onChangeText={(nextValue) => onChangeText(nextValue.trim())}
        onSubmitEditing={() => onSubmit(value.trim())}
        placeholder="Type value"
        testID="inline-callback-input"
      />
      <TouchableOpacity onPress={() => onSubmit(value.trim())} testID="inline-touchable">
        <Text>Touchable submit</Text>
      </TouchableOpacity>
      <Button title="Button submit" onPress={() => onSubmit(value.trim())} />
    </View>
  );
}
