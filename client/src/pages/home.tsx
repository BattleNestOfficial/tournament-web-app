/* =====================================================================================
   BATTLE NEST – ESPORTS HOME PAGE
   AAA / EPIC GAMES STYLE – FUTURISTIC – FULLY ANIMATED
   SAFE TO PASTE AS home.tsx
   ===================================================================================== */

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

import {
  Trophy,
  Users,
  Wallet,
  Clock,
  Flame,
  Gamepad2,
  ArrowRight,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import { useAuth } from "@/lib/auth";
import type { Tournament, Game } from "@shared/schema";

/* =====================================================================================
   CONSTANTS & STYLES
   ===================================================================================== */

const GAME_COLORS: Record<string, string> = {
  bgmi: "from-amber-500 to-orange-600",
  "free-fire": "from-red-500 to-yellow-600",
  "cod-mobile": "from-green-500 to-emerald-600",
  valorant: "from-pink-500 to-red-600",
  cs2: "from-blue-500 to-indigo-600",
};

const CARD_GLOW =
  "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:opacity-0 hover:before:opacity-100 before:transition";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

/* =====================================================================================
   MAIN COMPONENT
   ===================================================================================== */

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  /* -------------------------------- FETCH DATA -------------------------------- */

  const { data: tournaments, isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  const { data: games } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  /* -------------------------------- GROUP DATA -------------------------------- */

  const upcoming = tournaments?.filter((t) => t.status === "upcoming") || [];
  const live = tournaments?.filter((t) => t.status === "live") || [];
  const completed = tournaments?.filter((t) => t.status === "completed") || [];

  /* =====================================================================================
     RENDER
     ===================================================================================== */

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#070B14] via-[#0B1220] to-black text-white overflow-hidden">

      {/* ============================ HERO SECTION ============================ */}

      <section className="relative px-6 py-24 max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.8 }}
          className="grid md:grid-cols-2 gap-10 items-center"
        >
          {/* LEFT */}
          <div className="space-y-6">
            <Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30">
              ⚡ Competitive Esports Platform
            </Badge>

            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight">
              Compete.
              <span className="block bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                Win Big.
              </span>
              Dominate.
            </h1>

            <p className="text-gray-400 text-lg max-w-xl">
              Join elite tournaments across BGMI, Free Fire, COD Mobile and more.
              Skill decides everything.
            </p>

            <div className="flex gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
                onClick={() => setLocation("/tournaments")}
              >
                Explore Tournaments <ArrowRight className="ml-2 w-4 h-4" />
              </Button>

              {!user && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setLocation("/auth")}
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>

          {/* RIGHT IMAGE */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 6 }}
            className="relative"
          >
            <div className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-purple-800/40 to-pink-800/20 border border-white/10 backdrop-blur-xl flex items-center justify-center">
              <Gamepad2 className="w-24 h-24 text-purple-400 opacity-80" />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ============================ LIVE TOURNAMENTS ============================ */}

      {live.length > 0 && (
        <Section title="🔥 Live Tournaments" accent="red">
          <TournamentGrid
            tournaments={live}
            games={games}
            onOpen={(id) => setLocation(`/tournaments/${id}`)}
          />
        </Section>
      )}

      {/* ============================ UPCOMING ============================ */}

      <Section title="⏳ Upcoming Battles" accent="purple">
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <TournamentGrid
            tournaments={upcoming}
            games={games}
            onOpen={(id) => setLocation(`/tournaments/${id}`)}
          />
        )}
      </Section>

      {/* ============================ COMPLETED ============================ */}

      {completed.length > 0 && (
        <Section title="🏆 Completed Tournaments" accent="gold">
          <TournamentGrid
            tournaments={completed}
            games={games}
            completed
            onOpen={(id) => setLocation(`/tournaments/${id}`)}
          />
        </Section>
      )}
    </div>
  );
}

/* =====================================================================================
   SECTION WRAPPER
   ===================================================================================== */

function Section({
  title,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      {children}
    </section>
  );
}

/* =====================================================================================
   TOURNAMENT GRID
   ===================================================================================== */

function TournamentGrid({
  tournaments,
  games,
  completed,
  onOpen,
}: any) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {tournaments.map((t: Tournament) => {
        const game = games?.find((g: Game) => g.id === t.gameId);
        const progress = (t.filledSlots / t.maxSlots) * 100;

        return (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            viewport={{ once: true }}
          >
            <Card
              onClick={() => onOpen(t.id)}
              className={`relative cursor-pointer overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl hover:scale-[1.02] transition ${CARD_GLOW}`}
            >
              {/* IMAGE PLACEHOLDER */}
              <div className="h-40 bg-gradient-to-br from-black to-gray-900 flex items-center justify-center">
                <Trophy className="w-12 h-12 text-white/40" />
              </div>

              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between">
                  <Badge variant="outline">{game?.name}</Badge>
                  <Badge className="bg-purple-600/20 text-purple-300">
                    {t.matchType.toUpperCase()}
                  </Badge>
                </div>

                <h3 className="font-semibold text-lg line-clamp-2">
                  {t.title}
                </h3>

                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>
                      <Users className="inline w-4 h-4 mr-1" />
                      {t.filledSlots}/{t.maxSlots}
                    </span>
                    <span>
                      <Wallet className="inline w-4 h-4 mr-1" />
                      ₹{(t.prizePool / 100).toFixed(0)}
                    </span>
                  </div>

                  {!completed && (
                    <Progress value={progress} className="h-2" />
                  )}
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  View Details
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

/* =====================================================================================
   SKELETON GRID
   ===================================================================================== */

function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-72 rounded-xl" />
      ))}
    </div>
  );
}
