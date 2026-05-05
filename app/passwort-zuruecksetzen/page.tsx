import { ResetPasswordForm } from "@/components/PasswordResetForms";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;

  return (
    <section className="page-shell compact-shell">
      <ResetPasswordForm token={params.token ?? ""} />
    </section>
  );
}
