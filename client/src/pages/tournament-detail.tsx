/* =====================================================================================
   BATTLE NEST – ULTIMATE TOURNAMENT DETAILS PAGE
   VERSION: ENTERPRISE / ESPORTS PLATFORM LEVEL
   LINES: 650+
   ===================================================================================== */

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";

/* -------------------------------- UI -------------------------------- */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

/* -------------------------------- AUTH -------------------------------- */

import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

/* -------------------------------- ICONS -------------------------------- */

import {
  Trophy,
  Users,
  Wallet,
  Clock,
  MapPin,
  Shield,
  Swords,
  ArrowLeft,
  Crown,
  Gamepad2,
  Lock,
  Unlock,
  Star,
} from "lucide-react";

/* -------------------------------- TYPES -------------------------------- */

import type {
  Tournament,
  Game,
  Registration,
  Result,
} from "@shared/schema";

/* =====================================================================================
   HELPERS
   ===================================================================================== */

function formatMoney(amount = 0) {
  return `₹${(amount / 100).toFixed(2)}`;
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTournamentImage(t: Tournament, g?: Game) {
  if (t?.imageUrl) return t.imageUrl;
  if (g?.imageUrl) return g.imageUrl;
  return "/tournament-placeholder.jpg";
}

function getIGNForGame(slug: string, user: any) {
  if (!user) return "";
  switch (slug) {
    case "bgmi":
<<<<<<< HEAD
      return user.bgmiIgn || "";
    case "free-fire":
      return user.freeFireIgn || "";
    case "cod-mobile":
      return user.codIgn || "";
=======
      return user.bgmiId || "";
    case "free-fire":
      return user.freeFireId || "";
    case "cod-mobile":
      return user.codMobileId || "";
>>>>>>> d6ba416d3f53141b8989651729525050668978d8
    default:
      return "";
  }
}

<<<<<<< HEAD
async function fetchJsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || "Request failed");
  }
  return data as T;
}

=======
>>>>>>> d6ba416d3f53141b8989651729525050668978d8
/* =====================================================================================
   MAIN COMPONENT
   ===================================================================================== */

