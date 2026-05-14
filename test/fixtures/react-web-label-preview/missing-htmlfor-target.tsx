import React from "react";

function FieldLabel(_props: { htmlFor: string; children: React.ReactNode }) {
  return null;
}

function Label(_props: { htmlFor: string; children: React.ReactNode }) {
  return null;
}

export function MissingHtmlForTargetCard() {
  const dynamicTarget = "runtime-field";

  return (
    <form className="space-y-4">
      <label htmlFor="display-name">Display name</label>
      <input aria-label="Profile name" id="profile-name" name="displayName" />

      <label htmlFor={dynamicTarget}>Runtime generated field</label>
      <input aria-label="Runtime field" id="runtime-field" name="runtime" />

      <FieldLabel htmlFor="custom-field">Custom field</FieldLabel>
      <input aria-label="Custom field" id="custom-field" name="custom" />

      <Label htmlFor="design-system-field">Design system field</Label>
      <input aria-label="Design system field" id="design-system-field" name="designSystem" />

      <Label>Wrapped custom label
        <input name="wrappedByCustomLabel" />
      </Label>

      <Label>Sibling custom label</Label>
      <input name="siblingCustomLabel" />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" />
    </form>
  );
}
