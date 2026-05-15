export function MissingHtmlForTargetOnly() {
  return (
    <form>
      <label htmlFor="missing-email">Email address</label>
      <input id="email" name="email" aria-label="Email address" />
    </form>
  );
}
