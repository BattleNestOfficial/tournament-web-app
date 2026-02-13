/* =====================================================================================
   BATTLE NEST – HOME PAGE (PART 1 / 2)
   AAA ESPORTS UI – FUTURISTIC – ANIMATED – PRODUCTION SAFE
   ===================================================================================== */

import { useEffect, useMemo } from "react";
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
   ANIMATION PRESETS
   ===================================================================================== */

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const glowPulse = {
  initial: { boxShadow: "0 0 0 rgba(255,255,255,0)" },
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
   MAIN COMPONENT
   ===================================================================================== */

export default function HomePage() {
  const [, setLocation] = useLocation();

  /* -------------------------------- DATA -------------------------------- */

  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  /* -------------------------------- SORTING -------------------------------- */

  const featured = useMemo(
    () =>
      tournaments
        .filter((t) => t.status === "upcoming")
        .slice(0, 6),
    [tournaments]
  );

  /* =====================================================================================
     HERO SECTION
     ===================================================================================== */

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">

      {/* ------------------ BACKGROUND FX ------------------ */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1e1b4b,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,#7c2d12,transparent_70%)]" />
        <div className="absolute inset-0 bg-grid-white/[0.02]" />
      </div>

      {/* ------------------ HERO ------------------ */}
      <section className="relative px-6 py-28 text-center max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.8 }}
        >
          <Badge className="mb-4 px-4 py-1 text-sm bg-primary/10 text-primary">
            🔥 India’s Next-Gen Esports Platform
          </Badge>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            COMPETE.
            <span className="block bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
              DOMINATE.
            </span>
            WIN BIG.
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Join high-stakes tournaments, battle top players, and earn real
            rewards in the most advanced esports arena.
          </p>

          <div className="mt-10 flex justify-center gap-4">
            <Button size="lg" onClick={() => setLocation("/tournaments")}>
              Explore Tournaments <ArrowRight className="ml-2 w-4 h-4" />
            </Button>

            <Button size="lg" variant="outline">
              How It Works
            </Button>
          </div>
        </motion.div>
      </section>

      {/* =================================================================================
         FEATURED TOURNAMENTS
         ================================================================================= */}

      <section className="px-6 pb-32 max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-10"
        >
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Flame className="text-orange-400" /> Featured Matches
          </h2>

          <Button variant="ghost" onClick={() => setLocation("/tournaments")}>
            View All
          </Button>
        </motion.div>

        {/* ---------------- GRID ---------------- */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {featured.map((tournament, i) => {
              const game = games.find((g) => g.id === tournament.gameId);
              const progress =
                (tournament.filledSlots / tournament.maxSlots) * 100;

              return (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <motion.div
                    variants={glowPulse}
                    initial="initial"
                    animate="animate"
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Card
                      onClick={() =>
                        setLocation(`/tournaments/${tournament.id}`)
                      }
                      className="group relative overflow-hidden cursor-pointer border border-white/10 bg-gradient-to-br from-black/60 to-black/30 backdrop-blur-xl hover:border-primary/50 transition-all"
                    >
                      {/* IMAGE */}
                      <div className="relative h-44 overflow-hidden">
                        {tournament.imageUrl ? (
                          <img
                            src={tournament.imageUrl}
                            alt={tournament.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-fuchsia-500/20">
                            <Sparkles className="w-10 h-10 opacity-50" />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

                        <Badge
                          className={`absolute top-3 left-3 ${matchTypeColor(
                            tournament.matchType
                          )}`}
                        >
                          {tournament.matchType.toUpperCase()}
                        </Badge>
                      </div>

                      {/* CONTENT */}
                      <CardContent className="p-5 space-y-4">
                        <div>
                          <h3 className="font-bold text-lg leading-tight">
                            {tournament.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {game?.name || "Unknown Game"}
                          </p>
                        </div>

                        {/* STATS */}
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-yellow-400" />
                            {formatMoney(tournament.prizePool)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Wallet className="w-3 h-3 text-green-400" />
                            {tournament.entryFee
                              ? formatMoney(tournament.entryFee)
                              : "FREE"}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-blue-400" />
                            {tournament.filledSlots}/{tournament.maxSlots}
                          </div>
                        </div>

                        {/* PROGRESS */}
                        <Progress value={progress} className="h-2" />

                        {/* FOOTER */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(
                              tournament.startTime
                            ).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          <span className="flex items-center gap-1 text-primary">
                            Join Now <ArrowRight className="w-3 h-3" />
                          </span>
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
    </div>
  );
}
      {/* =================================================================================
          LIVE MARQUEE – ANNOUNCEMENTS
      ================================================================================= */}
      <section className="relative overflow-hidden border-y border-white/10 bg-black/40 backdrop-blur">
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: "-100%" }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
          className="whitespace-nowrap py-3 text-sm font-medium text-primary"
        >
          🏆 BGMI PRO LEAGUE LIVE • 💰 ₹50,000 PRIZE POOL • 🎯 SOLO / DUO / SQUAD •
          🔥 FREE FIRE MAX CUP • ⚡ COD MOBILE RANKED • JOIN NOW 🚀
        </motion.div>
      </section>

      {/* =================================================================================
          STATS / PLATFORM POWER
      ================================================================================= */}
      <section className="px-6 py-24 max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { label: "Active Players", value: "120K+", icon: Users },
            { label: "Prize Money Won", value: "₹8.5Cr+", icon: Trophy },
            { label: "Matches Hosted", value: "25,000+", icon: Swords },
            { label: "Champions Crowned", value: "9,200+", icon: Crown },
          ].map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05 }}
              className="relative rounded-xl border border-white/10 bg-gradient-to-br from-black/60 to-black/30 p-6 text-center backdrop-blur-xl"
            >
              <stat.icon className="mx-auto mb-3 w-7 h-7 text-primary" />
              <div className="text-3xl font-extrabold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* =================================================================================
          CHAMPION PODIUM (WINNER PLACEHOLDER)
      ================================================================================= */}
      <section className="px-6 pb-28 max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl font-bold mb-12 flex items-center gap-2">
            <Crown className="text-yellow-400" /> Recent Champions
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* 2nd */}
            <div className="order-2 md:order-1">
              <ChampionCard
                position="2nd"
                prize="₹15,000"
                name="ShadowX"
                glow="from-slate-400/20"
              />
            </div>

            {/* 1st */}
            <div className="order-1 md:order-2 scale-110">
              <ChampionCard
                position="1st"
                prize="₹30,000"
                name="NightFury"
                glow="from-yellow-400/30"
                crown
              />
            </div>

            {/* 3rd */}
            <div className="order-3">
              <ChampionCard
                position="3rd"
                prize="₹5,000"
                name="VenomOP"
                glow="from-orange-400/20"
              />
            </div>
          </div>
        </motion.div>
      </section>

      {/* =================================================================================
          FINAL CTA – JOIN THE ARENA
      ================================================================================= */}
      <section className="relative px-6 py-32">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-900/40 via-black to-fuchsia-900/40" />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-5xl font-extrabold mb-6">
            Ready to <span className="text-primary">Dominate</span>?
          </h2>

          <p className="text-muted-foreground mb-10">
            Compete with the best. Win real rewards. Build your esports legacy.
          </p>

          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              className="text-lg px-8 py-6"
              onClick={() => setLocation("/tournaments")}
            >
              Enter Arena <Swords className="ml-2" />
            </Button>

            <Button size="lg" variant="outline" className="px-8 py-6">
              View Leaderboard
            </Button>
          </div>
        </motion.div>
      </section>
/* =====================================================================================
   PARTICLE BACKGROUND SYSTEM (NO EXTERNAL LIBRARY)
   ===================================================================================== */

function ParticleBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    let animationFrame: number;

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
    }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 1,
      });
    }

    const animate = () => {
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

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
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
