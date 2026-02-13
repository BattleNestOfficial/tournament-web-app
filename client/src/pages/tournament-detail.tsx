/* =====================================================================================
   BATTLE NEST – ADVANCED TOURNAMENT DETAIL PAGE
   FULL UI + SAFE HOOKS + NO CRASHES
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
  Clock,
  MapPin,
  Shield,
  Award,
  Crown,
  Swords,
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

function money(v: number) {
  return `₹${(v / 100).toFixed(0)}`;
}

function getIGN(slug: string, user: any) {
  if (!user) return "";
  if (slug === "bgmi") return user.bgmiId || "";
  if (slug === "free-fire") return user.freeFireId || "";
  if (slug === "cod-mobile") return user.codMobileId || "";
  return "";
}

/* =====================================================================================
   MAIN COMPONENT
   ===================================================================================== */

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params?.id ? Number(params.id) : null;
  const [, setLocation] = useLocation();

  const { user, token } = useAuth();
  const { toast } = useToast();

  const [joinOpen, setJoinOpen] = useState(false);
  const [ign, setIgn] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);

  /* =====================================================================================
     QUERIES (SAFE)
     ===================================================================================== */

  const tournamentQ = useQuery<Tournament>({
    queryKey: ["tournament", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const gamesQ = useQuery<Game[]>({ queryKey: ["games"] });

  const registrationsQ = useQuery<Registration[]>({
    queryKey: ["my-registrations"],
    enabled: !!user,
    queryFn: async () => {
      const r = await fetch("/api/registrations/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
  });

  const participantsQ = useQuery<any[]>({
    queryKey: ["participants", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants`);
      return r.json();
    },
  });

  const resultsQ = useQuery<Result[]>({
    queryKey: ["results", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/results`);
      return r.json();
    },
  });

  const teamsQ = useQuery<any[]>({
    queryKey: ["my-teams"],
    enabled: !!user,
    queryFn: async () => {
      const r = await fetch("/api/teams/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
  });

  /* =====================================================================================
     MUTATION
     ===================================================================================== */

  const joinMutation = useMutation({
    mutationFn: async () => {
      const payload =
        tournamentQ.data?.matchType === "solo"
          ? { inGameName: ign }
          : { teamId };

      const r = await fetch(`/api/tournaments/${tournamentId}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Joined successfully" });
      queryClient.invalidateQueries();
      setJoinOpen(false);
    },
    onError: (e: any) =>
      toast({
        title: "Join failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  /* =====================================================================================
     STATES
     ===================================================================================== */

  if (!tournamentId) return null;

  if (tournamentQ.isLoading)
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  const tournament = tournamentQ.data!;
  const game = gamesQ.data?.find((g) => g.id === tournament.gameId);
  const joined = registrationsQ.data?.some(
    (r) => r.tournamentId === tournament.id
  );

  const isLive = tournament.status === "live";
  const isCompleted = tournament.status === "completed";

  const slotPercent =
    (tournament.filledSlots / tournament.maxSlots) * 100;

  /* =====================================================================================
     RENDER
     ===================================================================================== */

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">

      <Button variant="ghost" onClick={() => setLocation("/tournaments")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <h1 className="text-3xl font-bold">{tournament.title}</h1>

      <Card>
        <CardContent className="space-y-4 p-4">
          <Badge>{tournament.matchType.toUpperCase()}</Badge>

          <Progress value={slotPercent} />

          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div><Users className="inline w-4 h-4" /> {tournament.filledSlots}/{tournament.maxSlots}</div>
            <div><Wallet className="inline w-4 h-4" /> {money(tournament.entryFee)}</div>
            <div><Clock className="inline w-4 h-4" /> {new Date(tournament.startTime).toLocaleString("en-IN")}</div>
          </div>

          <Button disabled={joined} onClick={() => {
            if (tournament.matchType === "solo") {
              const auto = getIGN(game?.slug || "", user);
              if (!auto) {
                toast({ title: "Set IGN in profile", variant: "destructive" });
                return;
              }
              setIgn(auto);
            }
            setJoinOpen(true);
          }}>
            {joined ? "Registered" : "Join Tournament"}
          </Button>
        </CardContent>
      </Card>

      {/* ROOM INFO */}
      {isLive && (
        <Card>
          <CardHeader>
            <CardTitle>Room Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p><MapPin className="inline w-4 h-4" /> Room ID: <b>{tournament.roomId}</b></p>
            <p><Shield className="inline w-4 h-4" /> Password: <b>{tournament.roomPassword}</b></p>
          </CardContent>
        </Card>
      )}

      {/* DESCRIPTION & RULES */}
      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent className="whitespace-pre-line">{tournament.description || "—"}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
        <CardContent className="whitespace-pre-line">{tournament.rules || "—"}</CardContent>
      </Card>

      {/* PRIZES */}
      <Card>
        <CardHeader><CardTitle>Prize Distribution</CardTitle></CardHeader>
        <CardContent>
          {tournament.prizeDistribution?.map((p: any) => (
            <div key={p.position} className="flex justify-between">
              <span><Award className="inline w-4 h-4" /> #{p.position}</span>
              <span>{money(p.prize)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* PARTICIPANTS */}
      <Card>
        <CardHeader><CardTitle>Joined Players</CardTitle></CardHeader>
        <CardContent>
          {participantsQ.data?.map((p, i) => (
            <div key={i} className="text-sm">{p.username} – {p.inGameName}</div>
          )) || "No players yet"}
        </CardContent>
      </Card>

      {/* RESULTS */}
      {isCompleted && (
        <Card>
          <CardHeader><CardTitle>Winners</CardTitle></CardHeader>
          <CardContent>
            {resultsQ.data?.map((r) => (
              <div key={r.id}>
                <Crown className="inline w-4 h-4" /> Position {r.position} – Prize {money(r.prize)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* JOIN DIALOG */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Join</DialogTitle>
          </DialogHeader>

          {tournament.matchType === "solo" && (
            <>
              <Label>In-Game Name</Label>
              <Input value={ign} onChange={(e) => setIgn(e.target.value)} />
            </>
          )}

          {(tournament.matchType === "duo" || tournament.matchType === "squad") && (
            <>
              <Label>Select Team</Label>
              <select
                className="w-full border px-3 py-2"
                value={teamId ?? ""}
                onChange={(e) => setTeamId(Number(e.target.value))}
              >
                <option value="">Select team</option>
                {teamsQ.data?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
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
