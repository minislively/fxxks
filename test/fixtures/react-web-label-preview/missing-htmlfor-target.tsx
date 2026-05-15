import React from "react";

export function MissingHtmlForTargetForm() {
  return (
    <form>
      <label htmlFor="missing-email">Email address</label>
      <p>Enter the email address used for notifications.</p>
    </form>
  );
}
