import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UserCheck } from "lucide-react";
import type { HostApplication } from "@shared/schema";

type HostFormState = {
  fullName: string;
  contactNumber: string;
  platform: string;
  channelName: string;
  channelUrl: string;
  socialFollowers: string;
  experience: string;
};

function createDefaultForm(user: { username?: string | null; phone?: string | null } | null): HostFormState {
  return {
    fullName: user?.username || "",
    contactNumber: user?.phone || "",
    platform: "YouTube / Instagram / Facebook",
    channelName: "",
    channelUrl: "",
    socialFollowers: "",
    experience: "",
  };
}

export default function BecomeHostPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [hostForm, setHostForm] = useState<HostFormState>(createDefaultForm(user || null));

  useEffect(() => {
    if (!user) setLocation("/auth");
  }, [user, setLocation]);

  useEffect(() => {
    setHostForm((prev) => ({
      ...prev,
      fullName: prev.fullName || user?.username || "",
      contactNumber: prev.contactNumber || user?.phone || "",
    }));
  }, [user?.username, user?.phone]);

  const { data: latestHostApplication } = useQuery<HostApplication | null>({
    queryKey: ["/api/host/application/my"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!latestHostApplication) return;
    setHostForm({
      fullName: latestHostApplication.fullName || user?.username || "",
      contactNumber: latestHostApplication.contactNumber || user?.phone || "",
      platform: latestHostApplication.platform || "YouTube / Instagram / Facebook",
      channelName: latestHostApplication.channelName || "",
      channelUrl: latestHostApplication.channelUrl || "",
      socialFollowers: String(latestHostApplication.socialFollowers || 0),
      experience: latestHostApplication.experience || "",
    });
  }, [latestHostApplication, user?.username, user?.phone]);

  const submitHostApplicationMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");
      const payload = {
        fullName: hostForm.fullName.trim(),
        contactNumber: hostForm.contactNumber.trim(),
        platform: hostForm.platform.trim(),
        channelName: hostForm.channelName.trim(),
        channelUrl: hostForm.channelUrl.trim() || null,
        socialFollowers: Number.parseInt(hostForm.socialFollowers || "0", 10) || 0,
        experience: hostForm.experience.trim(),
      };
      const res = await fetch("/api/host/application", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit host application");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/host/application/my"] });
      toast({
        title: "Application submitted",
        description: "Your host request is now under review.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Submission failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  const latestStatus = latestHostApplication?.status || null;
  const hasPendingRequest = latestStatus === "pending" || latestStatus === "in_review";
  const hasElevatedAccess = user.role === "host" || user.role === "admin";
  const canSubmitHostApplication =
    !hasPendingRequest &&
    !hasElevatedAccess &&
    !!hostForm.fullName.trim() &&
    !!hostForm.contactNumber.trim() &&
    !!hostForm.platform.trim() &&
    !!hostForm.channelName.trim() &&
    !!hostForm.experience.trim() &&
    !submitHostApplicationMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Become a Host</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> Host / Youtuber Program
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {hasElevatedAccess && (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
              You already have host-level access.
            </div>
          )}

          {latestStatus && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Latest application status:</span>
              <Badge variant="outline" className="capitalize">
                {latestStatus.replace("_", " ")}
              </Badge>
              {latestHostApplication?.adminNote ? (
                <span className="text-muted-foreground">- {latestHostApplication.adminNote}</span>
              ) : null}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={hostForm.fullName}
                onChange={(e) => setHostForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Your full name"
                data-testid="input-host-full-name"
              />
            </div>
            <div>
              <Label className="text-xs">Contact Number *</Label>
              <Input
                value={hostForm.contactNumber}
                onChange={(e) => setHostForm((p) => ({ ...p, contactNumber: e.target.value }))}
                placeholder="Your phone number"
                data-testid="input-host-contact"
              />
            </div>
            <div>
              <Label className="text-xs">Platform *</Label>
              <Input
                value={hostForm.platform}
                onChange={(e) => setHostForm((p) => ({ ...p, platform: e.target.value }))}
                placeholder="YouTube / Instagram / Facebook"
                data-testid="input-host-platform"
              />
            </div>
            <div>
              <Label className="text-xs">Channel Name *</Label>
              <Input
                value={hostForm.channelName}
                onChange={(e) => setHostForm((p) => ({ ...p, channelName: e.target.value }))}
                placeholder="Your channel/page name"
                data-testid="input-host-channel-name"
              />
            </div>
            <div>
              <Label className="text-xs">Channel URL</Label>
              <Input
                value={hostForm.channelUrl}
                onChange={(e) => setHostForm((p) => ({ ...p, channelUrl: e.target.value }))}
                placeholder="https://..."
                data-testid="input-host-channel-url"
              />
            </div>
            <div>
              <Label className="text-xs">Followers</Label>
              <Input
                value={hostForm.socialFollowers}
                onChange={(e) =>
                  setHostForm((p) => ({ ...p, socialFollowers: e.target.value.replace(/[^\d]/g, "") }))
                }
                placeholder="Approx audience size"
                data-testid="input-host-followers"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Experience / Why You Want To Host *</Label>
            <Textarea
              value={hostForm.experience}
              onChange={(e) => setHostForm((p) => ({ ...p, experience: e.target.value }))}
              className="min-h-[120px]"
              placeholder="Share your hosting or esports content experience..."
              data-testid="textarea-host-experience"
            />
          </div>

          <Button
            onClick={() => submitHostApplicationMutation.mutate()}
            disabled={!canSubmitHostApplication}
            data-testid="button-apply-host"
          >
            {submitHostApplicationMutation.isPending ? "Submitting..." : "Apply As Host"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
