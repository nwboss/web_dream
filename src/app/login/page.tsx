import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="shell auth-wrap">
      <AuthForm mode="login" />
    </main>
  );
}
