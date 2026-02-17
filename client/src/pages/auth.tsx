import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Swords, Eye, EyeOff, ArrowRight, Gamepad2 } from "lucide-react";

declare global {
  interface Window {
    google: any;
  }
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [googleUiError, setGoogleUiError] = useState("");
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const magicLinkHandledRef = useRef(false);

  const { data: googleConfig, error: googleConfigError } = useQuery<{ clientId: string | null }>({
    queryKey: ["/api/config/google-client-id", "fresh"],
    queryFn: async () => {
      const res = await fetch(`/api/config/google-client-id?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load Google config");
      return data;
    },
    staleTime: 0,
  });

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const signupForm = useForm<SignupForm>({ resolver: zodResolver(signupSchema), defaultValues: { username: "", email: "", password: "", confirmPassword: "" } });

  const handleGoogleCredential = useCallback(async (response: any) => {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Google login failed");
      login(json.token, json.user);
      toast({ title: "Welcome!", description: `Logged in as ${json.user.username}` });
      setLocation(json.user.role === "admin" ? "/admin" : "/");
    } catch (err: any) {
      toast({ title: "Google login failed", description: err.message, variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  }, [login, toast, setLocation]);

  useEffect(() => {
    if (!googleConfig?.clientId) return;
    setGoogleUiError("");

    const initGoogle = () => {
      if (!window.google?.accounts?.id) {
        setGoogleUiError("Google script loaded but API unavailable.");
        return;
      }
      try {
        window.google.accounts.id.initialize({
          client_id: googleConfig.clientId,
          callback: handleGoogleCredential,
        });
        if (googleButtonRef.current) {
          googleButtonRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: "outline",
            size: "large",
            width: "100%",
            text: "continue_with",
            shape: "rectangular",
          });
          window.setTimeout(() => {
            if (googleButtonRef.current && googleButtonRef.current.childElementCount === 0) {
              setGoogleUiError("Google sign-in did not render. Check authorized origins and browser extensions.");
            }
          }, 500);
        }
      } catch (err: any) {
        setGoogleUiError(err?.message || "Failed to initialize Google sign-in.");
      }
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      script.onerror = () => setGoogleUiError("Failed to load Google script.");
      document.head.appendChild(script);
    }
  }, [googleConfig?.clientId, handleGoogleCredential]);

  useEffect(() => {
    if (magicLinkHandledRef.current) return;
    magicLinkHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    const tokenParam = params.get("token")?.trim() || "";
    if (!modeParam || !tokenParam) return;

    if (modeParam === "reset-password") {
      setMode("login");
      setResetOpen(true);
      setResetOtp(tokenParam);
      toast({
        title: "Reset code detected",
        description: "Enter your new password to complete reset",
      });
    }

    if (modeParam === "verify-email") {
      (async () => {
        try {
          const res = await fetch("/api/auth/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: tokenParam }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Email verification failed");
          toast({
            title: "Email verified",
            description: "Your account email is now verified",
          });
        } catch (err: any) {
          toast({
            title: "Verification failed",
            description: err.message,
            variant: "destructive",
          });
        }
      })();
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, [toast]);

  async function onLogin(data: LoginForm) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Login failed");
      login(json.token, json.user);
      toast({ title: "Welcome back!", description: `Logged in as ${json.user.username}` });
      setLocation(json.user.role === "admin" ? "/admin" : "/");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function onSignup(data: SignupForm) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.username, email: data.email, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Signup failed");
      login(json.token, json.user);
      toast({
        title: "Account created!",
        description: json.message || "Please verify your email to unlock all features",
      });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    if (!resetEmail.trim()) {
      toast({ title: "Email required", description: "Enter your account email", variant: "destructive" });
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send reset OTP");
      const devOtp = data.devPasswordResetOtp || data.devPasswordResetToken;
      if (devOtp) {
        setResetOtp(devOtp);
      }
      toast({
        title: "Reset OTP sent",
        description: devOtp ? "Dev OTP auto-filled below" : "Check your email",
      });
    } catch (err: any) {
      toast({ title: "Reset request failed", description: err.message, variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  }

  async function submitPasswordReset() {
    if (!resetOtp.trim() || !resetPassword.trim()) {
      toast({ title: "Missing fields", description: "OTP and new password are required", variant: "destructive" });
      return;
    }
    if (resetPassword.length < 6) {
      toast({ title: "Weak password", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail.trim(),
          otp: resetOtp.trim(),
          newPassword: resetPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed");
      toast({ title: "Password updated", description: "You can now sign in with your new password" });
      setResetOpen(false);
      setResetOtp("");
      setResetPassword("");
    } catch (err: any) {
      toast({ title: "Password reset failed", description: err.message, variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-chart-2/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="p-2 bg-primary rounded-md">
              <Swords className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">BATTLE NEST</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {mode === "login" ? "Sign in to join tournaments" : "Create your gaming account"}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex gap-1 p-1 bg-muted rounded-md">
              <button
                onClick={() => setMode("login")}
                data-testid="tab-login"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Login
              </button>
              <button
                onClick={() => setMode("signup")}
                data-testid="tab-signup"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Sign Up
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="gamer@example.com"
                    data-testid="input-login-email"
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      data-testid="input-login-password"
                      {...loginForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setResetEmail(loginForm.getValues("email") || "");
                    setResetOpen(true);
                  }}
                >
                  Forgot password?
                </button>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                  {loading ? "Signing in..." : "Sign In"}
                  {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </form>
            ) : (
              <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Username</Label>
                  <Input
                    id="signup-username"
                    placeholder="ProGamer123"
                    data-testid="input-signup-username"
                    {...signupForm.register("username")}
                  />
                  {signupForm.formState.errors.username && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.username.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="gamer@example.com"
                    data-testid="input-signup-email"
                    {...signupForm.register("email")}
                  />
                  {signupForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 6 characters"
                      data-testid="input-signup-password"
                      {...signupForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {signupForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm Password</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="Re-enter password"
                    data-testid="input-signup-confirm"
                    {...signupForm.register("confirmPassword")}
                  />
                  {signupForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-signup">
                  {loading ? "Creating account..." : "Create Account"}
                  {!loading && <Gamepad2 className="w-4 h-4 ml-2" />}
                </Button>
              </form>
            )}

            {googleConfig?.clientId && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <div
                  ref={googleButtonRef}
                  data-testid="google-login-container"
                  className="flex justify-center"
                />
                {googleLoading && (
                  <p className="text-center text-sm text-muted-foreground mt-2">Signing in with Google...</p>
                )}
              </>
            )}

            {!googleConfig?.clientId && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Google login is currently unavailable.
              </p>
            )}
            {!!googleConfig?.clientId && !!googleUiError && (
              <p className="text-center text-xs text-destructive mt-3">{googleUiError}</p>
            )}
            {googleConfigError && (
              <p className="text-center text-xs text-destructive mt-2">
                Failed to load Google config from server.
              </p>
            )}
          </CardContent>
        </Card>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={requestPasswordReset}
                disabled={resetLoading}
              >
                {resetLoading ? "Sending..." : "Send Reset OTP"}
              </Button>
              <div className="space-y-1">
                <Label>Reset OTP</Label>
                <Input
                  placeholder="Enter OTP from email"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>New Password</Label>
                <Input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={submitPasswordReset} disabled={resetLoading}>
                {resetLoading ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to the BATTLE NEST Terms of Service.
        </p>
      </div>
    </div>
  );
}
