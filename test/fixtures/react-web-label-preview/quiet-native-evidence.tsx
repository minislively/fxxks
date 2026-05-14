import React from "react";

function DesignSystemTextInput(_props: { label: string; name: string }) {
  return null;
}

export function QuietNativeEvidence() {
  const imageAlt = "Search products";

  return (
    <form>
      <button type="button">
        <span>Open settings</span>
      </button>
      <input type="submit" value="Save profile" />
      <input alt={imageAlt} type="image" src="/search.png" />
      <span id="country-label">Country</span>
      <select aria-labelledby="country-label" name="country">
        <option value="kr">Korea</option>
      </select>
      <textarea aria-label="Support notes" name="notes" />
      <label>
        Confirm email
        <input name="confirmEmail" />
      </label>
      <DesignSystemTextInput label="Display name" name="displayName" />
    </form>
  );
}
