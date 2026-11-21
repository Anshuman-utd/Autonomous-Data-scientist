import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppShell from "./components/layout/AppShell";
import { ProgressIndicator } from "./components/ui/Primitives";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Workspace = lazy(() => import("./pages/Workspace"));
const Auth = lazy(() => import("./pages/Auth"));
const Collection = lazy(() => import("./pages/Collection"));
function ProtectedRoute() {
  const { token } = useAuth();
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={<ProgressIndicator>Loading workspace…</ProgressIndicator>}
        >
          <Routes>
            <Route path="/login" element={<Auth key="login" isLogin />} />
            <Route
              path="/register"
              element={<Auth key="register" isLogin={false} />}
            />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="dashboard" element={<Navigate to="/" replace />} />
                <Route path="datasets" element={<Dashboard library />} />
                <Route
                  path="models"
                  element={<Collection key="models" kind="models" />}
                />
                <Route
                  path="insights"
                  element={<Collection key="insights" kind="insights" />}
                />
                <Route
                  path="account"
                  element={<Collection key="account" kind="account" />}
                />
                <Route path="workspace" element={<Workspace />} />
                <Route
                  path="upload"
                  element={<Navigate to="/datasets" replace />}
                />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
