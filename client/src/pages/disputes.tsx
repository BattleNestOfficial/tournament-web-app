import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AlertTriangle, Clock, Eye, ShieldAlert, Upload, CheckCircle2, XCircle } from "lucide-react";
import type { Dispute, DisputeLog } from "@shared/schema";

type LoyaltyProfile = {
  tier: "bronze" | "silver" | "gold" | "vip";
  tierLabel: string;
  benefits: {
    platformFeePercent: number;
    prioritySupport: boolean;
    exclusiveTournaments: boolean;
  };
  matchesPlayed: number;
  totalDeposits: number;
  totalEarnings: number;
};

type DisputeLogRow = DisputeLog & { actorUsername?: string };

function getStatusConfig(status: string) {
  if (status === "resolved") return { label: "Resolved", className: "text-chart-3", icon: CheckCircle2 };
  if (status === "rejected") return { label: "Rejected", className: "text-destructive", icon: XCircle };
  if (status === "in_review") return { label: "In Review", className: "text-chart-4", icon: Eye };
  return { label: "Submitted", className: "text-muted-foreground", icon: Clock };
}

export default function DisputesPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [reportType, setReportType] = useState("hacker");
  const [accusedUsername, setAccusedUsername] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [selectedDisputeId, setSelectedDisputeId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) setLocation("/auth");
  }, [user, setLocation]);

  const { data: loyalty } = useQuery<LoyaltyProfile>({
    queryKey: ["/api/users/loyalty"],
    enabled: !!user,
  });

  const { data: disputes, isLoading } = useQuery<Dispute[]>({
    queryKey: ["/api/disputes/my"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!disputes?.length) {
      setSelectedDisputeId(null);
      return;
    }
    if (!selectedDisputeId || !disputes.some((d) => d.id === selectedDisputeId)) {
      setSelectedDisputeId(disputes[0].id);
    }
  }, [disputes, selectedDisputeId]);

  const { data: disputeLogs, isLoading: logsLoading } = useQuery<DisputeLogRow[]>({
    queryKey: ["/api/disputes", selectedDisputeId, "logs"],
    enabled: !!selectedDisputeId && !!user,
  });

  const selectedDispute = useMemo(
    () => disputes?.find((item) => item.id === selectedDisputeId) || null,
    [disputes, selectedDisputeId],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("reportType", reportType);
      formData.append("description", description.trim());
      if (accusedUsername.trim()) formData.append("accusedUsername", accusedUsername.trim());
      if (tournamentId.trim()) formData.append("tournamentId", tournamentId.trim());
      if (screenshot) formData.append("screenshot", screenshot);

      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit dispute");
      return data as Dispute;
    },
    onSuccess: (data) => {
      setAccusedUsername("");
      setTournamentId("");
      setDescription("");
      setScreenshot(null);
      setReportType("hacker");
      setSelectedDisputeId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/disputes/my"] });
      toast({ title: "Dispute submitted", description: `Ticket #${data.id} created successfully.` });
    },
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dispute Resolution Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Report hackers, upload evidence, and track admin actions in real-time.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Submit New Dispute
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger data-testid="select-dispute-report-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hacker">Hacker / Cheating</SelectItem>
                    <SelectItem value="abuse">Abusive Behavior</SelectItem>
                    <SelectItem value="payment_issue">Payment Issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Accused Username (optional)</Label>
                <Input
                  value={accusedUsername}
                  onChange={(e) => setAccusedUsername(e.target.value)}
                  placeholder="e.g. pro_hacker007"
                  data-testid="input-dispute-accused"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tournament ID (optional)</Label>
                <Input
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                  placeholder="e.g. 127"
                  data-testid="input-dispute-tournament-id"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Evidence Screenshot (optional)</Label>
                <label className="block">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                    data-testid="input-dispute-screenshot"
                  />
                  <Button type="button" variant="outline" className="w-full gap-1.5 pointer-events-none" tabIndex={-1}>
                    <Upload className="w-3.5 h-3.5" />
                    {screenshot ? `Attached: ${screenshot.name}` : "Upload Screenshot"}
                  </Button>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened, match timing, and any proof details..."
                className="min-h-[120px]"
                data-testid="textarea-dispute-description"
              />
              <p className="text-xs text-muted-foreground">{description.trim().length}/2000 characters</p>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || description.trim().length < 10}
              data-testid="button-submit-dispute"
            >
              {createMutation.isPending ? "Submitting..." : "Submit Dispute"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Support Priority</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Loyalty Tier</span>
              <Badge variant="outline">{loyalty?.tierLabel || "Bronze"}</Badge>
            </div>
            <div className="text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Priority Support</span>
                <span className={loyalty?.benefits.prioritySupport ? "text-chart-3 font-medium" : "text-muted-foreground"}>
                  {loyalty?.benefits.prioritySupport ? "Enabled" : "Standard"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Platform Fee</span>
                <span className="font-medium">{loyalty?.benefits.platformFeePercent ?? 5}%</span>
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Priority users are queued faster during peak match windows.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">My Disputes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : disputes && disputes.length > 0 ? (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {disputes.map((item) => {
                  const status = getStatusConfig(item.status);
                  const StatusIcon = status.icon;
                  const isActive = item.id === selectedDisputeId;
                  return (
                    <button
                      key={item.id}
                      className={`w-full text-left rounded-md border p-3 transition ${isActive ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                      onClick={() => setSelectedDisputeId(item.id)}
                      data-testid={`dispute-row-${item.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Ticket #{item.id}</p>
                        <Badge variant="outline" className={`text-[10px] ${status.className}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {new Date(item.createdAt).toLocaleString("en-IN")}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No disputes submitted yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Resolution Log
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {!selectedDispute ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Select a dispute to view status history.
              </div>
            ) : logsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                  <p><span className="text-muted-foreground">Ticket:</span> #{selectedDispute.id}</p>
                  <p><span className="text-muted-foreground">Type:</span> {selectedDispute.reportType}</p>
                  {selectedDispute.screenshotUrl && (
                    <p>
                      <span className="text-muted-foreground">Screenshot:</span>{" "}
                      <a className="underline" href={selectedDispute.screenshotUrl} target="_blank" rel="noreferrer">
                        View Evidence
                      </a>
                    </p>
                  )}
                </div>
                {disputeLogs && disputeLogs.length > 0 ? (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {disputeLogs.map((log) => (
                      <div key={log.id} className="rounded-md border p-3">
                        <p className="text-sm font-medium">{log.action.replace(/_/g, " ")}</p>
                        {log.note && <p className="text-xs text-muted-foreground mt-1">{log.note}</p>}
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {log.actorUsername || log.actorRole} · {new Date(log.createdAt).toLocaleString("en-IN")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No log entries available.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
