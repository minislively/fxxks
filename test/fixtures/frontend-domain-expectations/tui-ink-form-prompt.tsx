import { useState } from "react";
import { Box, Text, useInput } from "ink";

type DeployPromptProps = {
  initialTarget?: string;
  onCancel: () => void;
  onSubmit: (target: string) => void;
};

export function DeployPrompt({ initialTarget = "", onCancel, onSubmit }: DeployPromptProps) {
  const [target, setTarget] = useState(initialTarget);
  const [submitted, setSubmitted] = useState(false);
  const trimmedTarget = target.trim();
  const errorMessage = trimmedTarget.length === 0 ? "Target is required" : undefined;

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (errorMessage) return;
      setSubmitted(true);
      onSubmit(trimmedTarget);
      return;
    }

    if (key.backspace || key.delete) {
      setTarget((current) => current.slice(0, -1));
      return;
    }

    if (input) {
      setTarget((current) => `${current}${input}`);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text>Deploy target</Text>
      <Box gap={1}>
        <Text>{">"}</Text>
        <Text>{target || "type a target"}</Text>
      </Box>
      {errorMessage ? <Text color="red">{errorMessage}</Text> : <Text color="green">Press Enter to submit</Text>}
      {submitted ? <Text dimColor>Submitted {trimmedTarget}</Text> : <Text dimColor>Esc cancels</Text>}
    </Box>
  );
}
