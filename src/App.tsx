import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/core/layouts/AppShell";
import { Loader2 } from "lucide-react";
import { useModuleAccess } from "@/core/hooks/useModuleAccess";

// Páginas de autenticação e públicas (carregadas imediatamente)
import Auth from "./pages/Auth";
import Instalar from "./pages/Instalar";
import EstoqueDashboard from "./pages/EstoqueDashboard";
import OAuthConsent from "./pages/OAuthConsent";
import NotFound from "./pages/NotFound";

// Módulos com lazy loading
const DashboardPage     = lazy(() => import("./modules/dashboard/pages/DashboardPage"));
const FinanceiroPage    = lazy(() => import("./modules/financeiro/pages/FinanceiroPage"));
const EcommercePage     = lazy(() => import("./modules/ecommerce/pages/EcommercePage"));
const VendasCanaisPage  = lazy(() => import("./modules/ecommerce/pages/VendasCanaisPage"));
const MarketingPage     = lazy(() => import("./modules/marketing/pages/MarketingPage"));
const AprovacoesPage    = lazy(() => import("./modules/marketing/pages/AprovacoesPage"));
const AtendimentoPage   = lazy(() => import("./modules/atendimento/pages/AtendimentoPage"));
const SupplyPage        = lazy(() => import("./modules/supply/pages/SupplyPage"));
const ProdutosPage      = lazy(() => import("./modules/produtos/pages/ProdutosPage"));
const OperacoesPage     = lazy(() => import("./modules/operacoes/pages/OperacoesPage"));
const B2BPage           = lazy(() => import("./modules/b2b/pages/B2BPage"));

// Módulo legado (mantido intacto durante a transição)
const LegacyIndex       = lazy(() => import("./pages/Index"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
});

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  );
}

// Redirects to the correct starting page based on user's role
function RoleRedirect() {
  const { defaultPath, isLoading } = useModuleAccess();
  if (isLoading) return <PageLoader />;
  return <Navigate to={defaultPath} replace />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Públicas — acessíveis sem login */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/instalar" element={<Instalar />} />
              <Route path="/estoques/:userId" element={<EstoqueDashboard />} />

              {/* MCP OAuth consent — precisa de sessão mas fora do AppShell */}
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

              {/* App protegido com AppShell */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          {/* Redireciona / para o módulo padrão do role */}
                          <Route path="/" element={<RoleRedirect />} />

                          {/* Módulos novos */}
                          <Route path="/dashboard/*" element={<DashboardPage />} />
                          <Route path="/financeiro/*" element={<FinanceiroPage />} />
                          <Route path="/ecommerce/*"  element={<EcommercePage />} />
                          <Route path="/canais/*"     element={<VendasCanaisPage />} />
                          <Route path="/marketing/*"  element={<MarketingPage />} />
                          <Route path="/aprovar/*"    element={<AprovacoesPage />} />
                          <Route path="/atendimento/*" element={<AtendimentoPage />} />
                          <Route path="/supply/*"     element={<SupplyPage />} />
                          <Route path="/produtos/*"   element={<ProdutosPage />} />
                          <Route path="/operacoes/*"  element={<OperacoesPage />} />
                          <Route path="/b2b/*"        element={<B2BPage />} />

                          {/* Legado: acesso ao dashboard original em /ritmo */}
                          <Route path="/ritmo/*"      element={<LegacyIndex />} />

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </AppShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
