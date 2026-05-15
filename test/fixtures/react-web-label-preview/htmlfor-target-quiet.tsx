import React from "react";

const dynamicId = "dynamic-email";

function FieldLabel(props: { htmlFor: string; children: React.ReactNode }) {
  return <span data-for={props.htmlFor}>{props.children}</span>;
}

export function QuietHtmlForTargetForm() {
  return (
    <form>
      <label htmlFor="present-email">Present email</label>
      <input id="present-email" aria-label="Present email" />

      <label htmlFor="duplicate-email">Duplicate email</label>
      <input id="duplicate-email" aria-label="Duplicate email" />
      <div id="duplicate-email" />

      <label htmlFor={dynamicId}>Dynamic email</label>
      <input id={dynamicId} aria-label="Dynamic email" />

      <FieldLabel htmlFor="missing-custom">Custom field</FieldLabel>
    </form>
  );
}
