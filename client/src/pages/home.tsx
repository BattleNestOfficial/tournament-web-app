import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { Trophy, Users, Gamepad2, ArrowRight, Swords, Clock, Zap, Star, ImageIcon } from "lucide-react";
import type { Tournament, Game } from "@shared/schema";

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

export default function HomePage() {
  const { user } = useAuth();

  const { data: tournaments, isLoading: tournamentsLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  const { data: games, isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const upcomingTournaments = tournaments?.filter((t) => t.status === "upcoming").slice(0, 6) || [];
  const liveTournaments = tournaments?.filter((t) => t.status === "live").slice(0, 4) || [];

  const getGameName = (gameId: number) => games?.find((g) => g.id === gameId)?.name || "Unknown";
  const getGameSlug = (gameId: number) => games?.find((g) => g.id === gameId)?.slug || "";

  const stats = [
    { label: "Active Players", value: "500+", icon: Users, color: "text-chart-2" },
    { label: "Tournaments", value: tournaments?.length?.toString() || "0", icon: Trophy, color: "text-chart-4" },
    { label: "Games", value: games?.filter((g) => g.enabled).length?.toString() || "0", icon: Gamepad2, color: "text-chart-3" },
    { label: "Prize Pool", value: `\u20B9${((tournaments?.reduce((s, t) => s + t.prizePool, 0) || 0) / 100).toFixed(0)}`, icon: Star, color: "text-chart-1" },
  ];

  return (
    <div className="space-y-8 pb-8">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-chart-2/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-xs font-medium mb-4">
              <Zap className="w-3 h-3" />
              Live tournaments happening now
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
              Compete. Win.{" "}
              <span className="text-primary">Dominate.</span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg mb-6 max-w-lg">
              Join BGMI, Free Fire, Valorant & more tournaments. Compete with the best gamers and win real prizes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/tournaments">
                <Button className="gap-2" data-testid="button-browse-tournaments">
                  Browse Tournaments <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              {!user && (
                <Link href="/auth">
                  <Button variant="outline" className="gap-2" data-testid="button-signup-hero">
                    <Swords className="w-4 h-4" /> Join Now
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 bg-muted rounded-md ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {liveTournaments.length > 0 && (
        <section className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              Live Tournaments
            </h2>
            <Link href="/tournaments?status=live">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">View all <ArrowRight className="w-3 h-3" /></Button>
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {liveTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} gameName={getGameName(t.gameId)} gameSlug={getGameSlug(t.gameId)} />
            ))}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold">Upcoming Tournaments</h2>
          <Link href="/tournaments">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">View all <ArrowRight className="w-3 h-3" /></Button>
          </Link>
        </div>
        {tournamentsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-8 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : upcomingTournaments.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} gameName={getGameName(t.gameId)} gameSlug={getGameSlug(t.gameId)} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No upcoming tournaments right now. Check back soon!</p>
            </CardContent>
          </Card>
        )}
      </section>

      {!gamesLoading && games && games.length > 0 && (
        <section className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg font-bold mb-4">Supported Games</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {games.filter((g) => g.enabled).map((game) => (
              <Link key={game.id} href={`/tournaments?game=${game.id}`}>
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium truncate" data-testid={`text-game-${game.slug}`}>{game.name}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TournamentCard({ tournament, gameName, gameSlug }: { tournament: Tournament; gameName: string; gameSlug?: string }) {
  const statusColors: Record<string, string> = {
    upcoming: "bg-chart-2/10 text-chart-2",
    live: "bg-destructive/10 text-destructive",
    completed: "bg-muted text-muted-foreground",
  };

  const gradient = GAME_GRADIENTS[gameSlug || ""] || "from-primary/20 to-primary/40";
  const iconLetter = GAME_ICONS[gameSlug || ""] || gameName.charAt(0).toUpperCase();

  return (
    <Link href={`/tournaments/${tournament.id}`}>
      <Card className="hover-elevate cursor-pointer h-full overflow-hidden" data-testid={`card-tournament-${tournament.id}`}>
        <div className="relative h-32 w-full overflow-hidden">
          {tournament.imageUrl ? (
            <img
              src={tournament.imageUrl}
              alt={tournament.title}
              className="w-full h-full object-cover"
              data-testid={`img-tournament-${tournament.id}`}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-3xl font-bold text-foreground/30">{iconLetter}</span>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className={`text-[10px] shrink-0 bg-background/80 backdrop-blur-sm ${statusColors[tournament.status] || ""}`}>
              {tournament.status === "live" && <span className="w-1.5 h-1.5 bg-destructive rounded-full mr-1 animate-pulse" />}
              {tournament.status}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{tournament.title}</p>
            <p className="text-xs text-muted-foreground">{gameName}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Trophy className="w-3 h-3 text-chart-4" />
              <span>{"\u20B9"}{(tournament.prizePool / 100).toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-3 h-3 text-chart-2" />
              <span>{tournament.filledSlots}/{tournament.maxSlots}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Swords className="w-3 h-3 text-chart-1" />
              <span className="capitalize">{tournament.matchType}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{new Date(tournament.startTime).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-xs font-medium">
              {tournament.entryFee > 0 ? `Entry: \u20B9${(tournament.entryFee / 100).toFixed(0)}` : "Free Entry"}
            </span>
            {tournament.filledSlots >= tournament.maxSlots ? (
              <Badge variant="outline" className="text-[10px] text-destructive">Full</Badge>
            ) : (
              <span className="text-xs text-primary font-medium">Join Now</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
