import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Swords, Trophy, Wallet, User, LogOut, Moon, Sun, Shield, Home, Menu, X, Users } from "lucide-react";
import { useState, type ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/tournaments", label: "Tournaments", icon: Trophy },
    ...(!isAdmin ? [{ href: "/teams", label: "Teams", icon: Users }] : []),
    ...(!isAdmin ? [{ href: "/wallet", label: "Wallet", icon: Wallet }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="link-logo">
            <img
              src="/favicon.png"
              alt="Battle Nest Logo"
              className="w-9 h-9 rounded-md object-cover border border-white/10"
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
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-card rounded-md border border-card-border text-sm">
                <Wallet className="w-3.5 h-3.5 text-chart-3" />
                <span className="font-medium" data-testid="text-wallet-balance">
                  {"\u20B9"}{((user.walletBalance || 0) / 100).toFixed(0)}
                </span>
              </div>
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
                  {isAdmin && (
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
              <div className="sm:hidden flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
                <Wallet className="w-4 h-4 text-chart-3" />
                Wallet: {"\u20B9"}{((user.walletBalance || 0) / 100).toFixed(0)}
              </div>
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
