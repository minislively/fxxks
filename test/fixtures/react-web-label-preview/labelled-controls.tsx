import React from "react";

export function LabelledControls() {
  return (
    <form>
      <button type="button">Save settings</button>
      <button type="button" aria-label="Close dialog">
        <svg aria-hidden="true" />
      </button>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" />
      <label>
        Search
        <input name="search" />
      </label>
      <select aria-labelledby="sort-label" name="sort">
        <option value="recent">Recent</option>
      </select>
      <span id="sort-label">Sort</span>
      <textarea title="Notes" />
    </form>
  );
}
