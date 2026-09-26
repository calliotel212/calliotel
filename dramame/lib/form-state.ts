export type FormState = {
  fieldErrors: Record<string, string>;
  formError?: string;
  message?: string;
  devUrl?: string;
  ok?: boolean;
};

export const initialFormState: FormState = { fieldErrors: {} };

export function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function isDevRuntime(): boolean {
  return process.env.NODE_ENV !== "production";
}
