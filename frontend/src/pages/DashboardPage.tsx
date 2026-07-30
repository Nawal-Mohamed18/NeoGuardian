import { AppLayout } from "@/components/layout/AppLayout";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { DoctorDashboard } from "@/components/dashboard/DoctorDashboard";
import { NurseDashboard } from "@/components/dashboard/NurseDashboard";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { role } = useAuth();

  let content;
  if (role === "admin") {
    content = <AdminDashboard />;
  } else if (role === "doctor") {
    content = <DoctorDashboard />;
  } else {
    content = <NurseDashboard />;
  }

  return <AppLayout>{content}</AppLayout>;
}
