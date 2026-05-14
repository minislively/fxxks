export function EmptyAriaLabelControls() {
  return (
    <form>
      <input aria-label="" name="email" type="email" />
      <button aria-label=" ">
        <svg aria-hidden="true" />
      </button>
      <textarea aria-label="" name="notes" />
      <input aria-label="Search" name="query" />
    </form>
  );
}
