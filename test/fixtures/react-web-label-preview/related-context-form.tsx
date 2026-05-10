import React from "react";
import { FormField } from "./FormField";
import { InputHelpText } from "./Input";

export function RelatedContextForm() {
  return (
    <form>
      <FormField>
        <InputHelpText />
        <input name="email" />
      </FormField>
      <button type="button">
        <svg aria-hidden="true" />
      </button>
    </form>
  );
}
