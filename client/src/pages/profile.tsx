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
  Swords,
  Clock,
  MapPin,
  Shield,
  Wallet,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import type { Tournament, Game, Registration } from "@shared/schema";

/* ---------------- HELPER ---------------- */

function getIGNForGame(gameSlug: string, user: any) {
  if (!user) return "";

  switch (gameSlug) {
    case "bgmi":
      return user.bgmiIgn || "";
    case "free-fire":
      return user.freeFireIgn || "";
    case "cod-mobile":
      return user.codIgn || "";
    default:
      return "";
  }
}

/* ---------------- PAGE ---------------- */

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [ign, setIgn] = useState("");

  const { data: tournament, isLoading } = useQuery<Tournament>({
    queryKey: ["/api/tournaments", id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load tournament");
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

  const isRegistered = myRegistrations?.some(
    (r) => r.tournamentId === Number(id)
  );

  const game = games?.find((g) => g.id === tournament?.gameId);

  /* ---------------- JOIN CLICK ---------------- */

  function handleJoinClick() {
    if (!user || !game) return;

    const savedIgn = getIGNForGame(game.slug, user);

    if (!savedIgn) {
      toast({
        title: "Profile incomplete",
        description: `Please set ${game.name} in-game name in profile`,
        variant: "destructive",
      });
      return;
    }

    setIgn(savedIgn);
    setJoinDialogOpen(true);
  }

  /* ---------------- JOIN MUTATION ---------------- */

  const joinMutation = useMutation({
    mutationFn: async (inGameName: string) => {
      const res = await fetch(`/api/tournaments/${id}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inGameName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Join failed");
      return data;
    },

    onSuccess: async () => {
      // 🔥 AUTO SAVE IGN ON FIRST JOIN
      if (game && user) {
        let field: string | null = null;

        if (game.slug === "bgmi" && !user.bgmiIgn) field = "bgmiIgn";
        if (game.slug === "free-fire" && !user.freeFireIgn)
          field = "freeFireIgn";
        if (game.slug === "cod-mobile" && !user.codIgn) field = "codIgn";

        if (field) {
          const res = await fetch("/api/users/profile", {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ [field]: ign }),
          });

          const data = await res.json();
          if (data.user) updateUser(data.user);
        }
      }

      setJoinDialogOpen(false);
      setIgn("");

      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/registrations/my"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", id, "participants"],
      });

      toast({
        title: "Joined successfully",
        description: "You are registered for this tournament",
      });
    },

    onError: (err: Error) => {
      toast({
        title: "Join failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  /* ---------------- LOADING ---------------- */

  if (isLoading || !tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const isFull = tournament.filledSlots >= tournament.maxSlots;
  const canJoin =
    tournament.status === "upcoming" &&
    !isFull &&
    !isRegistered &&
    !!user;

  const slotPercentage =
    (tournament.filledSlots / tournament.maxSlots) * 100;

  /* ---------------- UI ---------------- */

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <button
        onClick={() => setLocation("/tournaments")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Tournaments
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tournament.title}</h1>
          <p className="text-sm text-muted-foreground">
            {game?.name}
          </p>
        </div>

        {isRegistered && (
          <Badge className="bg-chart-3/10 text-chart-3 gap-1">
            <CheckCircle className="w-3 h-3" /> Registered
          </Badge>
        )}

        {canJoin && (
          <Button onClick={handleJoinClick}>
            {tournament.entryFee > 0
              ? `Join ₹${(tournament.entryFee / 100).toFixed(0)}`
              : "Join Free"}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> Slots
            </span>
            <span>
              {tournament.filledSlots}/{tournament.maxSlots}
            </span>
          </div>
          <Progress value={slotPercentage} className="h-2" />

          {tournament.mapName && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4" />
              {tournament.mapName}
            </div>
          )}
        </CardContent>
      </Card>

      {/* JOIN DIALOG */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-primary" /> Join Tournament
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Label>In-Game Name</Label>
            <Input value={ign} disabled />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => joinMutation.mutate(ign)}
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? "Joining..." : "Confirm Join"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
