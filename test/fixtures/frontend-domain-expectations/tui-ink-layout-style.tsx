import { Box, Text } from "ink";

type DashboardSection = {
  label: string;
  value: string;
  tone: "accent" | "muted" | "warning";
};

const toneColor = {
  accent: "cyan",
  muted: "gray",
  warning: "yellow",
} as const;

export function LayoutStyleDashboard({ sections }: { sections: DashboardSection[] }) {
  return (
    <Box flexDirection="column" gap={1} paddingX={1} borderStyle="round" borderColor="cyan">
      <Box flexDirection="row" gap={2}>
        <Text bold color="cyan">
          Deployment dashboard
        </Text>
        <Text dimColor>terminal layout preview</Text>
      </Box>
      <Box flexDirection="column" gap={1} padding={1}>
        {sections.map((section) => (
          <Box key={section.label} flexDirection="row" gap={1}>
            <Text color={toneColor[section.tone]}>{section.label}</Text>
            <Text dimColor>·</Text>
            <Text>{section.value}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
