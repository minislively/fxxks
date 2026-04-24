import styled from "styled-components";

type StyledPanelProps = {
  tone?: "info" | "success";
  compact?: boolean;
  title: string;
  children: React.ReactNode;
};

const PanelRoot = styled.section<{ $tone: "info" | "success"; $compact: boolean }>`
  border-radius: 18px;
  border: 1px solid ${({ $tone }) => ($tone === "success" ? "#22c55e" : "#3b82f6")};
  background: ${({ $tone }) => ($tone === "success" ? "#f0fdf4" : "#eff6ff")};
  padding: ${({ $compact }) => ($compact ? "12px" : "24px")};
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
`;

const PanelHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
`;

export function StyledPanel({ tone = "info", compact = false, title, children }: StyledPanelProps) {
  return (
    <PanelRoot $tone={tone} $compact={compact}>
      <PanelHeader>
        <h2>{title}</h2>
        {compact ? <span>Compact</span> : null}
      </PanelHeader>
      <div>{children}</div>
    </PanelRoot>
  );
}
