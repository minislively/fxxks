import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { submitFilter } from "./rn-handler-lib";

export function ImportedHandlerRow() {
  return (
    <View accessibilityLabel="imported handler row">
      <Text>Imported handler</Text>
      <TextInput
        value="query"
        onChangeText={submitFilter}
        onSubmitEditing={submitFilter}
        placeholder="Imported callback"
      />
      <TouchableOpacity onPress={submitFilter}>
        <Text>Submit imported</Text>
      </TouchableOpacity>
    </View>
  );
}
