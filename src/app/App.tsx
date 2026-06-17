import { createContext, useContext, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import LoginPage from "../pages/LoginPage";
import ContractListPage from "../pages/contracts/ContractListPage";
import InspectionReportsPage from "../pages/inspectionReports/InspectionReportsPage";

const SESSION_KEY = "chenglu_admin_logged_in";

interface AuthContextValue {
  loggedIn: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthContext");
  }
  return value;
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { loggedIn } = useAuth();
  const location = useLocation();
  if (!loggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function AuthProvider({ children }: { children: JSX.Element }) {
  const [loggedIn, setLoggedIn] = useState(
    () => localStorage.getItem(SESSION_KEY) === "1",
  );
  const value = useMemo<AuthContextValue>(
    () => ({
      loggedIn,
      login: () => {
        localStorage.setItem(SESSION_KEY, "1");
        setLoggedIn(true);
      },
      logout: () => {
        localStorage.removeItem(SESSION_KEY);
        setLoggedIn(false);
      },
    }),
    [loggedIn],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Navigate to="/contracts" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route path="contracts" element={<ContractListPage />} />
            <Route path="inspection-reports" element={<InspectionReportsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/contracts" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
