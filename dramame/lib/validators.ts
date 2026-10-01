export type FieldErrors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "Enter your email.";
  if (!EMAIL_PATTERN.test(value)) return "That email doesn’t look right.";
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "Enter a password.";
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use at least 8 characters with a letter and a number.";
  }
  return undefined;
}

export function validateName(name: string): string | undefined {
  const value = name.trim();
  if (!value) return "Enter your name.";
  if (value.length > 60) return "Use 60 characters or fewer.";
  return undefined;
}

export function validateSignup(input: {
  name: string;
  email: string;
  password: string;
  confirm: string;
  terms: boolean;
}): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const nameError = validateName(input.name);
  if (nameError) fieldErrors.name = nameError;
  const emailError = validateEmail(input.email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = validatePassword(input.password);
  if (passwordError) fieldErrors.password = passwordError;
  if (!input.confirm) fieldErrors.confirm = "Confirm your password.";
  else if (input.password !== input.confirm) fieldErrors.confirm = "Those passwords don’t match.";
  if (!input.terms) fieldErrors.terms = "Accept the terms to create an account.";
  return fieldErrors;
}

export function validateLogin(input: { email: string; password: string }): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const emailError = validateEmail(input.email);
  if (emailError) fieldErrors.email = emailError;
  if (!input.password) fieldErrors.password = "Enter a password.";
  return fieldErrors;
}

export function validateNewPassword(password: string, confirm: string): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  if (!confirm) fieldErrors.confirm = "Confirm your password.";
  else if (password !== confirm) fieldErrors.confirm = "Those passwords don’t match.";
  return fieldErrors;
}

export function validateContact(input: { name: string; email: string; message: string }): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const nameError = validateName(input.name);
  if (nameError) fieldErrors.name = nameError;
  const emailError = validateEmail(input.email);
  if (emailError) fieldErrors.email = emailError;
  const message = input.message.trim();
  if (!message) fieldErrors.message = "Enter a message.";
  else if (message.length < 10) fieldErrors.message = "Use at least 10 characters.";
  else if (message.length > 2000) fieldErrors.message = "Use 2000 characters or fewer.";
  return fieldErrors;
}

export function validateSuggestion(input: { idea: string; email: string }): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const idea = input.idea.trim();
  if (!idea) fieldErrors.idea = "Enter a story idea.";
  else if (idea.length < 10) fieldErrors.idea = "Use at least 10 characters.";
  else if (idea.length > 2000) fieldErrors.idea = "Use 2000 characters or fewer.";
  const email = input.email.trim();
  if (email) {
    const emailError = validateEmail(email);
    if (emailError) fieldErrors.email = emailError;
  }
  return fieldErrors;
}

export function safeNextPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
