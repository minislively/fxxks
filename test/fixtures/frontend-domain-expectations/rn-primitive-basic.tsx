import { Pressable, Text, TextInput, View } from "react-native";

export function SearchRow() {
  return (
    <View accessibilityLabel="search row">
      <Text>Search</Text>
      <TextInput value="" placeholder="Filter" onChangeText={() => {}} />
      <Pressable onPress={() => {}}>
        <Text>Apply</Text>
      </Pressable>
    </View>
  );
}
