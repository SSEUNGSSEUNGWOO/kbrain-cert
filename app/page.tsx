import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin-dashboard";
import { getUser, getUserRoles } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");

  const roles = await getUserRoles(user.id);
  if (roles.includes("admin")) return <AdminDashboard />;
  if (roles.includes("examiner")) redirect("/examiner/monitor");
  if (roles.includes("grader")) redirect("/pending");
  redirect("/pending");
}