export default function TournamentDetailPage() {
  /* ---------------- ROUTING ---------------- */

  const { id } = useParams<{ id: string }>();
  const tournamentId = Number(id);
  const [, setLocation] = useLocation();

  /* ---------------- AUTH ---------------- */

  const { user, token } = useAuth();
  const { toast } = useToast();

  /* ---------------- STATE ---------------- */

  const [joinOpen, setJoinOpen] = useState(false);
  const [ign, setIgn] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);

  /* =====================================================================================
     QUERIES (ALL SAFE – NO CONDITIONAL HOOKS)
     ===================================================================================== */

  const tournamentQuery = useQuery<Tournament>({
    queryKey: ["tournament", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
<<<<<<< HEAD
      return fetchJsonOrThrow<Tournament>(`/api/tournaments/${tournamentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
=======
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.json();
>>>>>>> d6ba416d3f53141b8989651729525050668978d8
    },
  });

  const gamesQuery = useQuery<Game[]>({
    queryKey: ["games"],
  });

  const registrationsQuery = useQuery<Registration[]>({
    queryKey: ["my-registrations"],
    enabled: !!user,
    queryFn: async () => {
<<<<<<< HEAD
      return fetchJsonOrThrow<Registration[]>("/api/registrations/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
=======
      const res = await fetch("/api/registrations/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
>>>>>>> d6ba416d3f53141b8989651729525050668978d8
    },
  });

  const teamsQuery = useQuery<any[]>({
    queryKey: ["my-teams"],
    enabled: !!user,
    queryFn: async () => {
<<<<<<< HEAD
      return fetchJsonOrThrow<any[]>("/api/teams/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
=======
      const res = await fetch("/api/teams/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
>>>>>>> d6ba416d3f53141b8989651729525050668978d8
    },
  });

  const participantsQuery = useQuery<any[]>({
    queryKey: ["participants", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
<<<<<<< HEAD
      return fetchJsonOrThrow<any[]>(`/api/tournaments/${tournamentId}/participants`);
=======
      const res = await fetch(`/api/tournaments/${tournamentId}/participants`);
      return res.json();
>>>>>>> d6ba416d3f53141b8989651729525050668978d8
    },
  });

  const resultsQuery = useQuery<Result[]>({
    queryKey: ["results", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
<<<<<<< HEAD
      return fetchJsonOrThrow<Result[]>(`/api/tournaments/${tournamentId}/results`);
=======
      const res = await fetch(`/api/tournaments/${tournamentId}/results`);
      return res.json();
>>>>>>> d6ba416d3f53141b8989651729525050668978d8
    },
  });

  /* =====================================================================================
     MUTATION – JOIN
     ===================================================================================== */

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");
<<<<<<< HEAD
      if (!tournament) throw new Error("Tournament not found");

      if (tournament.matchType !== "solo" && !teamId) {
        throw new Error("Please select a team");
      }
=======
>>>>>>> d6ba416d3f53141b8989651729525050668978d8

      const payload =
        tournament?.matchType === "solo"
          ? { inGameName: ign }
          : { teamId };

      const res = await fetch(`/api/tournaments/${tournamentId}/join`, {
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
      toast({ title: "Successfully joined tournament" });
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
  const registrations = registrationsQuery.data || [];
  const teams = teamsQuery.data || [];
  const participants = participantsQuery.data || [];
  const results = resultsQuery.data || [];

  const game = useMemo(
    () => games.find((g) => g.id === tournament?.gameId),
    [games, tournament]
  );

  const joined = registrations.some(
    (r) => r.tournamentId === tournament?.id
  );

  const isSolo = tournament?.matchType === "solo";
  const isDuo = tournament?.matchType === "duo";
  const isSquad = tournament?.matchType === "squad";

  const eligibleTeams = useMemo(() => {
    if (isDuo) return teams.filter((t) => t.members?.length === 2);
    if (isSquad) return teams.filter((t) => t.members?.length === 4);
    return [];
  }, [teams, isDuo, isSquad]);

  /* =====================================================================================
     LOADING & ERROR STATES
     ===================================================================================== */

  if (tournamentQuery.isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <Button onClick={() => setLocation("/tournaments")}>
          Back to tournaments
        </Button>
      </div>
    );
  }

  /* =====================================================================================
     UI
     ===================================================================================== */

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">

      {/* BACK */}
      <Button variant="ghost" onClick={() => setLocation("/tournaments")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      {/* BANNER */}
      <Card className="overflow-hidden">
        <div className="relative h-[300px]">
          <img
            src={getTournamentImage(tournament, game)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
          <div className="absolute bottom-6 left-6">
            <Badge className="mb-2">
              {tournament.matchType.toUpperCase()}
            </Badge>
            <h1 className="text-3xl font-bold text-white">
              {tournament.title}
            </h1>
            <p className="text-sm text-gray-300 mt-1">
              {game?.name}
            </p>
          </div>
        </div>
      </Card>

      {/* STATS */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <Progress
            value={(tournament.filledSlots / tournament.maxSlots) * 100}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><Users className="inline w-4 h-4" /> {tournament.filledSlots}/{tournament.maxSlots}</div>
            <div><Wallet className="inline w-4 h-4" /> {formatMoney(tournament.entryFee)}</div>
            <div><Trophy className="inline w-4 h-4" /> {formatMoney(tournament.prizePool)}</div>
            <div><Clock className="inline w-4 h-4" /> {formatDate(tournament.startTime)}</div>
          </div>

<<<<<<< HEAD
          <Button
            disabled={joined}
            onClick={() => {
              if (!user) {
                setLocation("/auth");
                return;
              }
              if (isSolo && game?.slug) {
                setIgn(getIGNForGame(game.slug, user));
              }
              setTeamId(null);
              setJoinOpen(true);
            }}
          >
=======
          <Button disabled={joined} onClick={() => setJoinOpen(true)}>
>>>>>>> d6ba416d3f53141b8989651729525050668978d8
            {joined ? "Registered" : "Join Tournament"}
          </Button>
        </CardContent>
      </Card>

      {/* ROOM DETAILS */}
      {tournament.status === "live" && joined && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" /> Room Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>Room ID: <b>{tournament.roomId}</b></p>
            <p>Password: <b>{tournament.roomPassword}</b></p>
          </CardContent>
        </Card>
      )}

      {/* RULES */}
      {tournament.rules && (
        <Card>
          <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-line">
            {tournament.rules}
          </CardContent>
        </Card>
      )}

      {/* DESCRIPTION */}
      {tournament.description && (
        <Card>
          <CardHeader><CardTitle>Description</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-line">
            {tournament.description}
          </CardContent>
        </Card>
      )}

      {/* PRIZE DISTRIBUTION */}
      {Array.isArray(tournament.prizeDistribution) && (
        <Card>
          <CardHeader><CardTitle>Prize Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {tournament.prizeDistribution.map((p: any) => (
              <div key={p.position} className="flex justify-between">
                <span>#{p.position}</span>
                <span>{formatMoney(p.prize)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* PARTICIPANTS */}
      <Card>
        <CardHeader><CardTitle>Participants</CardTitle></CardHeader>
        <CardContent className="max-h-[300px] overflow-y-auto space-y-2">
          {participants.map((p: any) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span>{p.username || p.displayName}</span>
              <Badge variant="outline">Joined</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RESULTS */}
      {tournament.status === "completed" && (
        <Card>
          <CardHeader><CardTitle>Winners</CardTitle></CardHeader>
          <CardContent>
            {results.length === 0 && <p>Results will be updated soon</p>}
            {results.map((r) => (
              <div key={r.id} className="flex justify-between">
                <span>#{r.position}</span>
                <span>{formatMoney(r.prize)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* JOIN MODAL */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Tournament</DialogTitle>
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
              {joinMutation.isPending ? "Joining..." : "Confirm Join"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
