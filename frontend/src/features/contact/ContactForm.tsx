const fieldClass =
  "w-full rounded border border-line bg-transparent px-3 py-2 text-[16px] text-c3 placeholder:text-muted";

export function ContactForm() {
  return (
    <form
      data-testid="contact-form"
      className="contact-content mx-auto max-w-xl space-y-5"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="space-y-2">
        <label htmlFor="contact-name">Name</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="contact-subject">Subject</label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="contact-description">Description</label>
        <textarea
          id="contact-description"
          name="description"
          rows={6}
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <button
          type="submit"
          disabled
          className="rounded border border-line px-4 py-2 text-[14px] font-semibold text-c3 opacity-50"
        >
          Send
        </button>
        <p className="text-[14px] text-c3">Coming soon</p>
      </div>
    </form>
  );
}
