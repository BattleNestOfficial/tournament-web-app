import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Gamepad2, Save, Trophy, Wallet, Mail, Phone, ShieldCheck, ShieldAlert, Crown, Headset, Upload } from "lucide-react";
import type { Dispute, Registration, Tournament } from "@shared/schema";

type LoyaltyProfile = {
  tier: "bronze" | "silver" | "gold" | "vip";
  tierLabel: string;
  matchesPlayed: number;
  totalDeposits: number;
  totalEarnings: number;
  benefits: {
    platformFeePercent: number;
    prioritySupport: boolean;
    exclusiveTournaments: boolean;
  };
};

function getTierStyle(tier: LoyaltyProfile["tier"] | undefined) {
  if (tier === "vip") return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  if (tier === "gold") return "text-yellow-500 border-yellow-500/40 bg-yellow-500/10";
  if (tier === "silver") return "text-slate-500 border-slate-500/40 bg-slate-500/10";
  return "text-orange-500 border-orange-500/40 bg-orange-500/10";
}

function normalizeTicketStatus(status: string): "open" | "in_review" | "resolved" {
  if (status === "in_review") return "in_review";
  if (status === "resolved") return "resolved";
  return "open";
}

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
  const [supportReportType, setSupportReportType] = useState("hacker");
  const [accusedGameName, setAccusedGameName] = useState("");
  const [tournamentRef, setTournamentRef] = useState("");
  const [supportDescription, setSupportDescription] = useState("");
  const [supportScreenshot, setSupportScreenshot] = useState<File | null>(null);

  const { data: registrations } = useQuery<
    (Registration & { tournament?: Tournament })[]
  >({
    queryKey: ["/api/registrations/my"],
    enabled: !!user,
  });
  const { data: loyalty } = useQuery<LoyaltyProfile>({
    queryKey: ["/api/users/loyalty"],
    enabled: !!user,
  });
  const { data: supportTickets } = useQuery<Dispute[]>({
    queryKey: ["/api/disputes/my"],
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
    mutationFn: async () => authRequest("/api/auth/verify-email", {
      email: contact.email.trim(),
      otp: emailOtp.trim(),
    }),
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

  const createSupportTicketMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");
      const formData = new FormData();
      formData.append("reportType", supportReportType);
      formData.append("accusedGameName", accusedGameName.trim());
      formData.append("tournamentRef", tournamentRef.trim());
      formData.append("description", supportDescription.trim());
      if (supportScreenshot) formData.append("screenshot", supportScreenshot);

      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit support ticket");
      return data as Dispute;
    },
    onSuccess: () => {
      setSupportReportType("hacker");
      setAccusedGameName("");
      setTournamentRef("");
      setSupportDescription("");
      setSupportScreenshot(null);
      queryClient.invalidateQueries({ queryKey: ["/api/disputes/my"] });
      toast({
        title: "Support ticket submitted",
        description: "Your ticket is now in Open status.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to submit ticket",
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

  const normalizedTickets = (supportTickets || []).map((ticket) => ({
    ...ticket,
    status: normalizeTicketStatus(ticket.status),
  }));
  const openTickets = normalizedTickets.filter((ticket) => ticket.status === "open");
  const inReviewTickets = normalizedTickets.filter((ticket) => ticket.status === "in_review");
  const resolvedTickets = normalizedTickets.filter((ticket) => ticket.status === "resolved");
  const canSubmitSupportTicket =
    !!accusedGameName.trim() &&
    !!tournamentRef.trim() &&
    !!supportDescription.trim() &&
    !!supportScreenshot &&
    !createSupportTicketMutation.isPending;

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
            <Crown className="w-4 h-4" /> Loyalty Program
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Current Tier</p>
            <Badge className={`capitalize ${getTierStyle(loyalty?.tier)}`}>
              {loyalty?.tierLabel || "Bronze Member"}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Matches Played</p>
              <p className="text-xl font-bold">{loyalty?.matchesPlayed ?? 0}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total Deposits</p>
              <p className="text-xl font-bold">{"\u20B9"}{((loyalty?.totalDeposits ?? 0) / 100).toFixed(0)}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total Earnings</p>
              <p className="text-xl font-bold">{"\u20B9"}{((loyalty?.totalEarnings ?? 0) / 100).toFixed(0)}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground mb-1">Reduced Platform Fee</p>
              <p className="font-semibold">{loyalty?.benefits.platformFeePercent ?? 5}%</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground mb-1">Priority Support</p>
              <p className="font-semibold">{loyalty?.benefits.prioritySupport ? "Enabled" : "Standard"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground mb-1">Exclusive Tournaments</p>
              <p className="font-semibold">{loyalty?.benefits.exclusiveTournaments ? "Enabled" : "Locked"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Headset className="w-4 h-4" /> Support
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Report Type *</Label>
              <Select value={supportReportType} onValueChange={setSupportReportType}>
                <SelectTrigger data-testid="select-support-report-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hacker">Hacker / Cheating</SelectItem>
                  <SelectItem value="abuse">Abusive Behavior</SelectItem>
                  <SelectItem value="payment_issue">Payment Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Accused Game Name *</Label>
              <Input
                value={accusedGameName}
                onChange={(e) => setAccusedGameName(e.target.value)}
                placeholder="Enter accused in-game name"
                data-testid="input-support-accused-game-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tournament Name / ID *</Label>
              <Input
                value={tournamentRef}
                onChange={(e) => setTournamentRef(e.target.value)}
                placeholder="Enter tournament name or ID"
                data-testid="input-support-tournament-ref"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Evidence Screenshot *</Label>
              <label className="block">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => setSupportScreenshot(e.target.files?.[0] || null)}
                  data-testid="input-support-screenshot"
                />
                <Button type="button" variant="outline" className="w-full gap-1.5 pointer-events-none" tabIndex={-1}>
                  <Upload className="w-3.5 h-3.5" />
                  {supportScreenshot ? supportScreenshot.name : "Upload Screenshot"}
                </Button>
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description *</Label>
            <Textarea
              value={supportDescription}
              onChange={(e) => setSupportDescription(e.target.value)}
              className="min-h-[110px]"
              placeholder="Describe the issue in detail"
              data-testid="textarea-support-description"
            />
          </div>
          <Button
            onClick={() => createSupportTicketMutation.mutate()}
            disabled={!canSubmitSupportTicket}
            data-testid="button-submit-support-ticket"
          >
            {createSupportTicketMutation.isPending ? "Submitting..." : "Submit Ticket"}
          </Button>

          <Tabs defaultValue="open" className="space-y-3">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="open" data-testid="tab-support-open">Ticket Open ({openTickets.length})</TabsTrigger>
              <TabsTrigger value="in_review" data-testid="tab-support-review">Ticket In-Review ({inReviewTickets.length})</TabsTrigger>
              <TabsTrigger value="resolved" data-testid="tab-support-resolved">Ticket Resolved ({resolvedTickets.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="space-y-2">
              {openTickets.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No open tickets.</div>
              ) : (
                openTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-md border p-3 space-y-1" data-testid={`support-ticket-open-${ticket.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Ticket #{ticket.id}</p>
                      <Badge variant="outline" className="text-[10px]">Open</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Accused: {ticket.accusedGameName}</p>
                    <p className="text-xs text-muted-foreground">Tournament: {ticket.tournamentRef}</p>
                    <p className="text-sm">{ticket.description}</p>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="in_review" className="space-y-2">
              {inReviewTickets.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No in-review tickets.</div>
              ) : (
                inReviewTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-md border p-3 space-y-1" data-testid={`support-ticket-review-${ticket.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Ticket #{ticket.id}</p>
                      <Badge variant="outline" className="text-[10px] text-chart-4">In Review</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Accused: {ticket.accusedGameName}</p>
                    <p className="text-xs text-muted-foreground">Tournament: {ticket.tournamentRef}</p>
                    <p className="text-sm">{ticket.description}</p>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-2">
              {resolvedTickets.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No resolved tickets.</div>
              ) : (
                resolvedTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-md border p-3 space-y-1" data-testid={`support-ticket-resolved-${ticket.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Ticket #{ticket.id}</p>
                      <Badge variant="outline" className="text-[10px] text-chart-3">Resolved</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Accused: {ticket.accusedGameName}</p>
                    <p className="text-xs text-muted-foreground">Tournament: {ticket.tournamentRef}</p>
                    <p className="text-sm">{ticket.description}</p>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
