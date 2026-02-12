import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import Layout from "@/components/layout";
import HomePage from "@/pages/home";
import AuthPage from "@/pages/auth";
import TournamentsPage from "@/pages/tournaments";
import TournamentDetailPage from "@/pages/tournament-detail";
import WalletPage from "@/pages/wallet";
import ProfilePage from "@/pages/profile";
import AdminPage from "@/pages/admin";
import TeamsPage from "@/pages/teams";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  const [location] = useLocation();

  if (location === "/auth") {
    return <AuthPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/tournaments" component={TournamentsPage} />
        <Route path="/tournaments/:id" component={TournamentDetailPage} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/teams" component={TeamsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <WouterRouter>
              <AppRoutes />
            </WouterRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
