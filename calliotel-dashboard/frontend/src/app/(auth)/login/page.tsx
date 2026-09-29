import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-600">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
