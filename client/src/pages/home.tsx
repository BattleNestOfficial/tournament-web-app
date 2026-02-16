/* =====================================================================================
   BATTLE NEST – TOURNAMENTS PAGE GOD MODE
   PART 1 / 4
   Ultra Futuristic • Parallax • Neon FX • Magnetic Buttons • GPU Optimized
   ===================================================================================== */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  Fragment,
} from "react";

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, useMotionValue, useSpring } from "framer-motion";

import {
  Trophy,
  Users,
  Wallet,
  Clock,
  Flame,
  Sparkles,
  Zap,
  Crown,
  Shield,
  Swords,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import type { Tournament, Game } from "@shared/schema";

/* =====================================================================================
   GLOBAL CONSTANTS
   ===================================================================================== */

const STATUS_COLOR: Record<string, string> = {
  upcoming: "bg-indigo-500/15 text-indigo-400 border-indigo-500/40",
  live: "bg-red-500/15 text-red-400 border-red-500/40",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  cancelled: "bg-muted text-muted-foreground",
};

const MATCH_COLOR: Record<string, string> = {
  solo: "from-emerald-500/20 to-emerald-900/40",
  duo: "from-indigo-500/20 to-indigo-900/40",
  squad: "from-rose-500/20 to-rose-900/40",
};

/* =====================================================================================
   MONEY FORMAT
   ===================================================================================== */

function formatMoney(v: number) {
  return `₹${(v / 100).toLocaleString("en-IN")}`;
}

/* =====================================================================================
   COUNTDOWN ENGINE (LIVE SAFE)
   ===================================================================================== */

function useCountdown(target: string) {
  const [time, setTime] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(target).getTime() - Date.now();

      if (diff <= 0) {
        setTime("LIVE");
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setTime(`${h}h ${m}m ${s}s`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return time;
}
function CountdownText({ startTime }: { startTime: string }) {
  const countdown = useCountdown(startTime);

  return (
    <div className="flex items-center gap-2 text-xs text-indigo-400">
      <Clock className="w-3 h-3" />
      {countdown}
    </div>
  );
}

/* =====================================================================================
   MAGNETIC BUTTON COMPONENT
   ===================================================================================== */

function MagneticButton({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    el.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate(0px, 0px)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className="transition-transform duration-200"
    >
      {children}
    </div>
  );
}

/* =====================================================================================
   HOLOGRAPHIC CARD WRAPPER
   ===================================================================================== */

function HoloCard({
  children,
}: {
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(y, { stiffness: 150, damping: 20 });
  const rotateY = useSpring(x, { stiffness: 150, damping: 20 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    x.set((px - rect.width / 2) / 15);
    y.set(-(py - rect.height / 2) / 15);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 900,
      }}
      className="transition-transform duration-300"
    >
      {children}
    </motion.div>
  );
}

/* =====================================================================================
   PARTICLE FIELD BACKGROUND
   ===================================================================================== */

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    let frame: number;

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
    }[] = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.8 + 0.5,
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fill();
      });

      frame = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(frame);
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
   MAIN COMPONENT START
   ===================================================================================== */

