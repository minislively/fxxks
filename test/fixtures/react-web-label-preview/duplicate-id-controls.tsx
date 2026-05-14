import React from "react";

export function DuplicateIdControls() {
  return (
    <form>
      <label htmlFor="email">Email</label>
      <input id="email" name="primaryEmail" />
      <label htmlFor="email">Confirm email</label>
      <input id="email" name="confirmEmail" />
      <label htmlFor="phone">Phone</label>
      <input id="phone" name="phone" />
    </form>
  );
}
