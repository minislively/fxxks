import { Box, Text } from "ink";

type DeployPromptProps = {
  target: string;
  onSubmit: (target: string) => void;
};

export function DeployPrompt({ target, onSubmit }: DeployPromptProps) {
  return (
    <Box flexDirection="column" gap={1}>
      <Text>Deploy target</Text>
      <form
        className="deploy-prompt"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(target);
        }}
      >
        <label htmlFor="deploy-target">Target</label>
        <input id="deploy-target" className="deploy-prompt__input" defaultValue={target} />
        <button type="submit">Run deploy</button>
      </form>
    </Box>
  );
}
