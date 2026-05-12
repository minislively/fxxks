import React, { useState } from "react";
import { useForm } from "react-hook-form";

function DesignSystemField(_props: { label: string; name: string }) {
  return null;
}

export function ExpandedNativeControls() {
  const [email, setEmail] = useState("");
  const { register } = useForm<{ username: string }>();

  return (
    <form>
      <section aria-label="native controlled fields">
        <input type="email" name="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} required />
      </section>

      <section aria-label="react hook form fields">
        <input className="field" {...register("username")} />
      </section>

      <section aria-label="disabled and readonly fields">
        <input name="disabledEmail" disabled />
        <textarea name="readonlyNotes" readOnly />
      </section>

      <section aria-label="custom wrapper boundary">
        <DesignSystemField label="Billing account" name="billingAccount" />
      </section>
    </form>
  );
}
