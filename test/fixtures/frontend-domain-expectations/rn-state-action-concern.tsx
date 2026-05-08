import { useReducer, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type StateActionAdjacentRowProps = {
  initialValue?: string;
  onCommit?: (value: string) => void;
};

function reducer(state: { submitted: boolean }, action: { type: "submit" | "reset" }) {
  if (action.type === "reset") return { submitted: false };
  return { submitted: true };
}

export function StateActionAdjacentRow({ initialValue = "", onCommit = () => {} }: StateActionAdjacentRowProps) {
  const [query, setQuery] = useState(initialValue);
  const [status, dispatch] = useReducer(reducer, { submitted: false });

  const submitQuery = () => {
    const trimmed = query.trim();
    setQuery(trimmed);
    dispatch({ type: "submit" });
    onCommit(trimmed);
  };

  return (
    <View accessibilityLabel="state action adjacent row" testID="state-action-row">
      <Text>Query</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={submitQuery}
        placeholder="Filter"
        testID="state-action-input"
      />
      <Pressable onPress={submitQuery} testID="state-action-submit">
        <Text>{status.submitted ? "Submitted" : "Submit"}</Text>
      </Pressable>
    </View>
  );
}
