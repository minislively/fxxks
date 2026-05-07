import { useForm } from "react-hook-form";

type SignupDraft = {
  email: string;
  password: string;
};

export function ConcernOnlyFormStateNote() {
  const { register, control, handleSubmit } = useForm<SignupDraft>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(() => undefined);

  return {
    register,
    control,
    onSubmit,
    errors: {
      email: "Required",
    },
  };
}
