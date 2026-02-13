/* =====================================================================================
   BATTLE NEST – HOME PAGE (FORTNITE STYLE)
   FULL ADVANCED VERSION – PRODUCTION SAFE
   ===================================================================================== */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Trophy,
  Users,
  Wallet,
  Clock,
  Flame,
  ArrowRight,
} from "lucide-react";

import type { Tournament, Game } from "@shared/schema";

/* =====================================================================================
   HELPERS
   ===================================================================================== */

function formatMoney(amount: number) {
  if (amount === 0) return "FREE";
  return `₹${(amount / 100).toFixed(0)}`;
}

function getStatus(t: Tournament) {
  if (t.status === "live") return "LIVE";
  if (t.status === "completed") return "COMPLETED";
  return "UPCOMING";
}

function getStatusColor(status: string) {
  switch (status) {
    case "LIVE":
      return "bg-green-500/20 text-green-400 border-green-500";
    case "COMPLETED":
      return "bg-gray-500/20 text-gray-400 border-gray-500";
    default:
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500";
  }
}

function countdown(target: Date) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return "00:00:00";

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0"
  )}:${String(s).padStart(2, "0")}`;
}

/* =====================================================================================
   MAIN COMPONENT
   ===================================================================================== */

export default function HomePage() {
  const [, setLocation] = useLocation();

  /* -------------------------------- QUERIES -------------------------------- */

  const tournamentsQuery = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  const gamesQuery = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const tournaments = tournamentsQuery.data || [];
  const games = gamesQuery.data || [];

  /* -------------------------------- DERIVED -------------------------------- */

  const featured = useMemo(
    () => tournaments.filter((t) => t.status !== "completed").slice(0, 6),
    [tournaments]
  );

  const upcoming = useMemo(
    () => tournaments.filter((t) => t.status === "upcoming"),
    [tournaments]
  );

  const totalPlayers = tournaments.reduce(
    (acc, t) => acc + t.filledSlots,
    0
  );

  /* -------------------------------- LOADING -------------------------------- */

  if (tournamentsQuery.isLoading || gamesQuery.isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  /* =====================================================================================
     RENDER
     ===================================================================================== */

  return (
    <div className="space-y-10 px-6 py-6">

      {/* ===================== HERO ===================== */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 p-8">

        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))]" />

        <div className="relative z-10 grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h1 className="text-4xl font-extrabold text-white mb-2">
              COMPETE & WIN
            </h1>
            <p className="text-white/70 max-w-md">
              Join high-stakes esports tournaments. Play solo, duo or squad.
              Win real cash prizes.
            </p>

            <div className="flex gap-6 mt-6 text-white">
              <div>
                <p className="text-xl font-bold">{tournaments.length}</p>
                <p className="text-xs opacity-70">Tournaments</p>
              </div>
              <div>
                <p className="text-xl font-bold">{totalPlayers}</p>
                <p className="text-xs opacity-70">Players</p>
              </div>
              <div>
                <p className="text-xl font-bold">
                  {tournaments.filter(t => t.status === "live").length}
                </p>
                <p className="text-xs opacity-70">Live Now</p>
              </div>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="h-48 rounded-lg bg-black/30 flex items-center justify-center text-white/50">
              GAME ARTWORK
            </div>
          </div>
        </div>
      </div>

      {/* ===================== FEATURED ===================== */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Featured Tournaments
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((t) => {
            const game = games.find((g) => g.id === t.gameId);
            const status = getStatus(t);

            return (
              <Card
                key={t.id}
                className="group cursor-pointer hover:scale-[1.02] transition"
                onClick={() => setLocation(`/tournaments/${t.id}`)}
              >
                <CardContent className="p-4 space-y-3">

                  {/* IMAGE */}
                  <div className="h-32 rounded-md bg-muted flex items-center justify-center">
                    {game?.name || "GAME"}
                  </div>

                  {/* STATUS */}
                  <Badge
                    className={`w-fit ${getStatusColor(status)}`}
                    variant="outline"
                  >
                    {status}
                  </Badge>

                  {/* TITLE */}
                  <h3 className="font-semibold line-clamp-2">
                    {t.title}
                  </h3>

                  {/* META */}
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{t.matchType.toUpperCase()}</span>
                    <span>{formatMoney(t.entryFee)}</span>
                  </div>

                  {/* PROGRESS */}
                  <Progress
                    value={(t.filledSlots / t.maxSlots) * 100}
                  />

                  <div className="flex justify-between text-xs">
                    <span>
                      <Users className="inline w-3 h-3 mr-1" />
                      {t.filledSlots}/{t.maxSlots}
                    </span>
                    <span>
                      <Trophy className="inline w-3 h-3 mr-1" />
                      ₹{(t.prizePool / 100).toFixed(0)}
                    </span>
                  </div>

                  {/* TIMER */}
                  {status !== "COMPLETED" && (
                    <div className="text-xs flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {countdown(t.startTime)}
                    </div>
                  )}

                  {/* BUTTON */}
                  <Button className="w-full">
                    Join Tournament
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ===================== UPCOMING ===================== */}
      <section>
        <h2 className="text-xl font-bold mb-4">
          Upcoming Tournaments
        </h2>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {upcoming.map((t) => (
            <div
              key={t.id}
              className="min-w-[260px] bg-muted rounded-lg p-4 opacity-80"
            >
              <h3 className="font-medium">{t.title}</h3>
              <p className="text-xs text-muted-foreground">
                Starts at {new Date(t.startTime).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
