import { Box, Text } from "ink";

type StatusPanelProps = {
  command: string;
  phase: "queued" | "running" | "done" | "failed";
  elapsedMs: number;
  messages: string[];
};

function statusGlyph(phase: StatusPanelProps["phase"]) {
  if (phase === "done") return "✓";
  if (phase === "failed") return "✕";
  if (phase === "running") return "…";
  return "•";
}

export function StatusPanel({ command, phase, elapsedMs, messages }: StatusPanelProps) {
  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text>{statusGlyph(phase)}</Text>
        <Text>{command}</Text>
        <Text dimColor>{elapsedMs}ms</Text>
      </Box>
      {messages.map((message) => (
        <Box key={message} gap={1}>
          <Text dimColor>│</Text>
          <Text>{message}</Text>
        </Box>
      ))}
    </Box>
  );
}
