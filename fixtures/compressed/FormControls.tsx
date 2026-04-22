import React from "react";
import { Controller, useForm } from "react-hook-form";

type FormValues = {
  email: string;
  role: string;
  notes: string;
};

const formSchema = {
  email: "required-email",
};

export function FormControls() {
  const { control, register } = useForm<FormValues>({
    resolver: formSchema,
  });

  const onSubmit = () => undefined;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border p-4">
      <input name="email" type="email" required onChange={() => undefined} />
      <select className="rounded border px-3 py-2" name="role" defaultValue="viewer">
        <option value="viewer">Viewer</option>
        <option value="admin">Admin</option>
      </select>
      <textarea className="rounded border px-3 py-2" name="notes" disabled defaultValue="" />
      <Controller
        control={control}
        name="email"
        render={({ field }) => <input className="rounded border px-3 py-2" type="text" {...field} />}
      />
      <input className="rounded border px-3 py-2" {...register("email")} />
      <button className="rounded bg-slate-900 px-3 py-2 text-white" type="submit">
        Save
      </button>
    </form>
  );
}
