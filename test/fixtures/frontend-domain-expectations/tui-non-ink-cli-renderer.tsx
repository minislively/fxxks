import React from "react";

type TerminalSummaryProps = {
  busy: boolean;
  lines: string[];
};

function Screen({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Line({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function TerminalSummary({ busy, lines }: TerminalSummaryProps) {
  return (
    <Screen>
      <Line>{busy ? "Running" : "Idle"}</Line>
      {lines.map((line) => (
        <Line key={line}>{line}</Line>
      ))}
    </Screen>
  );
}
