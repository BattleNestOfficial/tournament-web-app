/* =====================================================================================
   BATTLE NEST – TOURNAMENT DETAIL PAGE
   FINAL STABLE VERSION – REACT SAFE – NO INVALID HOOKS
   ===================================================================================== */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

import {
  Trophy,
  Users,
  Wallet,
  ArrowLeft,
  Swords,
  Shield,
  Clock,
} from "lucide-react";

import type {
  Tournament,
  Game,
  Registration,
  Result,
} from "@shared/schema";

/* =====================================================================================
   HELPERS
   ===================================================================================== */

function getIGNForGame(slug: string, user: any): string {
  if (!user) return "";
  switch (slug) {
    case "bgmi":
      return user.bgmiId || "";
    case "free-fire":
      return user.freeFireId || "";
    case "cod-mobile":
      return user.codMobileId || "";
    default:
      return "";
  }
}

function formatMoney(v: number) {
  return `₹${(v / 100).toFixed(2)}`;
}

/* =====================================================================================
   MAIN COMPONENT
   ===================================================================================== */

export default function TournamentDetailPage() {
  /* ---------------- ROUTING ---------------- */

  const params = useParams();
  const tournamentId = params?.id ? Number(params.id) : null;
  const [, setLocation] = useLocation();

  /* ---------------- AUTH ---------------- */

  const { user, token } = useAuth();
  const { toast } = useToast();

  /* ---------------- STATE ---------------- */

  const [joinOpen, setJoinOpen] = useState(false);
  const [ign, setIgn] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);

  /* =====================================================================================
     QUERIES (ALL HOOKS RUN UNCONDITIONALLY)
     ===================================================================================== */

  const tournamentQuery = useQuery<Tournament>({
    queryKey: ["tournament", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load tournament");
      return res.json();
    },
  });

  const gamesQuery = useQuery<Game[]>({
    queryKey: ["games"],
  });

  const myRegistrationsQuery = useQuery<Registration[]>({
    queryKey: ["my-registrations"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch("/api/registrations/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  const myTeamsQuery = useQuery<any[]>({
    queryKey: ["my-teams"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch("/api/teams/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  const participantsQuery = useQuery<any[]>({
    queryKey: ["participants", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}/participants`);
      return res.json();
    },
  });

  const resultsQuery = useQuery<Result[]>({
    queryKey: ["results", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}/results`);
      return res.json();
    },
  });

  /* =====================================================================================
     MUTATION
     ===================================================================================== */

  const joinMutation = useMutation({
    mutationFn: async () => {
      const payload =
        tournamentQuery.data?.matchType === "solo"
          ? { inGameName: ign }
          : { teamId };

      const res = await fetch(
        `/api/tournaments/${tournamentId}/join`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Joined successfully" });
      queryClient.invalidateQueries();
      setJoinOpen(false);
    },
    onError: (e: any) => {
      toast({
        title: "Join failed",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  /* =====================================================================================
     SAFE DERIVED DATA
     ===================================================================================== */

  const tournament = tournamentQuery.data;
  const games = gamesQuery.data || [];
  const registrations = myRegistrationsQuery.data || [];
  const teams = myTeamsQuery.data || [];
  const participants = participantsQuery.data || [];
  const results = resultsQuery.data || [];

  if (!tournamentId) {
    return (
      <div className="text-center py-12">
        <Button onClick={() => setLocation("/tournaments")}>
          Back
        </Button>
      </div>
    );
  }

  if (tournamentQuery.isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <Trophy className="mx-auto mb-4" />
        <Button onClick={() => setLocation("/tournaments")}>
          Back
        </Button>
      </div>
    );
  }

  /* =====================================================================================
     LOGIC
     ===================================================================================== */

  const game = games.find((g) => g.id === tournament.gameId);
  const joined = registrations.some(
    (r) => r.tournamentId === tournament.id
  );

  const isSolo = tournament.matchType === "solo";
  const isDuo = tournament.matchType === "duo";
  const isSquad = tournament.matchType === "squad";

  const eligibleTeams = teams.filter((t: any) =>
    isDuo ? t.members?.length === 2 :
    isSquad ? t.members?.length === 4 :
    false
  );

  const slotProgress =
    (tournament.filledSlots / tournament.maxSlots) * 100;

  function openJoin() {
    if (!user) {
      toast({ title: "Login required", variant: "destructive" });
      return;
    }

    if (isSolo) {
      const auto = getIGNForGame(game?.slug || "", user);
      if (!auto) {
        toast({
          title: "Set IGN first",
          description: "Update your profile",
          variant: "destructive",
        });
        return;
      }
      setIgn(auto);
    }

    setJoinOpen(true);
  }

  /* =====================================================================================
     RENDER
     ===================================================================================== */

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">

      <Button variant="ghost" onClick={() => setLocation("/tournaments")}>
        <ArrowLeft className="mr-2 w-4 h-4" />
        Back
      </Button>

      <h1 className="text-2xl font-bold">{tournament.title}</h1>

      <Card>
        <CardContent className="space-y-4 p-4">
          <Badge>{tournament.matchType.toUpperCase()}</Badge>

          <Progress value={slotProgress} />

          <div className="flex gap-4 text-sm">
            <span><Users className="inline w-4 h-4" /> {tournament.filledSlots}/{tournament.maxSlots}</span>
            <span><Wallet className="inline w-4 h-4" /> {formatMoney(tournament.entryFee)}</span>
            <span><Clock className="inline w-4 h-4" /> {new Date(tournament.startTime).toLocaleString("en-IN")}</span>
          </div>

          <Button disabled={joined} onClick={openJoin}>
            {joined ? "Registered" : "Join Tournament"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Join</DialogTitle>
          </DialogHeader>

          {isSolo && (
            <>
              <Label>In-Game Name</Label>
              <Input value={ign} onChange={(e) => setIgn(e.target.value)} />
            </>
          )}

          {(isDuo || isSquad) && (
            <>
              <Label>Select Team</Label>
              <select
                className="w-full border rounded px-3 py-2"
                value={teamId ?? ""}
                onChange={(e) => setTeamId(Number(e.target.value))}
              >
                <option value="">Select team</option>
                {eligibleTeams.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => joinMutation.mutate()}>
              {joinMutation.isPending ? "Joining..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
