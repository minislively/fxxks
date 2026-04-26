import { Box, Text, useInput } from "ink";

export function CommandPalette({ focused }: { focused: boolean }) {
  useInput(() => {});

  return (
    <Box flexDirection="column">
      <Text>{focused ? "Focused" : "Idle"}</Text>
      <Text>Press enter to run</Text>
    </Box>
  );
}
