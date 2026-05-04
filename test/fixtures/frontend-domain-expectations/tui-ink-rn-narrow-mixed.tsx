import { Box } from "ink";
import { Pressable, Text, TextInput, View } from "react-native";

type MixedTerminalNativePromptProps = {
  value: string;
  onChangeText: (value: string) => void;
  onApply: () => void;
};

export function MixedTerminalNativePrompt({
  value,
  onChangeText,
  onApply,
}: MixedTerminalNativePromptProps) {
  return (
    <Box flexDirection="column" gap={1}>
      <View accessibilityLabel="native search row">
        <Text>Search</Text>
        <TextInput value={value} placeholder="Filter" onChangeText={onChangeText} />
        <Pressable onPress={onApply}>
          <Text>Apply</Text>
        </Pressable>
      </View>
    </Box>
  );
}
