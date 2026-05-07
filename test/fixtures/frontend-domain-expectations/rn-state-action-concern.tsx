import { useReducer, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

function reducer(state: { submitted: boolean }, action: { type: "submit" | "reset" }) {
  if (action.type === "reset") return { submitted: false };
  return { submitted: true };
}

export function StateActionConcernCard() {
  const [query, setQuery] = useState("");
  const [status, dispatch] = useReducer(reducer, { submitted: false });

  const submitQuery = () => {
    setQuery((current) => current.trim());
    dispatch({ type: "submit" });
  };

  return (
    <View accessibilityLabel="state action concern card">
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => dispatch({ type: "submit" })}
        placeholder="Filter"
        testID="state-action-input"
      />
      <Pressable onPress={submitQuery} testID="state-action-submit">
        <Text>{status.submitted ? "Submitted" : "Submit"}</Text>
      </Pressable>
    </View>
  );
}
