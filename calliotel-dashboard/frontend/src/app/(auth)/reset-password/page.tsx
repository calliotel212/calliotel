import { Suspense } from "react";
import ResetPasswordForm from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-600">Loading…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