export default function TournamentsPageGod() {
  const { data: tournaments = [], isLoading } =
    useQuery<Tournament[]>({
      queryKey: ["/api/tournaments"],
    });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

// 🔥 HOT SECTION = UPCOMING
const hotTournaments = useMemo(
  () => tournaments.filter((t) => t.status === "upcoming"),
  [tournaments]
);

// ✨ LIVE SECTION
const liveTournaments = useMemo(
  () => tournaments.filter((t) => t.status === "live"),
  [tournaments]
);


const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};
     /* =====================================================================================
     HERO SECTION – CYBER GLASS BANNER
     ===================================================================================== */

  const heroMotion = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  };

  /* =====================================================================================
     AUTO-SCROLL FEATURED RAIL
     ===================================================================================== */

  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    let frame: number;

    function animate() {
      rail.scrollLeft += 0.6;
      if (rail.scrollLeft >= rail.scrollWidth / 2) {
        rail.scrollLeft = 0;
      }
      frame = requestAnimationFrame(animate);
    }

    animate();

    return () => cancelAnimationFrame(frame);
  }, []);

  /* =====================================================================================
     LOAD MORE ENGINE (INFINITE FEEL)
     ===================================================================================== */

  

  /* =====================================================================================
     RENDER START
     ===================================================================================== */

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">

      {/* BACKGROUND PARTICLES */}
      <ParticleField />

      {/* CYBER GRADIENT OVERLAY */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#1e1b4b,transparent_60%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,#7c2d12,transparent_60%)]" />

      {/* =================================================================================
         HERO SECTION
         ================================================================================= */}

      <section className="relative px-6 pt-28 pb-24 max-w-7xl mx-auto text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={heroMotion}
          transition={{ duration: 0.8 }}
        >
          <Badge className="mb-4 px-4 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            ⚡ Competitive Arena
          </Badge>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            DOMINATE THE
            <span className="block bg-gradient-to-r from-indigo-400 to-fuchsia-500 bg-clip-text text-transparent">
              TOURNAMENT GRID
            </span>
          </h1>

          <p className="mt-6 text-muted-foreground max-w-2xl mx-auto">
  Browse high-stakes esports tournaments. Solo, Duo, Squad.
  Massive prize pools. Real competition.
</p>

<div className="mt-8">
  <Link href="/tournaments">
    <button className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-semibold hover:opacity-90 transition">
      Browse Tournaments
    </button>
  </Link>
</div>
        </motion.div>
      </section>

      {/* =================================================================================
         FEATURED RAIL (AUTO MOVING)
         ================================================================================= */}

      {hotTournaments.length > 0 && (
        <section className="px-6 pb-24 max-w-7xl mx-auto">
         <div className="flex items-center gap-3 mb-8">

  <Flame className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.9)]" />

  <h2 className="text-3xl font-extrabold 
    bg-gradient-to-r 
    from-yellow-300 
    via-yellow-500 
    to-amber-600 
    bg-clip-text 
    text-transparent 
    drop-shadow-[0_0_18px_rgba(234,179,8,0.8)] 
    animate-pulse">
    
    HOT TOURNAMENTS
    
  </h2>

</div>

          <div
            ref={railRef}
            className="flex gap-6 overflow-hidden whitespace-nowrap"
          >
          {hotTournaments.map((t, i) => {
              const progress =
                (t.filledSlots / t.maxSlots) * 100;

              return (
                <motion.div
                  key={`${t.id}-${i}`}
                  whileHover={{ scale: 1.05 }}
                  className="min-w-[300px]"
                >
                  <HoloCard>
                    <Link href={`/tournaments/${t.id}`}>
  <div className="relative p-[2px] rounded-xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 animate-pulse">
    
    <div className="absolute inset-0 rounded-xl blur-xl opacity-70 bg-yellow-400" />

    <Card
      className="relative rounded-xl overflow-hidden
      bg-gradient-to-br from-black/60 to-black/30 backdrop-blur-xl
      border border-yellow-400/60
      transition-all duration-300 cursor-pointer"
    >

  {/* IMAGE */}
  <div className="relative h-40 overflow-hidden rounded-t-xl">
    {t.imageUrl ? (
      <img
        src={t.imageUrl}
        className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
      />
    ) : (
      <div
        className={`h-full w-full bg-gradient-to-br ${
          MATCH_COLOR[t.matchType]
        } flex items-center justify-center`}
      >
        <Shield className="w-10 h-10 opacity-20" />
      </div>
    )}

    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

    {/* UPCOMING INDICATOR (RIGHT SIDE LIKE LIVE) */}
    <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-bold text-yellow-400">
      <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse absolute" />
      <span className="w-2 h-2 rounded-full bg-yellow-500" />
      UPCOMING
    </div>
  </div>

  <CardContent className="p-5 space-y-4">

    {/* TITLE */}
    <h3 className="font-bold text-lg truncate">
      {t.title}
    </h3>

    {/* COUNTDOWN */}
    <CountdownText startTime={t.startTime} />

    {/* SAME GRID AS LIVE */}
    <div className="grid grid-cols-2 gap-3 text-xs">

      <div className="flex items-center gap-2 text-yellow-400">
        <Trophy className="w-3 h-3" />
        <span className="font-semibold">
          {formatMoney(t.prizePool)}
        </span>
      </div>

      <div className="flex items-center gap-2 text-emerald-400">
        <Wallet className="w-3 h-3" />
        {t.entryFee > 0
          ? formatMoney(t.entryFee)
          : "FREE"}
      </div>

      <div className="flex items-center gap-2 text-blue-400">
        <Users className="w-3 h-3" />
        {t.filledSlots}/{t.maxSlots}
      </div>

      <div className="flex items-center gap-2 text-fuchsia-400">
        <Swords className="w-3 h-3" />
        <span className="capitalize">
          {t.matchType}
        </span>
      </div>

    </div>

    {/* MATCH LIVE CARD PROGRESS HEIGHT */}
    <div>
      <Progress value={(t.filledSlots / t.maxSlots) * 100} className="h-2" />
    </div>

  </CardContent>
</Card>
  </div>
                    </Link>
                  </HoloCard>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* =================================================================================
         MAIN GRID SECTION HEADER
         ================================================================================= */}

      <section className="px-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="text-fuchsia-400" />
            Live Tournaments
          </h2>

          <MagneticButton>
            <div className="text-sm text-indigo-400 cursor-pointer">
              Total: {tournaments.length}
            </div>
          </MagneticButton>
        </div>
      </section>
             {/* =================================================================================
         ADVANCED TOURNAMENT GRID
         ================================================================================= */}

      <section className="px-6 pb-32 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="border border-white/10 bg-black/40 backdrop-blur-xl">
                <CardContent className="p-4 space-y-4">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-6 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : liveTournaments.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {liveTournaments.map((t, index) => {
              const progress =
                (t.filledSlots / t.maxSlots) * 100;

              const isLive = t.status === "live";

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <HoloCard>
                    <Link href={`/tournaments/${t.id}`}>
                      <Card
                        className={`group relative overflow-hidden border bg-gradient-to-br from-black/60 to-black/30 backdrop-blur-xl transition-all duration-300 cursor-pointer ${
                          isLive
                            ? "border-red-500/60 shadow-[0_0_25px_rgba(239,68,68,0.4)]"
                            : "border-white/10 hover:border-indigo-500/60"
                        }`}
                      >

                        {/* LIVE PULSE */}
                      <div
  className={`absolute top-3 right-3 flex items-center gap-1 text-xs font-bold ${
    t.status === "live"
      ? "text-red-400"
      : "text-indigo-400"
  }`}
>
  <span
    className={`w-2 h-2 rounded-full ${
      t.status === "live"
        ? "bg-red-500 animate-ping absolute"
        : "bg-indigo-500 animate-pulse absolute"
    }`}
  />
  <span
    className={`w-2 h-2 rounded-full ${
      t.status === "live"
        ? "bg-red-500"
        : "bg-indigo-500"
    }`}
  />
  {t.status === "live" ? "LIVE" : "UPCOMING"}
</div>

                        {/* IMAGE */}
                        <div className="relative h-40 overflow-hidden">
                          {t.imageUrl ? (
                            <img
                              src={t.imageUrl}
                              className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                          ) : (
                            <div
                              className={`h-full w-full bg-gradient-to-br ${
                                MATCH_COLOR[t.matchType]
                              } flex items-center justify-center`}
                            >
                              <Shield className="w-10 h-10 opacity-20" />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        </div>

                        <CardContent className="p-5 space-y-4">

                          {/* TITLE */}
                          <h3 className="font-bold text-lg truncate">
                            {t.title}
                          </h3>

                          {/* COUNTDOWN */}
                        <CountdownText startTime={t.startTime} />

                          {/* STATS */}
                          <div className="grid grid-cols-2 gap-3 text-xs">

                            <div className="flex items-center gap-2 text-yellow-400">
                              <Trophy className="w-3 h-3" />
                              <span className="font-semibold">
                                {formatMoney(t.prizePool)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-emerald-400">
                              <Wallet className="w-3 h-3" />
                              {t.entryFee > 0
                                ? formatMoney(t.entryFee)
                                : "FREE"}
                            </div>

                            <div className="flex items-center gap-2 text-blue-400">
                              <Users className="w-3 h-3" />
                              {t.filledSlots}/{t.maxSlots}
                            </div>

                            <div className="flex items-center gap-2 text-fuchsia-400">
                              <Swords className="w-3 h-3" />
                              <span className="capitalize">
                                {t.matchType}
                              </span>
                            </div>

                          </div>

                          {/* PROGRESS */}
                          <div>
                            <Progress value={progress} className="h-2" />
                          </div>

                          {/* ROOM PREVIEW ON HOVER */}
                          {t.roomId && (
                            <div className="mt-3 p-3 rounded-md bg-indigo-500/5 border border-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="text-[10px] uppercase text-indigo-400 mb-1">
                                Room Details
                              </div>
                              <div className="flex justify-between text-xs font-mono">
                                <span>ID: {t.roomId}</span>
                                <span>PASS: {t.roomPassword}</span>
                              </div>
                            </div>
                          )}

                        </CardContent>
                      </Card>
                    </Link>
                  </HoloCard>
                </motion.div>
              );
            })}

          </div>
        ) : (
          <Card className="border border-white/10 bg-black/40 backdrop-blur-xl">
            <CardContent className="p-12 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No tournaments found
              </h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting filters or check again later.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
             {/* =================================================================================
         FINAL CALL TO ACTION SECTION
         ================================================================================= */}

      <section className="relative px-6 py-32">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-900/30 via-black to-fuchsia-900/30 blur-2xl" />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6">
            Enter The <span className="text-indigo-400">Arena</span>
          </h2>

          <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
            Every match is a battlefield. Every victory builds your legacy.
            Climb the leaderboard. Earn rewards. Become unstoppable.
          </p>
                     <div className="mt-8">
            <Link href="/tournaments">
              <button className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-semibold hover:opacity-90 transition">
                Browse Tournaments
              </button>
            </Link>
          </div>

        </motion.div>
      </section>

    </div>
  );
}

