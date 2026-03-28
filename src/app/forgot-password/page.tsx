import { AuthForm } from "@/components/auth-form";

export default function ForgotPasswordPage() {
  return (
    <main className="shell auth-wrap">
      <AuthForm mode="forgot-password" />
    </main>
  );
}
