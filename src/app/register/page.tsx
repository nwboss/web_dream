import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <main className="shell auth-wrap">
      <AuthForm mode="register" />
    </main>
  );
}
