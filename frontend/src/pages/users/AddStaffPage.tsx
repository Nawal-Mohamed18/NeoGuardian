import { Navigate } from "react-router-dom";

/** Legacy route — Clinical Staff directory now lives at /users with inline register. */
export default function AddStaffPage() {
  return <Navigate to="/users" replace />;
}
