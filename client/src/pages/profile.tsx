import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Gamepad2, Save, Trophy, Wallet, Mail, Phone, ShieldCheck, ShieldAlert } from "lucide-react";
import type { Registration, Tournament } from "@shared/schema";

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [gameIGNs, setGameIGNs] = useState({
    bgmiIgn: user?.bgmiIgn || "",
    freeFireIgn: user?.freeFireIgn || "",
    codIgn: user?.codIgn || "",
  });
  const [contact, setContact] = useState({
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneCode, setPhoneCode] = useState("");

  const { data: registrations } = useQuery<
    (Registration & { tournament?: Tournament })[]
  >({
    queryKey: ["/api/registrations/my"],
    enabled: !!user,
  });

  // 🔹 Helper: check if anything actually changed
  function hasChanges() {
    return (
      (user?.bgmiIgn || "") !== gameIGNs.bgmiIgn.trim() ||
      (user?.freeFireIgn || "") !== gameIGNs.freeFireIgn.trim() ||
      (user?.codIgn || "") !== gameIGNs.codIgn.trim()
    );
  }

  function hasContactChanges() {
    return (
      (user?.email || "") !== contact.email.trim() ||
      (user?.phone || "") !== contact.phone.trim()
    );
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");

      const payload: any = {};

      if (gameIGNs.bgmiIgn.trim() !== (user?.bgmiIgn || "")) {
        payload.bgmiIgn = gameIGNs.bgmiIgn.trim();
      }

      if (gameIGNs.freeFireIgn.trim() !== (user?.freeFireIgn || "")) {
        payload.freeFireIgn = gameIGNs.freeFireIgn.trim();
      }

      if (gameIGNs.codIgn.trim() !== (user?.codIgn || "")) {
        payload.codIgn = gameIGNs.codIgn.trim();
      }

      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Update failed");
      }

      return data;
    },

    onSuccess: (data) => {
      if (data.user) updateUser(data.user);

      toast({
        title: "Profile updated",
        description: "Your in-game names were saved",
      });
    },

    onError: (err: Error) => {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  async function authRequest(url: string, body?: any) {
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  const updateContactMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");
      const res = await fetch("/api/users/contact", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: contact.email.trim(),
          phone: contact.phone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Contact update failed");
      return data;
    },
    onSuccess: (data) => {
      if (data.user) updateUser(data.user);
      toast({
        title: "Contact updated",
        description: data.message || "Contact details saved",
      });
      const devOtp = data.devEmailVerificationOtp || data.devEmailVerificationToken;
      if (devOtp) {
        setEmailOtp(devOtp);
      }
    },
    onError: (err: Error) => {
      toast({
        title: "Contact update failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const requestEmailVerificationMutation = useMutation({
    mutationFn: async () => authRequest("/api/auth/request-email-verification"),
    onSuccess: (data) => {
      const devOtp = data.devEmailVerificationOtp || data.devEmailVerificationToken;
      if (devOtp) {
        setEmailOtp(devOtp);
      }
      toast({
        title: "Email OTP sent",
        description: devOtp ? "Dev OTP auto-filled below" : "Check your inbox",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to send verification email",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async () => authRequest("/api/auth/verify-email", { otp: emailOtp.trim() }),
    onSuccess: (data) => {
      if (data.user) updateUser(data.user);
      setEmailOtp("");
      toast({
        title: "Email verified",
        description: "Your email is now verified",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Email verification failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const requestPhoneVerificationMutation = useMutation({
    mutationFn: async () => authRequest("/api/auth/request-phone-verification"),
    onSuccess: (data) => {
      if (data.devPhoneOtp) {
        setPhoneCode(data.devPhoneOtp);
      }
      toast({
        title: "Phone OTP sent",
        description: data.devPhoneOtp ? "Dev OTP auto-filled below" : "Check SMS",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to send OTP",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const verifyPhoneMutation = useMutation({
    mutationFn: async () => authRequest("/api/auth/verify-phone", { code: phoneCode.trim() }),
    onSuccess: (data) => {
      if (data.user) updateUser(data.user);
      setPhoneCode("");
      toast({
        title: "Phone verified",
        description: "Withdrawals are now enabled after cooldown",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Phone verification failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!user) setLocation("/auth");
  }, [user, setLocation]);

  useEffect(() => {
    setContact({
      email: user?.email || "",
      phone: user?.phone || "",
    });
  }, [user?.email, user?.phone]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* USER CARD */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 text-center space-y-3">
            <Avatar className="w-20 h-20 mx-auto">
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {user.username?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <p className="font-bold text-lg">{user.username}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="capitalize">
                {user.role}
              </Badge>
              {user.banned && <Badge variant="destructive">Banned</Badge>}
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-center gap-1.5 text-sm">
                <Wallet className="w-4 h-4 text-chart-3" />
                <span className="font-semibold">
                  ₹{((user.walletBalance || 0) / 100).toFixed(0)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Wallet Balance
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Member since{" "}
              {new Date(user.createdAt).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </CardContent>
        </Card>

        {/* GAME PROFILE */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" /> Game Profile
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              These names will be auto-filled when you join tournaments
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">BGMI In-Game Name</Label>
                <Input
                  value={gameIGNs.bgmiIgn}
                  onChange={(e) =>
                    setGameIGNs((p) => ({ ...p, bgmiIgn: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label className="text-xs">Free Fire In-Game Name</Label>
                <Input
                  value={gameIGNs.freeFireIgn}
                  onChange={(e) =>
                    setGameIGNs((p) => ({ ...p, freeFireIgn: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label className="text-xs">COD Mobile In-Game Name</Label>
                <Input
                  value={gameIGNs.codIgn}
                  onChange={(e) =>
                    setGameIGNs((p) => ({ ...p, codIgn: e.target.value }))
                  }
                />
              </div>
            </div>

            <Button
              disabled={updateMutation.isPending}
              onClick={() => {
                if (!hasChanges()) {
                  toast({
                    title: "No changes detected",
                    description: "Update a name before saving",
                  });
                  return;
                }

                updateMutation.mutate();
              }}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? "Saving..." : "Save In-Game Names"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Account Security
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                value={contact.email}
                onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                placeholder="your@email.com"
              />
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Mail className="w-3.5 h-3.5" />
                {user.emailVerified ? (
                  <Badge variant="outline">Email Verified</Badge>
                ) : (
                  <Badge variant="destructive">Email Not Verified</Badge>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Phone (required for withdrawals)</Label>
              <Input
                value={contact.phone}
                onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+91XXXXXXXXXX"
              />
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Phone className="w-3.5 h-3.5" />
                {user.phoneVerified ? (
                  <Badge variant="outline">Phone Verified</Badge>
                ) : (
                  <Badge variant="destructive">Phone Not Verified</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => updateContactMutation.mutate()}
              disabled={updateContactMutation.isPending || !hasContactChanges()}
            >
              {updateContactMutation.isPending ? "Saving..." : "Save Contact"}
            </Button>
            {!user.emailVerified && (
              <Button
                variant="outline"
                onClick={() => requestEmailVerificationMutation.mutate()}
                disabled={requestEmailVerificationMutation.isPending}
              >
                {requestEmailVerificationMutation.isPending ? "Sending..." : "Send Email OTP"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => requestPhoneVerificationMutation.mutate()}
              disabled={requestPhoneVerificationMutation.isPending || !contact.phone.trim()}
            >
              {requestPhoneVerificationMutation.isPending ? "Sending..." : "Send Phone OTP"}
            </Button>
          </div>

          <div className={`grid gap-3 ${user.emailVerified ? "grid-cols-1" : "sm:grid-cols-2"}`}>
            {!user.emailVerified && (
              <div>
                <Label className="text-xs">Email OTP</Label>
                <Input
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value)}
                  placeholder="Enter OTP from email"
                />
                <Button
                  className="mt-2 w-full"
                  onClick={() => verifyEmailMutation.mutate()}
                  disabled={verifyEmailMutation.isPending || !emailOtp.trim()}
                >
                  {verifyEmailMutation.isPending ? "Verifying..." : "Verify Email"}
                </Button>
              </div>
            )}
            <div>
              <Label className="text-xs">Phone OTP</Label>
              <Input
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
                placeholder="Enter OTP"
              />
              <Button
                className="mt-2 w-full"
                onClick={() => verifyPhoneMutation.mutate()}
                disabled={verifyPhoneMutation.isPending || !phoneCode.trim()}
              >
                {verifyPhoneMutation.isPending ? "Verifying..." : "Verify Phone"}
              </Button>
            </div>
          </div>

          {user.withdrawalLockUntil && new Date(user.withdrawalLockUntil).getTime() > Date.now() && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Withdrawals locked until {new Date(user.withdrawalLockUntil).toLocaleString("en-IN")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MATCH HISTORY */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Match History
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          {registrations?.length ? (
            <div className="space-y-1">
              {registrations.map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between py-2.5 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      Tournament #{reg.tournamentId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(reg.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <Badge variant="outline">Registered</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No match history yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
