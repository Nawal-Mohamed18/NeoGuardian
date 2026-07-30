import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PageLoading } from "@/components/shared/PageLoading";
import { useAuth } from "@/context/AuthContext";
import { SidebarUiProvider } from "@/context/SidebarUiContext";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const MyPatientsPage = lazy(() => import("@/pages/MyPatientsPage"));
const AdminPatientsListPage = lazy(() => import("@/pages/AdminPatientsListPage"));
const NewbornsPage = lazy(() => import("@/pages/newborns/NewbornsPage"));
const RegisterNewbornPage = lazy(() => import("@/pages/newborns/RegisterNewbornPage"));
const AssessmentPage = lazy(() => import("@/pages/ai-center/AssessmentPage"));
const TeamChatPage = lazy(() => import("@/pages/TeamChatPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const StaffManagePage = lazy(() => import("@/pages/users/StaffManagePage"));
const AddStaffPage = lazy(() => import("@/pages/users/AddStaffPage"));
const PodsManagePage = lazy(() => import("@/pages/pods/PodsManagePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const resolved = Object.entries(params).reduce(
    (path, [key, val]) => path.replace(`:${key}`, val ?? ""),
    to
  );
  return <Navigate to={resolved} replace />;
}

function Protected({ href, children }: { href: string; children: React.ReactNode }) {
  const location = useLocation();
  const { authed, canAccess, roleConfig } = useAuth();
  if (!authed) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!canAccess(href)) return <Navigate to={roleConfig.landing} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SidebarUiProvider>
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><PageLoading /></div>}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<Navigate to="/login" replace />} />

              <Route path="/" element={<Protected href="/"><DashboardPage /></Protected>} />
              <Route path="/my-patients" element={<Protected href="/my-patients"><MyPatientsPage /></Protected>} />
              <Route path="/patients" element={<Protected href="/patients"><AdminPatientsListPage /></Protected>} />
              <Route path="/newborns" element={<Protected href="/newborns"><NewbornsPage /></Protected>} />
              <Route path="/newborns/register" element={<Protected href="/newborns"><RegisterNewbornPage /></Protected>} />
              <Route path="/newborns/:id" element={<Protected href="/newborns"><NewbornsPage /></Protected>} />
              <Route path="/ai-center" element={<Navigate to="/my-patients" replace />} />
              <Route path="/ai-center/assess" element={<Protected href="/ai-center"><AssessmentPage /></Protected>} />
              <Route path="/chat" element={<Protected href="/chat"><TeamChatPage /></Protected>} />
              <Route path="/notifications" element={<Protected href="/notifications"><NotificationsPage /></Protected>} />
              <Route path="/pods" element={<Protected href="/pods"><PodsManagePage /></Protected>} />
              <Route path="/users" element={<Protected href="/users"><StaffManagePage /></Protected>} />
              <Route path="/users/add" element={<Protected href="/users"><AddStaffPage /></Protected>} />
              <Route path="/reports" element={<Protected href="/reports"><ReportsPage /></Protected>} />
              <Route path="/settings" element={<Protected href="/settings"><SettingsPage /></Protected>} />

              <Route path="/analytics" element={<Navigate to="/reports" replace />} />
              <Route path="/research" element={<Navigate to="/reports" replace />} />
              <Route path="/system" element={<Navigate to="/" replace />} />
              <Route path="/workspace/:id" element={<LegacyRedirect to="/newborns/:id" />} />
              <Route path="/patients/:id" element={<LegacyRedirect to="/newborns/:id" />} />
              <Route path="/assess" element={<Navigate to="/my-patients" replace />} />
              <Route path="/new-assessment" element={<Navigate to="/newborns/register" replace />} />
              <Route path="/alerts" element={<Navigate to="/notifications" replace />} />
              <Route path="/mothers" element={<Navigate to="/" replace />} />
              <Route path="/pregnancies" element={<Navigate to="/" replace />} />
              <Route path="/deliveries" element={<Navigate to="/" replace />} />
              <Route path="/nicu" element={<Navigate to="/newborns" replace />} />
              <Route path="/clinical" element={<Navigate to="/newborns" replace />} />
              <Route path="/laboratory" element={<Navigate to="/" replace />} />
              <Route path="/medications" element={<Navigate to="/" replace />} />
              <Route path="/workspace" element={<Navigate to="/newborns" replace />} />
            </Routes>
          </Suspense>
        </SidebarUiProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
