import { useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Headset, Upload } from "lucide-react";
import type { Dispute } from "@shared/schema";

function normalizeTicketStatus(status: string): "open" | "in_review" | "resolved" {
  if (status === "in_review") return "in_review";
  if (status === "resolved") return "resolved";
  return "open";
}

export default function SupportPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [supportReportType, setSupportReportType] = useState("hacker");
  const [accusedGameName, setAccusedGameName] = useState("");
  const [tournamentRef, setTournamentRef] = useState("");
  const [supportDescription, setSupportDescription] = useState("");
  const [supportScreenshot, setSupportScreenshot] = useState<File | null>(null);

  const { data: supportTickets } = useQuery<Dispute[]>({
    queryKey: ["/api/disputes/my"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) setLocation("/auth");
  }, [user, setLocation]);

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
      <h1 className="text-2xl font-bold">Support</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Headset className="w-4 h-4" /> Support Ticket
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
    </div>
  );
}
