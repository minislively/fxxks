import React from "react";
import { useFieldArray, useForm } from "react-hook-form";

type Contact = { email: string };

type ContactsFormValues = {
  contacts: Contact[];
};

export function FieldArrayContactsForm() {
  const { control, register, handleSubmit } = useForm<ContactsFormValues>({
    defaultValues: { contacts: [{ email: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "contacts" });

  return (
    <form onSubmit={handleSubmit(() => undefined)}>
      <p className="text-sm text-slate-500">
        Keep this fixture long enough to exercise React Web context extraction while representing dynamic field arrays.
      </p>
      {fields.map((field, index) => (
        <div key={field.id} className="grid gap-2">
          <label htmlFor={`contacts-${index}-email`}>Email</label>
          <input id={`contacts-${index}-email`} {...register(`contacts.${index}.email`)} />
          <button type="button" onClick={() => remove(index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({ email: "" })}>Add contact</button>
      <button type="submit">Save</button>
    </form>
  );
}
