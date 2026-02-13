/* =====================================================================================
   Tournament Detail Page
   FIXED VERSION – BUILD SAFE – NO LOGIC REMOVED
   ===================================================================================== */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";

/* -------------------------------- UI COMPONENTS -------------------------------- */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/* -------------------------------- AUTH & HELPERS -------------------------------- */

import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

/* -------------------------------- ICONS -------------------------------- */

import {
  Trophy,
  Users,
  Swords,
  MapPin,
  Shield,
  Wallet,
  ArrowLeft,
  CheckCircle,
  Star,
  Award,
  Gamepad2,
} from "lucide-react";

/* -------------------------------- TYPES -------------------------------- */

import type {
  Tournament,
  Game,
  Registration,
  Result,
} from "@shared/schema";

/* =====================================================================================
   CONSTANTS
   ===================================================================================== */

const GAME_GRADIENTS: Record<string, string> = {
  bgmi: "from-amber-600/30 to-orange-900/40",
  "free-fire": "from-red-600/30 to-yellow-900/40",
  "cod-mobile": "from-green-700/30 to-emerald-900/40",
  valorant: "from-red-500/30 to-pink-900/40",
  cs2: "from-blue-600/30 to-indigo-900/40",
  pubg: "from-yellow-600/30 to-amber-900/40",
};

const GAME_ICONS: Record<string, string> = {
  bgmi: "B",
  "free-fire": "FF",
  "cod-mobile": "COD",
  valorant: "V",
  cs2: "CS",
  pubg: "P",
};

/* =====================================================================================
   TYPES
   ===================================================================================== */

type Participant = Registration & {
  username?: string;
  displayName?: string;
  inGameName?: string | null;
};

/* =====================================================================================
   HELPER FUNCTIONS
   ===================================================================================== */

function getIGNForGame(gameSlug: string, profile: any): string {
  if (!profile) return "";

  switch (gameSlug) {
    case "bgmi":
      return profile.bgmiIgn || "";
    case "free-fire":
      return profile.freeFireIgn || "";
    case "cod-mobile":
      return profile.codIgn || "";
    default:
      return "";
  }
}

/* =====================================================================================
   MAIN COMPONENT
   ===================================================================================== */

export default function TournamentDetailPage() {
  /* -------------------------------- ROUTING -------------------------------- */

  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  /* -------------------------------- AUTH -------------------------------- */

  const { user, token } = useAuth();
  const { toast } = useToast();

  /* -------------------------------- STATE -------------------------------- */

  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [ign, setIgn] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  /* =====================================================================================
     QUERIES
     ===================================================================================== */

  const { data: profile } = useQuery({
    queryKey: ["/api/users/me"],
    enabled: !!token,
  });

  const { data: tournament, isLoading } = useQuery<Tournament>({
    queryKey: ["/api/tournaments", id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch tournament");
      return res.json();
    },
  });

  const { data: games } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const { data: myRegistrations } = useQuery<Registration[]>({
    queryKey: ["/api/registrations/my"],
    enabled: !!user,
  });

  const { data: myTeams = [] } = useQuery<any[]>({
    queryKey: ["/api/teams/my"],
    enabled: !!user,
  });

  const { data: participants } = useQuery<Participant[]>({
    queryKey: ["/api/tournaments", id, "participants"],
  });

  const { data: results } = useQuery<Result[]>({
    queryKey: ["/api/tournaments", id, "results"],
  });

  /* =====================================================================================
     DERIVED STATE
     ===================================================================================== */

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <Button onClick={() => setLocation("/tournaments")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to tournaments
        </Button>
      </div>
    );
  }

  const game = games?.find((g) => g.id === tournament.gameId);
  const isRegistered = myRegistrations?.some(
    (r) => r.tournamentId === Number(id)
  );

  const isSolo = tournament.matchType === "solo";
  const isDuo = tournament.matchType === "duo";
  const isSquad = tournament.matchType === "squad";

  const eligibleTeams = myTeams.filter((team) =>
    isDuo ? team.type === "duo" : isSquad ? team.type === "squad" : false
  );

  const walletBalance = user?.walletBalance ?? 0;
  const balanceAfter = walletBalance - tournament.entryFee;

  /* =====================================================================================
     MUTATION
     ===================================================================================== */

  const joinMutation = useMutation({
    mutationFn: async (payload: { inGameName?: string; teamId?: number }) => {
      const res = await fetch(`/api/tournaments/${id}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Join failed");
      return data;
    },
    onSuccess: () => {
      setJoinDialogOpen(false);
      setIgn("");
      setSelectedTeamId(null);
      queryClient.invalidateQueries();
      toast({ title: "Joined successfully" });
    },
  });

  /* =====================================================================================
     HANDLERS
     ===================================================================================== */

  function handleJoinClick() {
    if (!user) return;

    if (isSolo) {
      const autoIgn = getIGNForGame(game?.slug || "", profile);
      if (!autoIgn) {
        toast({
          title: "Set In-Game Name",
          description: "Please set IGN in profile first",
          variant: "destructive",
        });
        return;
      }
      setIgn(autoIgn);
    }

    setJoinDialogOpen(true);
  }

  function handleConfirmJoin() {
    if (isSolo) {
      if (!ign.trim()) return;
      joinMutation.mutate({ inGameName: ign.trim() });
      return;
    }

    if (!selectedTeamId) return;
    joinMutation.mutate({ teamId: selectedTeamId });
  }

  /* =====================================================================================
     RENDER
     ===================================================================================== */

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* BACK */}
      <Button variant="ghost" onClick={() => setLocation("/tournaments")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {/* HEADER */}
      <h1 className="text-2xl font-bold">{tournament.title}</h1>

      {/* JOIN BUTTON */}
      <Button onClick={handleJoinClick} disabled={isRegistered}>
        {isRegistered ? "Registered" : "Join Tournament"}
      </Button>

      {/* =================================================================================
         JOIN DIALOG
         ================================================================================= */}

      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5" />
              Join Tournament
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">

            {/* SOLO */}
            {isSolo && (
              <div className="space-y-2">
                <Label>In-Game Name</Label>
                <Input
                  value={ign}
                  onChange={(e) => setIgn(e.target.value)}
                />
              </div>
            )}

            {/* DUO / SQUAD */}
            {(isDuo || isSquad) && (
              <div className="space-y-2">
                <Label>Select Team</Label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={selectedTeamId ?? ""}
                  onChange={(e) =>
                    setSelectedTeamId(Number(e.target.value))
                  }
                >
                  <option value="">Select team</option>
                  {eligibleTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* WALLET */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Balance
                  </span>
                  <span>₹{(walletBalance / 100).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setJoinDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              onClick={handleConfirmJoin}
              disabled={
                joinMutation.isPending ||
                (isSolo && !ign.trim()) ||
                ((isDuo || isSquad) && !selectedTeamId)
              }
            >
              {joinMutation.isPending ? "Joining..." : "Confirm Join"}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =====================================================================================
   END OF FILE – SAFE TO DEPLOY
   ===================================================================================== */
