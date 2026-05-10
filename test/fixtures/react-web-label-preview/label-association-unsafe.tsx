import React from "react";

export function LabelAssociationUnsafe() {
  return (
    <form>
      <label>Duplicated choice</label>
      <input name="choice" type="radio" />
      <label>Existing id collision</label>
      <input name="existing" />
      <span id="existing" />
      <label>Duplicate literal id</label>
      <input id="duplicated" name="duplicated" />
      <span id="duplicated" />
      <label>Nested control is already associated by wrapper
        <input name="wrapped" />
      </label>
      <label htmlFor="external">Already points elsewhere</label>
      <input id="local" name="local" />
      <label>Second duplicated choice</label>
      <input name="choice" type="radio" />
    </form>
  );
}
