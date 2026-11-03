import NavBar from "@/components/NavBar";
import { requirePageRole } from "@/lib/auth";

export default async function WorkshopLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageRole("workshop");
  return (
    <>
      <NavBar role="workshop" name={s.name} />
      <main className="wrap">{children}</main>
    </>
  );
}
