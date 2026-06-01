import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { trpc } from "@/lib/trpc";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = trpc.authLocal.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1426' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: '#16A085', borderTopColor: 'transparent' }} />
          <p className="text-xs" style={{ color: 'rgba(196,233,249,0.4)', fontFamily: "'Poppins', sans-serif" }}>
            Verificando acesso...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/login"    component={Login}    />
      <Route path="/register" component={Register} />
      <Route path="/404"      component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
