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
import { Gamepad2, Save, Trophy, Clock, Wallet } from "lucide-react";
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

  const { data: registrations } = useQuery<
    (Registration & { tournament?: Tournament })[]
  >({
    queryKey: ["/api/registrations/my"],
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bgmiIgn: gameIGNs.bgmiIgn || null,
          freeFireIgn: gameIGNs.freeFireIgn || null,
          codIgn: gameIGNs.codIgn || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
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

  useEffect(() => {
    if (!user) setLocation("/auth");
  }, [user, setLocation]);

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
                  placeholder="Enter BGMI name"
                  value={gameIGNs.bgmiIgn}
                  onChange={(e) =>
                    setGameIGNs((p) => ({
                      ...p,
                      bgmiIgn: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label className="text-xs">Free Fire In-Game Name</Label>
                <Input
                  placeholder="Enter Free Fire name"
                  value={gameIGNs.freeFireIgn}
                  onChange={(e) =>
                    setGameIGNs((p) => ({
                      ...p,
                      freeFireIgn: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label className="text-xs">COD Mobile In-Game Name</Label>
                <Input
                  placeholder="Enter COD name"
                  value={gameIGNs.codIgn}
                  onChange={(e) =>
                    setGameIGNs((p) => ({
                      ...p,
                      codIgn: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? "Saving..." : "Save In-Game Names"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* MATCH HISTORY */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Match History
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          {registrations && registrations.length > 0 ? (
            <div className="space-y-1">
              {registrations.map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-muted text-primary">
                      <Trophy className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Tournament #{reg.tournamentId}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(reg.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Registered
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No match history yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
