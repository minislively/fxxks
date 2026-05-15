import React from "react";
import { Label as FieldLabel } from "./Label";

export function ConflictingLabelAssociation() {
  const dynamicTarget = "runtime-email";
  return (
    <form>
      <label htmlFor="email">Email</label>
      <label htmlFor="email">Work inbox</label>
      <input id="email" name="email" />

      <label htmlFor="phone">Phone</label>
      <input id="phone" name="phone" />

      <FieldLabel htmlFor="custom-field">Custom wrapper label</FieldLabel>
      <label htmlFor={dynamicTarget}>Dynamic target</label>
      <label htmlFor="missing-field">Missing field</label>
      <input id="duplicate" name="primaryDuplicate" />
      <input id="duplicate" name="secondaryDuplicate" />
      <label htmlFor="duplicate">Duplicate id label</label>
      <input aria-label="" name="emptyName" />
      <button type="button" aria-label="Open menu" />
    </form>
  );
}
