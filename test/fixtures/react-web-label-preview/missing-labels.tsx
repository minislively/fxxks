import React from "react";

export function MissingLabels() {
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <button type="button" onClick={() => undefined}>
        <svg aria-hidden="true" />
      </button>
      <input id="email" name="email" onChange={() => undefined} />
      <input name="search" placeholder="Search products" />
      <select name="sort" onChange={() => undefined}>
        <option value="recent">Recent</option>
      </select>
      <textarea name="notes" placeholder="Notes" />
    </form>
  );
}
