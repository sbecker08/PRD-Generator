import { getCurrentUser } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import ReportingDashboard from "./reporting-dashboard";

export default async function ReportingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ReportingDashboard />;
}
