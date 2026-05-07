import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export function ConcernOnlyValidationSchemaNote() {
  const resolver = zodResolver(signupSchema);

  return {
    resolver,
    schemaKeys: Object.keys(signupSchema.shape),
  };
}
