import React from "react";

export function LabelAssociationCandidates() {
  return (
    <form>
      <label>Email address</label>
      <input id="email" name="email" />
      <label>Department</label>
      <select name="department">
        <option value="sales">Sales</option>
      </select>
      <label>Notes</label>
      <textarea name="notes" />
    </form>
  );
}
