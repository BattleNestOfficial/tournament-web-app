/* =====================================================================================
   BATTLE NEST – ADVANCED TOURNAMENT DETAILS PAGE
   FULL FEATURED | STABLE | PRODUCTION READY
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

import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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

function formatMoney(v = 0) {
  return `₹${(v / 100).toFixed(2)}`;
}

function getTournamentImage(t: any, g: any) {
  if (t?.imageUrl) return t.imageUrl;
  if (g?.imageUrl) return g.imageUrl;
  return "/placeholder-tournament.jpg";
}

function getIGNForGame(slug: string, user: any) {
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

/* =====================================================================================
   MAIN COMPONENT
   ===================================================================================== */

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();

  const tournamentId = Number(id);

  const [joinOpen, setJoinOpen] = useState(false);
  const [ign, setIgn] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);

  /* ================================= QUERIES ================================= */

  const tournamentQuery = useQuery<Tournament>({
    queryKey: ["tournament", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.json();
    },
  });

  const gamesQuery = useQuery<Game[]>({
    queryKey: ["games"],
  });

  const myRegsQuery = useQuery<Registration[]>({
    queryKey: ["my-registrations"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch("/api/registrations/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  const teamsQuery = useQuery<any[]>({
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

  /* ================================= MUTATION ================================= */

  const joinMutation = useMutation({
    mutationFn: async () => {
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
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Joined successfully" });
      queryClient.invalidateQueries();
      setJoinOpen(false);
    },
    onError: (e: any) =>
      toast({ title: "Join failed", description: e.message, variant: "destructive" }),
  });

  /* ================================= SAFE DATA ================================= */

  const tournament = tournamentQuery.data;
  const games = gamesQuery.data || [];
  const myRegs = myRegsQuery.data || [];
  const teams = teamsQuery.data || [];
  const participants = participantsQuery.data || [];
  const results = resultsQuery.data || [];

  if (tournamentQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <Button onClick={() => setLocation("/tournaments")}>Back</Button>
      </div>
    );
  }

  const game = games.find((g) => g.id === tournament.gameId);
  const joined = myRegs.some((r) => r.tournamentId === tournament.id);
  const isLive = tournament.status === "live";

  /* ================================= RENDER ================================= */

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">

      <Button variant="ghost" onClick={() => setLocation("/tournaments")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      {/* BANNER */}
      <Card className="overflow-hidden">
        <div className="relative h-[260px]">
          <img
            src={getTournamentImage(tournament, game)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute bottom-4 left-4">
            <Badge>{tournament.matchType.toUpperCase()}</Badge>
            <h1 className="text-3xl font-bold text-white mt-2">
              {tournament.title}
            </h1>
          </div>
        </div>
      </Card>

      {/* INFO */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <Progress value={(tournament.filledSlots / tournament.maxSlots) * 100} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><Users className="inline w-4 h-4" /> {tournament.filledSlots}/{tournament.maxSlots}</div>
            <div><Wallet className="inline w-4 h-4" /> {formatMoney(tournament.entryFee)}</div>
            <div><Trophy className="inline w-4 h-4" /> {formatMoney(tournament.prizePool)}</div>
            <div><Clock className="inline w-4 h-4" /> {new Date(tournament.startTime).toLocaleString("en-IN")}</div>
          </div>

          <Button disabled={joined} onClick={() => setJoinOpen(true)}>
            {joined ? "Registered" : "Join Tournament"}
          </Button>
        </CardContent>
      </Card>

      {/* ROOM DETAILS */}
      {isLive && joined && (
        <Card>
          <CardHeader><CardTitle>Room Details</CardTitle></CardHeader>
          <CardContent>
            <p>Room ID: <b>{tournament.roomId}</b></p>
            <p>Password: <b>{tournament.roomPassword}</b></p>
          </CardContent>
        </Card>
      )}

      {/* RULES */}
      {tournament.rules && (
        <Card>
          <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-line">{tournament.rules}</CardContent>
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
        <CardContent className="space-y-2">
          {participants.map((p: any) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span>{p.displayName || p.username}</span>
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
            {results.length === 0 && <p>Results coming soon</p>}
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
          <DialogHeader><DialogTitle>Join Tournament</DialogTitle></DialogHeader>

          {tournament.matchType === "solo" && (
            <>
              <Label>In-Game Name</Label>
              <Input value={ign} onChange={(e) => setIgn(e.target.value)} />
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>Cancel</Button>
            <Button onClick={() => joinMutation.mutate()}>
              {joinMutation.isPending ? "Joining..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
