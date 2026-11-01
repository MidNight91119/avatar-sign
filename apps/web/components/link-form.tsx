/** Paste a YouTube link → /watch?v=<link>. A plain GET form, so it works before any JavaScript loads. */
export function LinkForm({ id, label = "Watch with signing", defaultValue }: { id: string; label?: string; defaultValue?: string }) {
  return (
    <form action="/watch" className="link-form">
      <label htmlFor={id} className="visually-hidden">
        YouTube link
      </label>
      <input id={id} name="v" type="text" inputMode="url" required placeholder="Paste a YouTube link" defaultValue={defaultValue} />
      <button type="submit">{label}</button>
    </form>
  );
}
