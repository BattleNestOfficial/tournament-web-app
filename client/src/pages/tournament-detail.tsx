import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Trophy, Users, Swords, Clock, MapPin, Shield, Wallet, ArrowLeft, CheckCircle, Star, ImageIcon } from "lucide-react";
import type { Tournament, Game, Registration, Result } from "@shared/schema";

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

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: tournament, isLoading } = useQuery<Tournament>({
    queryKey: ["/api/tournaments", id],
  });

  const { data: games } = useQuery<Game[]>({ queryKey: ["/api/games"] });
  const { data: myRegistrations } = useQuery<Registration[]>({
    queryKey: ["/api/registrations/my"],
    enabled: !!user,
  });
  const { data: results } = useQuery<Result[]>({
    queryKey: ["/api/tournaments", id, "results"],
  });

  const isRegistered = myRegistrations?.some((r) => r.tournamentId === Number(id));

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to join");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/registrations/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      if (data.user) updateUser(data.user);
      toast({ title: "Joined!", description: "You have been registered for this tournament" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to join", description: err.message, variant: "destructive" });
    },
  });

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
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Tournament not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/tournaments")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tournaments
        </Button>
      </div>
    );
  }

  const game = games?.find((g) => g.id === tournament.gameId);
  const slotPercentage = (tournament.filledSlots / tournament.maxSlots) * 100;
  const canJoin = tournament.status === "upcoming" && tournament.filledSlots < tournament.maxSlots && !isRegistered && !!user;
  const prizeDistribution = tournament.prizeDistribution as Record<string, number>[] | null;

  const statusColors: Record<string, string> = {
    upcoming: "bg-chart-2/10 text-chart-2",
    live: "bg-destructive/10 text-destructive",
    completed: "bg-muted text-muted-foreground",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <button onClick={() => setLocation("/tournaments")} className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="button-back-tournaments">
        <ArrowLeft className="w-4 h-4" /> Back to Tournaments
      </button>

      {(() => {
        const slug = game?.slug || "";
        const gradient = GAME_GRADIENTS[slug] || "from-primary/20 to-primary/40";
        const iconLetter = GAME_ICONS[slug] || (game?.name || "T").charAt(0).toUpperCase();
        return (
          <div className="relative h-48 sm:h-56 w-full rounded-md overflow-hidden">
            {tournament.imageUrl ? (
              <img src={tournament.imageUrl} alt={tournament.title} className="w-full h-full object-cover" data-testid="img-tournament-detail" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <span className="text-6xl font-bold text-foreground/20">{iconLetter}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        );
      })()}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={`text-xs ${statusColors[tournament.status] || ""}`}>
              {tournament.status === "live" && <span className="w-1.5 h-1.5 bg-destructive rounded-full mr-1 animate-pulse" />}
              {tournament.status}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">{tournament.matchType}</Badge>
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-tournament-title">{tournament.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{game?.name || "Unknown Game"}</p>
        </div>
        <div className="flex gap-2">
          {isRegistered && (
            <Badge className="bg-chart-3/10 text-chart-3 gap-1">
              <CheckCircle className="w-3 h-3" /> Registered
            </Badge>
          )}
          {canJoin && (
            <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} data-testid="button-join-tournament">
              {joinMutation.isPending ? "Joining..." : tournament.entryFee > 0 ? `Join \u20B9${(tournament.entryFee / 100).toFixed(0)}` : "Join Free"}
            </Button>
          )}
          {!user && tournament.status === "upcoming" && (
            <Button onClick={() => setLocation("/auth")} data-testid="button-login-to-join">
              Login to Join
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Prize Pool</p>
                <p className="text-lg font-bold text-chart-4" data-testid="text-prize-pool">
                  {"\u20B9"}{typeof tournament.prizePool === "number" ? (tournament.prizePool / 100).toFixed(0) : "0"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Entry Fee</p>
                <p className="text-lg font-bold" data-testid="text-entry-fee">
                  {typeof tournament.entryFee === "number" && tournament.entryFee > 0 ? `\u20B9${(tournament.entryFee / 100).toFixed(0)}` : "Free"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Match Type</p>
                <p className="text-lg font-bold capitalize">{tournament.matchType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Start Time</p>
                <p className="text-sm font-semibold">
                  {tournament.startTime ? new Date(tournament.startTime).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "TBD"}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Slots
                </span>
                <span className="font-medium">{tournament.filledSlots ?? 0}/{tournament.maxSlots ?? 0}</span>
              </div>
              <Progress value={slotPercentage} className="h-2" />
            </div>

            {tournament.mapName && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>Map: {tournament.mapName}</span>
              </div>
            )}

            {isRegistered && tournament.status === "live" && tournament.roomId && (
              <Card>
                <CardContent className="p-4 bg-primary/5 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Room Details</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Room ID</p>
                      <p className="font-mono font-semibold" data-testid="text-room-id">{tournament.roomId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Password</p>
                      <p className="font-mono font-semibold" data-testid="text-room-password">{tournament.roomPassword}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {tournament.rules && (
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Rules
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted p-3 rounded-md">
                  {tournament.rules}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {prizeDistribution && prizeDistribution.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="w-4 h-4 text-chart-4" /> Prize Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 px-4 space-y-2">
                {prizeDistribution.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground">#{p.position || i + 1}</span>
                    <span className="font-semibold">{"\u20B9"}{(p.prize / 100).toFixed(0)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {results && results.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-chart-4" /> Results
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 px-4 space-y-2">
                {results.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">#{r.position}</span>
                      <span>Player #{r.userId}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{r.kills} kills</span>
                      <span className="font-semibold text-chart-3">{"\u20B9"}{(r.prize / 100).toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
