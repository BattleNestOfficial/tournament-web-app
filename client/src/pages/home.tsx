/* =====================================================================================
   BATTLE NEST – TOURNAMENTS PAGE ULTRA
   3D TILT + INFINITE SCROLL + COUNTDOWN + AUTO FEATURED
   PRODUCTION SAFE – ADVANCED
   ===================================================================================== */

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Trophy,
  Users,
  Wallet,
  Clock,
  Flame,
} from "lucide-react";

import type { Tournament, Game } from "@shared/schema";

/* =====================================================================================
   HELPERS
   ===================================================================================== */

const formatMoney = (v: number) => `₹${(v / 100).toFixed(0)}`;

function getCountdown(startTime: string) {
  const diff = new Date(startTime).getTime() - Date.now();

  if (diff <= 0) return "LIVE";

  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);

  return `${h}h ${m}m ${s}s`;
}

/* =====================================================================================
   3D TILT COMPONENT
   ===================================================================================== */

function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateX = -(y - rect.height / 2) / 15;
    const rotateY = (x - rect.width / 2) / 15;

    el.style.transform = `
      perspective(800px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale(1.03)
    `;
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = `perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)`;
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
   MAIN COMPONENT
   ===================================================================================== */

export default function TournamentsPage() {
  const { data: tournaments = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  /* ==============================================
     INFINITE SCROLL
  ============================================== */

  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    function handleScroll() {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 400
      ) {
        setVisibleCount((prev) => prev + 4);
      }
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const visibleTournaments = tournaments.slice(0, visibleCount);

  /* ==============================================
     FEATURED AUTO SCROLL
  ============================================== */

  const featured = tournaments.filter(t => t.status === "upcoming").slice(0, 6);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let frame: number;

    function autoScroll() {
      container.scrollLeft += 0.5;
      frame = requestAnimationFrame(autoScroll);
    }

    frame = requestAnimationFrame(autoScroll);

    return () => cancelAnimationFrame(frame);
  }, []);

  /* ==============================================
     COUNTDOWN STATE
  ============================================== */

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  /* =====================================================================================
     RENDER
     ===================================================================================== */

  return (
    <div className="min-h-screen bg-black text-white px-6 py-16">

      {/* ================= FEATURED AUTO SCROLL ================= */}

      <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Flame className="text-orange-400" />
        Featured Battles
      </h2>

      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide mb-16"
      >
        {featured.map((t) => (
          <div key={t.id} className="min-w-[300px]">
            <TiltCard>
              <Card className="bg-black/70 border border-white/10">
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-bold">{t.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(t.prizePool)}
                  </p>
                </CardContent>
              </Card>
            </TiltCard>
          </div>
        ))}
      </div>

      {/* ================= GRID ================= */}

      {isLoading ? (
        <div className="grid grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-6">
          {visibleTournaments.map((t) => {
            const progress = (t.filledSlots / t.maxSlots) * 100;

            return (
              <TiltCard key={t.id}>
                <Link href={`/tournaments/${t.id}`}>
                  <Card className="cursor-pointer bg-black/60 border border-white/10 hover:border-primary transition-all">
                    <CardContent className="p-4 space-y-3">
                      <Badge>{t.status}</Badge>

                      <h3 className="font-bold text-sm">{t.title}</h3>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="flex gap-1">
                          <Trophy className="w-3 h-3 text-yellow-400" />
                          {formatMoney(t.prizePool)}
                        </span>

                        <span className="flex gap-1">
                          <Users className="w-3 h-3 text-blue-400" />
                          {t.filledSlots}/{t.maxSlots}
                        </span>

                        <span className="flex gap-1">
                          <Wallet className="w-3 h-3 text-green-400" />
                          {t.entryFee ? formatMoney(t.entryFee) : "FREE"}
                        </span>

                        <span className="flex gap-1">
                          <Clock className="w-3 h-3" />
                          {getCountdown(t.startTime)}
                        </span>
                      </div>

                      <Progress value={progress} />
                    </CardContent>
                  </Card>
                </Link>
              </TiltCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
