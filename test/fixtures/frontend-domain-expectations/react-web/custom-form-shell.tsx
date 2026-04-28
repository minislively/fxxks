import { Field, FieldLabel, FieldControl, TextField, HelperText, ButtonGroup, Button, ErrorText } from "@/components/ui";

export interface ProfileSettingsShellProps {
  displayName: string;
  errorMessage?: string;
  isSaving?: boolean;
  onDisplayNameChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function ProfileSettingsShell({
  displayName,
  errorMessage,
  isSaving = false,
  onDisplayNameChange,
  onCancel,
  onSave,
}: ProfileSettingsShellProps) {
  const canSave = displayName.trim().length > 0 && !isSaving;

  return (
    <Field className="grid gap-2">
      <FieldLabel htmlFor="display-name" className="text-sm font-medium">
        Display name
      </FieldLabel>
      <FieldControl className="rounded-md border px-3 py-2">
        <TextField
          id="display-name"
          className="w-full bg-transparent"
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.currentTarget.value)}
        />
      </FieldControl>
      {errorMessage ? <ErrorText className="text-xs text-destructive">{errorMessage}</ErrorText> : null}
      <HelperText className="text-xs text-muted-foreground">Shown to collaborators.</HelperText>
      <ButtonGroup className="flex justify-end gap-2">
        <Button className="px-3" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="px-3" disabled={!canSave} onClick={onSave}>
          Save
        </Button>
      </ButtonGroup>
    </Field>
  );
}
