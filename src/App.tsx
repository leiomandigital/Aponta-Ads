import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from '@/components/shared/SessionProvider';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { BrandingProvider } from '@/components/shared/BrandingProvider';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsIntegrationsPage } from '@/pages/SettingsIntegrationsPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrandingProvider>
        <SessionProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/integrations"
                  element={
                    <ProtectedRoute>
                      <SettingsIntegrationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SessionProvider>
      </BrandingProvider>
    </ThemeProvider>
  );
}
