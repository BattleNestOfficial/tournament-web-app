import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { pushLocalNotification } from "@/lib/pwa";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Swords, Trophy, Wallet, User, LogOut, Moon, Sun, Shield, Home, Menu, X, Users, BarChart3, Headset, UserCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, token, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notificationMemoryRef = useRef<Record<string, number>>({});

  const isAdmin = user?.role === "admin";
  const isHost = user?.role === "host";
  const canAccessAdminPanel = isAdmin || isHost;

  useEffect(() => {
    const stream = new EventSource("/api/tournaments/stream");

    const invalidateKeys = (keys: string[]) => {
      keys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    };

    const shouldNotify = (key: string, ttlMs = 5 * 60 * 1000) => {
      const now = Date.now();
      const prev = notificationMemoryRef.current[key] || 0;
      if (now - prev < ttlMs) {
        return false;
      }
      notificationMemoryRef.current[key] = now;
      return true;
    };

    const maybeNotifyFromTournamentUpdate = (payload: any) => {
      if (!user) return;
      const tournamentId = Number(payload?.tournamentId || 0);
      if (!tournamentId) return;
      const reason = String(payload?.reason || "");
      const status = String(payload?.status || "");
      const startIso = typeof payload?.startTime === "string" ? payload.startTime : null;
      const startMs = startIso ? new Date(startIso).getTime() : NaN;
      const msUntilStart = Number.isNaN(startMs) ? null : startMs - Date.now();

      if (
        status === "upcoming" &&
        msUntilStart !== null &&
        msUntilStart > 0 &&
        msUntilStart <= 10 * 60 * 1000 &&
        shouldNotify(`match-soon-${tournamentId}`)
      ) {
        pushLocalNotification("Match starting soon", {
          body: `Tournament #${tournamentId} starts in under 10 minutes.`,
          tag: `match-soon-${tournamentId}`,
          data: { url: "/tournaments" },
        }).catch(() => {});
      }

      if (reason === "room_published" && payload?.roomPublished && shouldNotify(`room-${tournamentId}`)) {
        pushLocalNotification("Room ID published", {
          body: `Room details are now available for tournament #${tournamentId}.`,
          tag: `room-${tournamentId}`,
          data: { url: `/tournaments/${tournamentId}` },
        }).catch(() => {});
      }

      if (
        (reason === "results_declared" || status === "completed") &&
        shouldNotify(`results-${tournamentId}`)
      ) {
        pushLocalNotification("Result updated", {
          body: `Results are now live for tournament #${tournamentId}.`,
          tag: `results-${tournamentId}`,
          data: { url: `/tournaments/${tournamentId}` },
        }).catch(() => {});
      }
    };

    const maybeNotifyFromAdminUpdate = (payload: any) => {
      if (!user) return;
      const targetId = Number(payload?.targetId || 0);
      if (!targetId) return;
      if (payload?.entity === "tournament_room" && shouldNotify(`room-admin-${targetId}`)) {
        pushLocalNotification("Room ID published", {
          body: `Tournament #${targetId} room details were published.`,
          tag: `room-admin-${targetId}`,
          data: { url: `/tournaments/${targetId}` },
        }).catch(() => {});
      }
      if (payload?.entity === "tournament_results" && shouldNotify(`results-admin-${targetId}`)) {
        pushLocalNotification("Result updated", {
          body: `Tournament #${targetId} results were updated.`,
          tag: `results-admin-${targetId}`,
          data: { url: `/tournaments/${targetId}` },
        }).catch(() => {});
      }
    };

    const refreshTournamentViews = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(String(event.data || "{}"));
        maybeNotifyFromTournamentUpdate(payload);
      } catch {
        // Ignore malformed SSE payloads.
      }
      invalidateKeys([
        "/api/tournaments",
        "/api/leaderboard",
        "/api/registrations/my",
        "/api/users/loyalty",
      ]);
    };

    const refreshAdminViews = (event: MessageEvent) => {
      const fallbackKeys = [
        "/api/admin/stats",
        "/api/tournaments",
        "/api/games",
        "/api/leaderboard",
      ];

      try {
        const payload = JSON.parse(String(event.data || "{}")) as { entity?: string };
        const keyMap: Record<string, string[]> = {
          user: ["/api/admin/users"],
          wallet: [
            "/api/admin/users",
            "/api/admin/stats",
            "/api/transactions/my",
            "/api/withdrawals/my",
            "/api/users/loyalty",
          ],
          game: ["/api/games"],
          tournament: ["/api/tournaments", "/api/leaderboard", "/api/registrations/my"],
          tournament_room: ["/api/tournaments"],
          tournament_results: [
            "/api/tournaments",
            "/api/leaderboard",
            "/api/registrations/my",
            "/api/users/loyalty",
          ],
          withdrawal: ["/api/admin/withdrawals", "/api/withdrawals/my", "/api/transactions/my"],
          support_ticket: ["/api/admin/disputes", "/api/disputes/my"],
          banner: ["/api/admin/banners", "/api/banners"],
          coupon: ["/api/admin/coupons", "/api/admin/coupons/analytics"],
          host_application: ["/api/admin/host-applications", "/api/host/application/my", "/api/admin/users"],
        };

        if (payload.entity === "user" && token) {
          fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.user) updateUser(data.user);
            })
            .catch(() => {
              // Ignore soft refresh failures from background sync.
            });
        }

        maybeNotifyFromAdminUpdate(payload);
        invalidateKeys(keyMap[payload.entity || ""] || fallbackKeys);
      } catch {
        invalidateKeys(fallbackKeys);
      }
    };

    stream.addEventListener("tournament_update", refreshTournamentViews as EventListener);
    stream.addEventListener("admin_update", refreshAdminViews as EventListener);
    stream.onerror = () => {
      // EventSource auto-reconnects; no manual retry needed.
    };

    return () => {
      stream.removeEventListener("tournament_update", refreshTournamentViews as EventListener);
      stream.removeEventListener("admin_update", refreshAdminViews as EventListener);
      stream.close();
    };
  }, [token, updateUser, user]);

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/tournaments", label: "Tournaments", icon: Trophy },
    ...(!isAdmin ? [{ href: "/teams", label: "Teams", icon: Users }] : []),
    ...(!isAdmin ? [{ href: "/leaderboard", label: "Leaderboard", icon: BarChart3 }] : []),
    ...(canAccessAdminPanel ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="link-logo">
            <img
              src="/favicon.png"
              alt="Battle Nest Logo"
              className="w-10 h-10 rounded-md object-cover border border-white/10"
            />
            <span className="font-bold text-sm tracking-tight hidden sm:block">BATTLE NEST</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase()}`}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {user && !isAdmin && (
              <Link href="/wallet" data-testid="link-wallet-balance">
                <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-1.5 border-primary/30">
                  <Wallet className="w-3.5 h-3.5 text-chart-3" />
                  <span className="font-medium" data-testid="text-wallet-balance">
                    {"\u20B9"}{((user.walletBalance || 0) / 100).toFixed(0)}
                  </span>
                </Button>
              </Link>
            )}
            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-user-menu">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {user.username?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {!isAdmin && (
                    <DropdownMenuItem onClick={() => setLocation("/profile")} data-testid="menu-profile">
                      <User className="w-4 h-4 mr-2" /> Profile
                    </DropdownMenuItem>
                  )}
                  {!isAdmin && (
                    <DropdownMenuItem onClick={() => setLocation("/wallet")} data-testid="menu-wallet">
                      <Wallet className="w-4 h-4 mr-2" /> Wallet
                    </DropdownMenuItem>
                  )}
                  {!isAdmin && !isHost && (
                    <DropdownMenuItem
                      onClick={() => setLocation("/become-host")}
                      data-testid="menu-become-host"
                    >
                      <UserCheck className="w-4 h-4 mr-2" /> Become a Host
                    </DropdownMenuItem>
                  )}
                  {!isAdmin && (
                    <DropdownMenuItem
                      onClick={() => setLocation("/support")}
                      data-testid="menu-support"
                    >
                      <Headset className="w-4 h-4 mr-2" /> Support
                    </DropdownMenuItem>
                  )}
                  {canAccessAdminPanel && (
                    <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="menu-admin">
                      <Shield className="w-4 h-4 mr-2" /> Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} data-testid="menu-logout">
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <Button size="sm" data-testid="button-login-nav">Sign In</Button>
              </Link>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm ${isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}
                    data-testid={`mobile-link-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                </Link>
              );
            })}
            {user && !isAdmin && (
              <Link href="/wallet">
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="sm:hidden flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted-foreground rounded-md hover:bg-muted/40"
                  data-testid="mobile-link-wallet-balance"
                >
                  <Wallet className="w-4 h-4 text-chart-3" />
                  Wallet: {"\u20B9"}{((user.walletBalance || 0) / 100).toFixed(0)}
                </button>
              </Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Swords className="w-3.5 h-3.5" />
            <span>BATTLE NEST - Esports Tournament Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Terms</span>
            <span>Privacy</span>
            <span>Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
