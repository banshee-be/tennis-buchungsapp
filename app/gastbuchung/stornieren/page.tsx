import { GuestCancellation } from "@/components/GuestCancellation";

export default async function GuestCancellationPage({
  searchParams
}: {
  searchParams: Promise<{ code?: string; token?: string }>;
}) {
  const params = await searchParams;

  return (
    <section className="page-shell compact-shell">
      <GuestCancellation code={params.code || ""} token={params.token || ""} />
    </section>
  );
}
