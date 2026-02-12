import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, Swords, Clock, Gamepad2, Search, Filter, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
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

export default function TournamentsPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialGame = params.get("game") || "all";
  const initialStatus = params.get("status") || "all";

  const [gameFilter, setGameFilter] = useState(initialGame);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tournaments, isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  const { data: games } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const getGameName = (gameId: number) => games?.find((g) => g.id === gameId)?.name || "Unknown";
  const getGameSlug = (gameId: number) => games?.find((g) => g.id === gameId)?.slug || "";

  const filtered = tournaments?.filter((t) => {
    if (gameFilter !== "all" && t.gameId !== Number(gameFilter)) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (typeFilter !== "all" && t.matchType !== typeFilter) return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  const statusColors: Record<string, string> = {
    upcoming: "bg-chart-2/10 text-chart-2",
    live: "bg-destructive/10 text-destructive",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <p className="text-sm text-muted-foreground mt-1">Find and join competitive gaming tournaments</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tournaments..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-tournaments"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={gameFilter} onValueChange={setGameFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-game-filter">
                  <Gamepad2 className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue placeholder="Game" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Games</SelectItem>
                  {games?.filter((g) => g.enabled).map((g) => (
                    <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[120px]" data-testid="select-type-filter">
                  <Swords className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="solo">Solo</SelectItem>
                  <SelectItem value="duo">Duo</SelectItem>
                  <SelectItem value="squad">Squad</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-8 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const slug = getGameSlug(t.gameId);
            const gradient = GAME_GRADIENTS[slug] || "from-primary/20 to-primary/40";
            const iconLetter = GAME_ICONS[slug] || getGameName(t.gameId).charAt(0).toUpperCase();
            return (
            <Link key={t.id} href={`/tournaments/${t.id}`}>
              <Card className="hover-elevate cursor-pointer h-full overflow-hidden" data-testid={`card-tournament-${t.id}`}>
                <div className="relative h-32 w-full overflow-hidden">
                  {t.imageUrl ? (
                    <img src={t.imageUrl} alt={t.title} className="w-full h-full object-cover" data-testid={`img-tournament-${t.id}`} />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                      <span className="text-3xl font-bold text-foreground/30">{iconLetter}</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className={`text-[10px] shrink-0 bg-background/80 backdrop-blur-sm ${statusColors[t.status] || ""}`}>
                      {t.status === "live" && <span className="w-1.5 h-1.5 bg-destructive rounded-full mr-1 animate-pulse" />}
                      {t.status}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{getGameName(t.gameId)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Trophy className="w-3 h-3 text-chart-4" />
                      <span>{"\u20B9"}{(t.prizePool / 100).toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-3 h-3 text-chart-2" />
                      <span>{t.filledSlots}/{t.maxSlots}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Swords className="w-3 h-3 text-chart-1" />
                      <span className="capitalize">{t.matchType}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(t.startTime).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="text-xs font-medium">
                      {t.entryFee > 0 ? `Entry: \u20B9${(t.entryFee / 100).toFixed(0)}` : "Free Entry"}
                    </span>
                    {t.filledSlots >= t.maxSlots ? (
                      <Badge variant="outline" className="text-[10px] text-destructive">Full</Badge>
                    ) : t.status === "upcoming" ? (
                      <span className="text-xs text-primary font-medium">Join Now</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-1">No tournaments found</h3>
            <p className="text-sm text-muted-foreground">Try changing your filters or check back later.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
