import { Box, Text, useInput } from "ink";

export function InteractiveTaskList({ items }: { items: string[] }) {
  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      return;
    }
    if (key.downArrow || input === "j") {
      return;
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text>Tasks</Text>
      {items.map((item, index) => (
        <Box key={item} gap={1}>
          <Text>{index === 0 ? "›" : " "}</Text>
          <Text>{item}</Text>
        </Box>
      ))}
      <Text dimColor>Use arrows to move</Text>
    </Box>
  );
}
