/* =====================================================================================
   BATTLE NEST – TOURNAMENT DETAIL PAGE
   FULL STABLE VERSION – SOLO / DUO / SQUAD READY
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
  MapPin,
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

function formatCurrency(amount: number) {
  return `₹${(amount / 100).toFixed(2)}`;
}

/* =====================================================================================
   MAIN COMPONENT
   ===================================================================================== */

export default function TournamentDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [, setLocation] = useLocation();

  const { user, token } = useAuth();
  const { toast } = useToast();

  const [joinOpen, setJoinOpen] = useState(false);
  const [ign, setIgn] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  /* ================================= SAFETY ================================= */

  if (!id) {
    return (
      <div className="text-center py-12">
        <p>Invalid tournament ID</p>
        <Button onClick={() => setLocation("/tournaments")}>
          Back
        </Button>
      </div>
    );
  }

  /* ================================= QUERIES ================================= */

  const { data: tournament, isLoading } = useQuery<Tournament>({
    queryKey: ["tournament", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch tournament");
      return res.json();
    },
  });

  const { data: games } = useQuery<Game[]>({
    queryKey: ["games"],
  });

  const { data: myRegistrations } = useQuery<Registration[]>({
    queryKey: ["my-registrations"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch("/api/registrations/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  const { data: myTeams = [] } = useQuery<any[]>({
    queryKey: ["my-teams"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch("/api/teams/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  const { data: participants = [] } = useQuery<any[]>({
    queryKey: ["participants", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/participants`);
      return res.json();
    },
  });

  const { data: results = [] } = useQuery<Result[]>({
    queryKey: ["results", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/results`);
      return res.json();
    },
  });

  /* ================================= LOADING ================================= */

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <Trophy className="mx-auto mb-4" />
        <Button onClick={() => setLocation("/tournaments")}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Button>
      </div>
    );
  }

  /* ================================= DERIVED ================================= */

  const game = games?.find((g) => g.id === tournament.gameId);
  const isJoined = myRegistrations?.some(
    (r) => r.tournamentId === Number(id)
  );

  const isSolo = tournament.matchType === "solo";
  const isDuo = tournament.matchType === "duo";
  const isSquad = tournament.matchType === "squad";

  const eligibleTeams = myTeams.filter((team: any) =>
    isDuo ? team.members?.length === 2 :
    isSquad ? team.members?.length === 4 :
    false
  );

  const walletBalance = user?.walletBalance ?? 0;
  const progress = (tournament.filledSlots / tournament.maxSlots) * 100;

  /* ================================= JOIN ================================= */

  const joinMutation = useMutation({
    mutationFn: async () => {
      const payload =
        isSolo
          ? { inGameName: ign }
          : { teamId: selectedTeamId };

      const res = await fetch(`/api/tournaments/${id}/join`, {
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
    onError: (e: any) => {
      toast({
        title: "Join failed",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  function openJoin() {
    if (!user) {
      toast({ title: "Login required", variant: "destructive" });
      return;
    }

    if (isSolo) {
      const auto = getIGNForGame(game?.slug || "", user);
      if (!auto) {
        toast({
          title: "Set your IGN first",
          description: "Go to profile and save your IGN",
          variant: "destructive",
        });
        return;
      }
      setIgn(auto);
    }

    setJoinOpen(true);
  }

  /* ================================= RENDER ================================= */

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">

      <Button variant="ghost" onClick={() => setLocation("/tournaments")}>
        <ArrowLeft className="mr-2 w-4 h-4" />
        Back
      </Button>

      <h1 className="text-2xl font-bold">{tournament.title}</h1>

      <Card>
        <CardContent className="space-y-4 p-4">

          <div className="flex justify-between">
            <Badge>{tournament.matchType.toUpperCase()}</Badge>
            <Badge variant="outline">{tournament.status}</Badge>
          </div>

          <div className="flex items-center gap-3">
            <Users className="w-4 h-4" />
            {tournament.filledSlots} / {tournament.maxSlots}
          </div>

          <Progress value={progress} />

          <div className="flex items-center gap-3">
            <Wallet className="w-4 h-4" />
            Entry Fee: {formatCurrency(tournament.entryFee)}
          </div>

          <div className="flex items-center gap-3">
            <Trophy className="w-4 h-4" />
            Prize Pool: {formatCurrency(tournament.prizePool)}
          </div>

          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4" />
            {new Date(tournament.startTime).toLocaleString("en-IN")}
          </div>

          {tournament.roomId && (
            <div className="flex items-center gap-3 text-green-500">
              <Shield className="w-4 h-4" />
              Room ID: {tournament.roomId}
            </div>
          )}

          <Button disabled={isJoined} onClick={openJoin}>
            {isJoined ? "Registered" : "Join Tournament"}
          </Button>

        </CardContent>
      </Card>

      {/* PARTICIPANTS */}
      <Card>
        <CardHeader>
          <CardTitle>Participants ({participants.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {participants.map((p) => (
            <div key={p.id} className="text-sm border-b pb-1">
              {p.displayName || p.username}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RESULTS */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span>Position #{r.position}</span>
                <span>{formatCurrency(r.prize)}</span>
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
                value={selectedTeamId ?? ""}
                onChange={(e) => setSelectedTeamId(Number(e.target.value))}
              >
                <option value="">Select Team</option>
                {eligibleTeams.map((team: any) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
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
