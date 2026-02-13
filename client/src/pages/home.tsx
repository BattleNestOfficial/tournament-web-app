/* =====================================================================================
   BATTLE NEST – GOD TIER ESPORTS HOME
   CYBERPUNK / EPIC GAMES / FORTNITE INSPIRED
   PURE FRONTEND – FULL MOTION – FUTURISTIC
   ===================================================================================== */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Users,
  Wallet,
  Gamepad2,
  Flame,
  ArrowRight,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import type { Tournament, Game } from "@shared/schema";

/* =====================================================================================
   MOTION PRESETS
   ===================================================================================== */

const floatSlow = {
  animate: {
    y: [0, -12, 0],
  },
  transition: {
    duration: 6,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

const glowPulse = {
  animate: {
    opacity: [0.4, 0.8, 0.4],
  },
  transition: {
    duration: 3,
    repeat: Infinity,
  },
};

/* =====================================================================================
   MAIN PAGE
   ===================================================================================== */

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [hovered, setHovered] = useState<number | null>(null);

  const { data: tournaments, isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  const { data: games } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const upcoming = tournaments?.filter(t => t.status === "upcoming") || [];
  const live = tournaments?.filter(t => t.status === "live") || [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070d] text-white">

      {/* =================== MOVING GRADIENT BACKGROUND =================== */}
      <motion.div
        className="absolute inset-0 -z-20"
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{ duration: 30, repeat: Infinity }}
        style={{
          background:
            "linear-gradient(120deg,#4f46e5,#9333ea,#ec4899,#4f46e5)",
          backgroundSize: "400% 400%",
        }}
      />

      {/* =================== NOISE OVERLAY =================== */}
      <div className="absolute inset-0 -z-10 bg-[url('/noise.png')] opacity-[0.03]" />

      {/* =================== HERO =================== */}
      <section className="relative px-6 pt-28 pb-32 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="grid md:grid-cols-2 gap-16 items-center"
        >
          {/* LEFT */}
          <div className="space-y-8">
            <motion.h1
              className="text-6xl md:text-7xl font-extrabold leading-tight"
              initial={{ letterSpacing: "0.2em" }}
              animate={{ letterSpacing: "0em" }}
              transition={{ duration: 1.2 }}
            >
              ENTER THE
              <span className="block bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                ARENA
              </span>
            </motion.h1>

            <p className="text-gray-300 text-lg max-w-xl">
              Elite esports tournaments. Real rewards. No mercy.
            </p>

            <div className="flex gap-6">
              <motion.div whileHover={{ scale: 1.08 }}>
                <Button
                  size="lg"
                  className="relative overflow-hidden bg-gradient-to-r from-pink-600 to-purple-700 shadow-[0_0_40px_#9333ea]"
                  onClick={() => setLocation("/tournaments")}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Join Battles <ArrowRight />
                  </span>
                  <motion.span
                    className="absolute inset-0 bg-white/20"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.6 }}
                  />
                </Button>
              </motion.div>

              <Button
                variant="outline"
                size="lg"
                className="border-white/30"
              >
                How It Works
              </Button>
            </div>
          </div>

          {/* RIGHT */}
          <motion.div {...floatSlow} className="relative">
            <div className="aspect-square rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-[0_0_80px_#6366f1]">
              <Gamepad2 className="w-28 h-28 text-purple-400" />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* =================== LIVE =================== */}
      {live.length > 0 && (
        <Section title="🔥 LIVE BATTLES">
          <TournamentGrid
            tournaments={live}
            games={games}
            hovered={hovered}
            setHovered={setHovered}
            onOpen={id => setLocation(`/tournaments/${id}`)}
          />
        </Section>
      )}

      {/* =================== UPCOMING =================== */}
      <Section title="⚡ UPCOMING TOURNAMENTS">
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <TournamentGrid
            tournaments={upcoming}
            games={games}
            hovered={hovered}
            setHovered={setHovered}
            onOpen={id => setLocation(`/tournaments/${id}`)}
          />
        )}
      </Section>
    </div>
  );
}

/* =====================================================================================
   SECTION
   ===================================================================================== */

function Section({ title, children }: any) {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <h2 className="text-3xl font-bold mb-10 tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* =====================================================================================
   TOURNAMENT CARD GRID
   ===================================================================================== */

function TournamentGrid({
  tournaments,
  games,
  hovered,
  setHovered,
  onOpen,
}: any) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
      {tournaments.map((t: Tournament) => {
        const game = games?.find((g: Game) => g.id === t.gameId);
        const progress = (t.filledSlots / t.maxSlots) * 100;

        return (
          <motion.div
            key={t.id}
            onMouseEnter={() => setHovered(t.id)}
            onMouseLeave={() => setHovered(null)}
            whileHover={{ scale: 1.05 }}
            className="relative group"
          >
            {/* GLOW */}
            <motion.div
              className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 blur-xl"
              variants={glowPulse}
              animate={hovered === t.id ? "animate" : undefined}
            />

            {/* CARD */}
            <div
              onClick={() => onOpen(t.id)}
              className="relative z-10 rounded-3xl bg-black/70 backdrop-blur-xl border border-white/10 p-6 space-y-6 cursor-pointer"
            >
              {/* IMAGE */}
              <div className="h-44 rounded-xl bg-gradient-to-br from-black to-gray-900 flex items-center justify-center relative overflow-hidden">
                <Flame className="w-14 h-14 text-white/30" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>

              <div className="flex justify-between">
                <Badge>{game?.name}</Badge>
                <Badge variant="outline">
                  {t.matchType.toUpperCase()}
                </Badge>
              </div>

              <h3 className="text-xl font-semibold">{t.title}</h3>

              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex justify-between">
                  <span><Users className="inline w-4 h-4 mr-1" /> {t.filledSlots}/{t.maxSlots}</span>
                  <span><Wallet className="inline w-4 h-4 mr-1" /> ₹{(t.prizePool / 100).toFixed(0)}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                View Arena
              </Button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* =====================================================================================
   SKELETON
   ===================================================================================== */

function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-96 rounded-3xl" />
      ))}
    </div>
  );
}
