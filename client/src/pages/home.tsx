/* =====================================================================================
   BATTLE NEST – HOME PAGE
   AAA ESPORTS UI – FUTURISTIC – ANIMATED – STABLE
   ===================================================================================== */

import React, { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

/* -------------------------------- UI -------------------------------- */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/* -------------------------------- ICONS -------------------------------- */

import {
  Trophy,
  Users,
  Wallet,
  Swords,
  Clock,
  Flame,
  Crown,
  Sparkles,
  ArrowRight,
} from "lucide-react";

/* -------------------------------- TYPES -------------------------------- */

import type { Tournament, Game } from "@shared/schema";

/* =====================================================================================
   ANIMATIONS
   ===================================================================================== */

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const glowPulse = {
  animate: {
    boxShadow: [
      "0 0 10px rgba(99,102,241,0.2)",
      "0 0 30px rgba(99,102,241,0.6)",
      "0 0 10px rgba(99,102,241,0.2)",
    ],
  },
};

/* =====================================================================================
   HELPERS
   ===================================================================================== */

function formatMoney(v: number) {
  return `₹${(v / 100).toFixed(0)}`;
}

function matchTypeColor(type: string) {
  switch (type) {
    case "solo":
      return "bg-emerald-500/10 text-emerald-400";
    case "duo":
      return "bg-indigo-500/10 text-indigo-400";
    case "squad":
      return "bg-rose-500/10 text-rose-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/* =====================================================================================
   CHAMPION CARD
   ===================================================================================== */

function ChampionCard({
  position,
  prize,
  name,
  glow,
  crown,
}: {
  position: string;
  prize: string;
  name: string;
  glow: string;
  crown?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`relative rounded-2xl border border-white/10 bg-gradient-to-br ${glow} to-black/40 p-6 text-center backdrop-blur`}
    >
      {crown && <Crown className="mx-auto mb-2 text-yellow-400" />}
      <div className="text-sm text-muted-foreground">{position}</div>
      <div className="text-2xl font-bold mt-1">{name}</div>
      <div className="text-primary mt-2">{prize}</div>
    </motion.div>
  );
}

/* =====================================================================================
   PARTICLE BACKGROUND
   ===================================================================================== */

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 80 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2 + 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-20 pointer-events-none"
    />
  );
}

/* =====================================================================================
   MAIN HOME PAGE
   ===================================================================================== */

export default function HomePage() {
  const [, setLocation] = useLocation();

  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const featured = useMemo(
    () => tournaments.filter((t) => t.status === "upcoming").slice(0, 6),
    [tournaments]
  );

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <ParticleBackground />

      {/* HERO */}
      <section className="px-6 py-28 text-center max-w-7xl mx-auto">
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Badge className="mb-4 bg-primary/10 text-primary">
            India’s Next-Gen Esports Platform
          </Badge>

          <h1 className="text-6xl font-extrabold">
            COMPETE. <span className="text-primary">DOMINATE.</span> WIN BIG.
          </h1>

          <p className="mt-6 text-muted-foreground max-w-2xl mx-auto">
            High-stakes tournaments. Real money. Real champions.
          </p>

          <div className="mt-10 flex justify-center gap-4">
            <Button size="lg" onClick={() => setLocation("/tournaments")}>
              Explore Tournaments <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* FEATURED */}
      <section className="px-6 pb-32 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 flex gap-2">
          <Flame className="text-orange-400" /> Featured Matches
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {featured.map((t, i) => {
              const game = games.find((g) => g.id === t.gameId);
              const progress = (t.filledSlots / t.maxSlots) * 100;

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <motion.div variants={glowPulse} animate="animate">
                    <Card
                      onClick={() => setLocation(`/tournaments/${t.id}`)}
                      className="cursor-pointer bg-black/60 border-white/10 hover:border-primary/40 transition"
                    >
                      <CardContent className="p-5 space-y-4">
                        <Badge className={matchTypeColor(t.matchType)}>
                          {t.matchType.toUpperCase()}
                        </Badge>

                        <h3 className="font-bold">{t.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {game?.name}
                        </p>

                        <div className="grid grid-cols-3 text-xs">
                          <span className="flex gap-1">
                            <Trophy className="w-3 h-3 text-yellow-400" />
                            {formatMoney(t.prizePool)}
                          </span>
                          <span className="flex gap-1">
                            <Wallet className="w-3 h-3 text-green-400" />
                            {t.entryFee ? formatMoney(t.entryFee) : "FREE"}
                          </span>
                          <span className="flex gap-1">
                            <Users className="w-3 h-3 text-blue-400" />
                            {t.filledSlots}/{t.maxSlots}
                          </span>
                        </div>

                        <Progress value={progress} />

                        <div className="text-xs text-muted-foreground flex gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(t.startTime).toLocaleString("en-IN")}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {/* CHAMPIONS */}
      <section className="px-6 pb-32 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-10 flex gap-2">
          <Crown className="text-yellow-400" /> Recent Champions
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          <ChampionCard position="2nd" name="ShadowX" prize="₹15,000" glow="from-slate-400/20" />
          <ChampionCard position="1st" name="NightFury" prize="₹30,000" glow="from-yellow-400/30" crown />
          <ChampionCard position="3rd" name="VenomOP" prize="₹5,000" glow="from-orange-400/20" />
        </div>
      </section>
    </div>
  );
}
