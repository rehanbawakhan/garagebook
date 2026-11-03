import NavBar from "@/components/NavBar";
import { requirePageRole } from "@/lib/auth";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageRole("owner");
  return (
    <>
      <NavBar role="owner" name={s.name} />
      <main className="wrap">{children}</main>
    </>
  );
}
