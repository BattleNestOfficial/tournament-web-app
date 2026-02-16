import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Flame,
  Gamepad2,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import type { Banner, Game, Tournament } from "@shared/schema";

type ShowcaseStatus = "hot" | "upcoming" | "live";
type PromoSlide = {
  id: string | number;
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  tone?: string;
  ctaLabel?: string;
};

const SHOWCASE_THEME: Record<ShowcaseStatus, { edge: string; chip: string; glow: string; label: string }> = {
  hot: {
    edge: "border-amber-400/60",
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/60",
    glow: "shadow-[0_0_28px_rgba(251,191,36,0.25)]",
    label: "HOT",
  },
  upcoming: {
    edge: "border-indigo-400/60",
    chip: "bg-indigo-500/15 text-indigo-300 border-indigo-400/60",
    glow: "shadow-[0_0_24px_rgba(99,102,241,0.25)]",
    label: "UPCOMING",
  },
  live: {
    edge: "border-red-500/60",
    chip: "bg-red-500/15 text-red-300 border-red-500/60",
    glow: "shadow-[0_0_28px_rgba(239,68,68,0.3)]",
    label: "LIVE",
  },
};

const PLACEHOLDER_GRADIENT: Record<string, string> = {
  hot: "from-amber-700/60 via-orange-700/45 to-black",
  upcoming: "from-indigo-700/60 via-violet-700/45 to-black",
  live: "from-red-700/60 via-rose-700/45 to-black",
};

const PROMO_PLACEHOLDERS: PromoSlide[] = [
  {
    id: "promo-ph-1",
    title: "Battle Nest Featured Match",
    subtitle: "Compete, stream, and win in premium esports tournaments.",
    tone: "from-indigo-700/55 via-blue-700/45 to-slate-900",
  },
  {
    id: "promo-ph-2",
    title: "Battle Nest Featured Match",
    subtitle: "Compete, stream, and win in premium esports tournaments.",
    tone: "from-fuchsia-700/50 via-purple-700/45 to-slate-900",
  },
  {
    id: "promo-ph-3",
    title: "Battle Nest Featured Match",
    subtitle: "Compete, stream, and win in premium esports tournaments.",
    tone: "from-amber-700/50 via-orange-700/40 to-slate-900",
  },
];

function formatMoney(value: number) {
  return `INR ${(value / 100).toLocaleString("en-IN")}`;
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function useCountdown(target: string | Date) {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      const ms = new Date(target).getTime() - Date.now();
      if (ms <= 0) {
        setTime("LIVE");
        return;
      }
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const seconds = Math.floor((ms / 1000) % 60);
      setTime(`${hours}h ${minutes}m ${seconds}s`);
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);

  return time;
}

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasEl = canvas;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const ctx2d = ctx;

    const points: Array<{ x: number; y: number; vx: number; vy: number; size: number }> = [];
    let frameId = 0;

    function resize() {
      canvasEl.width = window.innerWidth;
      canvasEl.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 100; i++) {
      points.push({
        x: Math.random() * canvasEl.width,
        y: Math.random() * canvasEl.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 1.6 + 0.4,
      });
    }

    function draw() {
      ctx2d.clearRect(0, 0, canvasEl.width, canvasEl.height);
      points.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvasEl.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvasEl.height) p.vy *= -1;

        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx2d.fillStyle = "rgba(255,255,255,0.05)";
        ctx2d.fill();
      });

      frameId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-20 pointer-events-none" />;
}

function HoloCard({ children }: { children: React.ReactNode }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(y, { stiffness: 170, damping: 20 });
  const rotateY = useSpring(x, { stiffness: 170, damping: 20 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    x.set((px - rect.width / 2) / 18);
    y.set(-(py - rect.height / 2) / 18);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className="transition-transform duration-300"
    >
      {children}
    </motion.div>
  );
}

function TournamentMatchCard({
  tournament,
  gameName,
  status,
  index,
}: {
  tournament: Tournament;
  gameName: string;
  status: ShowcaseStatus;
  index: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const countdown = useCountdown(tournament.startTime);
  const theme = SHOWCASE_THEME[status];
  const progress = Math.min(100, (tournament.filledSlots / Math.max(tournament.maxSlots, 1)) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.06, 0.35), duration: 0.45 }}
    >
      <HoloCard>
        <Link href={`/tournaments/${tournament.id}`}>
          <Card className={`group overflow-hidden border ${theme.edge} ${theme.glow} bg-gradient-to-br from-black/80 to-slate-950/80 backdrop-blur-xl cursor-pointer transition-all duration-300`}>
            <div className="relative h-44 overflow-hidden">
              {tournament.imageUrl && !imgFailed ? (
                <img
                  src={tournament.imageUrl}
                  alt={tournament.title}
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
              ) : (
                <div className={`h-full w-full bg-gradient-to-br ${PLACEHOLDER_GRADIENT[status]} flex items-center justify-center`}>
                  <div className="text-center">
                    <Shield className="w-9 h-9 mx-auto opacity-60" />
                    <p className="text-xs mt-2 text-white/85">{gameName}</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="absolute top-3 right-3">
                <Badge className={`text-[10px] tracking-wide uppercase ${theme.chip}`}>{theme.label}</Badge>
              </div>
              <div className="absolute bottom-3 left-3">
                <p className="text-sm text-white/80">{gameName}</p>
                <h3 className="text-lg font-bold leading-tight max-w-[85%] line-clamp-1">{tournament.title}</h3>
              </div>
            </div>

            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-indigo-200">
                <span className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> {formatDateTime(tournament.startTime)}</span>
                <span className="font-semibold">{countdown}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-white/10 bg-black/35 p-2">
                  <p className="text-white/60">Prize</p>
                  <p className="font-semibold text-yellow-300">{formatMoney(tournament.prizePool)}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/35 p-2">
                  <p className="text-white/60">Entry</p>
                  <p className="font-semibold text-emerald-300">{tournament.entryFee > 0 ? formatMoney(tournament.entryFee) : "FREE"}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/35 p-2">
                  <p className="text-white/60">Slots</p>
                  <p className="font-semibold text-blue-300">{tournament.filledSlots}/{tournament.maxSlots}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/35 p-2">
                  <p className="text-white/60">Mode</p>
                  <p className="font-semibold capitalize text-fuchsia-300">{tournament.matchType}</p>
                </div>
              </div>

              <Progress value={progress} className="h-2" />
              <p className="text-[11px] text-right text-white/60">{Math.round(progress)}% filled</p>

              {status === "live" && tournament.roomId && tournament.roomPassword && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs">
                  <p className="text-red-200">
                    Room ID: <span className="font-semibold font-mono text-white">{tournament.roomId}</span>
                  </p>
                  <p className="text-red-200 mt-1">
                    Password: <span className="font-semibold font-mono text-white">{tournament.roomPassword}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </HoloCard>
    </motion.div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <p className="text-sm text-white/60 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [bannerIndex, setBannerIndex] = useState(0);
  const [, setLocation] = useLocation();

  const {
    data: tournaments = [],
    isLoading,
    isError,
  } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
    queryFn: async () => {
      const token = localStorage.getItem("bn_token");
      const res = await fetch("/api/tournaments", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 401) return [];
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load tournaments");
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 15000,
    retry: 2,
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ["/api/banners"],
    retry: false,
  });

  const promoSlides = useMemo<PromoSlide[]>(
    () =>
      banners.length > 0
        ? banners.map((banner) => ({
            id: banner.id,
            title: banner.title || "Battle Nest Featured Match",
            subtitle: "Compete, stream, and win in premium esports tournaments.",
            imageUrl: banner.imageUrl,
            linkUrl: banner.linkUrl,
            ctaLabel: "Open Promotion",
          }))
        : PROMO_PLACEHOLDERS,
    [banners]
  );

  useEffect(() => {
    if (promoSlides.length <= 1) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % promoSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [promoSlides.length]);

  useEffect(() => {
    if (bannerIndex < promoSlides.length) return;
    setBannerIndex(0);
  }, [bannerIndex, promoSlides.length]);

  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const normalizedTournaments = useMemo(() => {
    const validStatuses = new Set(["hot", "upcoming", "live", "completed", "cancelled"]);
    return tournaments.map((t) => {
      const status = validStatuses.has(String(t.status)) ? (t.status as Tournament["status"]) : "upcoming";
      const maxSlots = Number.isFinite(t.maxSlots) && t.maxSlots > 0 ? t.maxSlots : 1;
      const filledSlotsRaw = Number.isFinite(t.filledSlots) && t.filledSlots >= 0 ? t.filledSlots : 0;

      return {
        ...t,
        status,
        entryFee: Number.isFinite(t.entryFee) ? t.entryFee : 0,
        prizePool: Number.isFinite(t.prizePool) ? t.prizePool : 0,
        maxSlots,
        filledSlots: Math.min(filledSlotsRaw, maxSlots),
      };
    });
  }, [tournaments]);

  const hotTournaments = useMemo(
    () =>
      normalizedTournaments
        .filter((t) => String(t.status).toLowerCase().trim() === "hot")
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [normalizedTournaments]
  );

  const upcomingTournaments = useMemo(
    () => normalizedTournaments.filter((t) => t.status === "upcoming").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [normalizedTournaments]
  );

  const liveTournaments = useMemo(
    () => normalizedTournaments.filter((t) => t.status === "live").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [normalizedTournaments]
  );

  const metrics = useMemo(() => {
    const activeStatuses = new Set(["hot", "upcoming", "live"]);
    return {
      totalPlayers: normalizedTournaments.reduce((sum, t) => sum + (t.status === "cancelled" ? 0 : t.filledSlots), 0),
      liveNow: normalizedTournaments.filter((t) => t.status === "live").length,
      totalPrizePool: normalizedTournaments.reduce((sum, t) => sum + (activeStatuses.has(String(t.status)) ? t.prizePool : 0), 0),
      totalPayout: normalizedTournaments.reduce((sum, t) => sum + (t.status === "completed" ? t.prizePool : 0), 0),
    };
  }, [normalizedTournaments]);

  const activeSlide = promoSlides[bannerIndex] ?? promoSlides[0];

  function handlePromoBannerClick() {
    const raw = (activeSlide?.linkUrl || "").trim();
    if (!raw) return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      window.open(raw, "_blank", "noopener,noreferrer");
      return;
    }
    const href = raw.startsWith("/") ? raw : `/${raw}`;
    setLocation(href);
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <ParticleField />
      <div className="absolute inset-0 -z-30 bg-gradient-to-br from-[#091336] via-[#28124f] to-[#0b2c4f]" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-36 -z-20 h-[34rem] w-[34rem] rounded-full bg-cyan-500/50 blur-3xl"
        animate={{ x: [0, 45, -20, 0], y: [0, 35, 20, 0], scale: [1, 1.12, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-20 -z-20 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/45 blur-3xl"
        animate={{ x: [0, -35, 25, 0], y: [0, 40, -15, 0], scale: [1, 0.9, 1.08, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/3 bottom-0 -z-20 h-[28rem] w-[28rem] rounded-full bg-indigo-500/50 blur-3xl"
        animate={{ x: [0, -30, 18, 0], y: [0, -30, 12, 0], scale: [1, 1.05, 0.92, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#3558ffaa,transparent_56%)]"
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,#d946ef7a,transparent_64%)]"
        animate={{ opacity: [0.65, 0.95, 0.65] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.18),rgba(2,6,23,0.5))]" />

      <section className="relative px-6 pt-24 pb-14 max-w-7xl mx-auto">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.9fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <Badge className="mb-4 px-4 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-400/40">
              INDIA'S BATTLE ARENA
            </Badge>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
              BATTLE NEST
              <span className="block bg-gradient-to-r from-indigo-300 via-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
                Play. Rise. Win.
              </span>
            </h1>
            <p className="mt-5 text-white/70 max-w-3xl lg:mx-0 mx-auto">
              Join high-stakes BGMI, Free Fire, CODM and more. Build your squad, enter live tournaments, and climb from local grinders to Battle Nest champions.
            </p>

            <div className="mt-8 flex items-center justify-center lg:justify-start">
              <Link href="/tournaments">
                <button className="px-7 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-semibold hover:opacity-90 transition">
                  Browse Tournaments
                </button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="lg:justify-self-end w-full max-w-lg lg:max-w-md"
          >
            <div
              className={`relative rounded-2xl overflow-hidden border border-white/15 bg-black/40 aspect-square ${activeSlide?.linkUrl ? "cursor-pointer" : ""}`}
              onClick={handlePromoBannerClick}
            >
              {activeSlide?.imageUrl ? (
                <img src={activeSlide.imageUrl} alt={activeSlide.title} className="h-full w-full object-cover" />
              ) : (
                <div className={`h-full w-full bg-gradient-to-r ${activeSlide?.tone || "from-indigo-700/50 via-slate-800/60 to-black"} flex items-center justify-center`}>
                  <Shield className="w-12 h-12 text-white/70" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
              <div className="absolute left-4 right-4 bottom-4">
                <p className="text-[11px] uppercase tracking-widest text-indigo-200">Featured Promotion</p>
                <p className="text-lg font-bold line-clamp-2">Battle Nest Featured Match</p>
                <p className="text-xs text-white/80 mt-1 line-clamp-2">Compete, stream, and win in premium esports tournaments.</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center lg:justify-end gap-1">
              {promoSlides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setBannerIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${idx === bannerIndex ? "w-8 bg-white" : "w-3 bg-white/55"}`}
                  aria-label={`Switch banner ${idx + 1}`}
                />
              ))}
            </div>
          </motion.div>
        </div>

        <div className="mt-9 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-emerald-500/30 bg-black/45 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-emerald-300 flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5" /> Total Players
              </div>
              <p className="text-xl font-bold">{metrics.totalPlayers.toLocaleString("en-IN")}</p>
            </CardContent>
          </Card>

          <Card className="border-red-500/30 bg-black/45 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-red-300 flex items-center gap-1.5 mb-1">
                <Radio className="w-3.5 h-3.5" /> Live Now
              </div>
              <p className="text-xl font-bold">{metrics.liveNow}</p>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/30 bg-black/45 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-yellow-300 flex items-center gap-1.5 mb-1">
                <Trophy className="w-3.5 h-3.5" /> Total Prize Pool
              </div>
              <p className="text-xl font-bold">{formatMoney(metrics.totalPrizePool)}</p>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-black/45 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-cyan-300 flex items-center gap-1.5 mb-1">
                <Wallet className="w-3.5 h-3.5" /> Total Payout
              </div>
              <p className="text-xl font-bold">{formatMoney(metrics.totalPayout)}</p>
            </CardContent>
          </Card>
        </div>

      </section>

      <section className="px-6 pb-12 max-w-7xl mx-auto">
        <SectionHeader icon={<Flame className="w-6 h-6 text-amber-300" />} title="Hot Tournaments" subtitle="Admin-picked spotlight tournaments" />
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx} className="border-white/10 bg-black/40"><CardContent className="p-4 space-y-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
            ))}
          </div>
        ) : hotTournaments.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {hotTournaments.map((t, idx) => (
              <TournamentMatchCard key={t.id} tournament={t} gameName={gameById.get(t.gameId)?.name || "Unknown Game"} status="hot" index={idx} />
            ))}
          </div>
        ) : (
          <Card className="border-white/10 bg-black/35"><CardContent className="p-8 text-center text-white/65">No hot tournaments right now.</CardContent></Card>
        )}
      </section>

      <section className="px-6 pb-12 max-w-7xl mx-auto">
        <SectionHeader icon={<CalendarClock className="w-6 h-6 text-indigo-300" />} title="Upcoming Tournaments" subtitle="Only upcoming matches" />
        {upcomingTournaments.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingTournaments.map((t, idx) => (
              <TournamentMatchCard key={t.id} tournament={t} gameName={gameById.get(t.gameId)?.name || "Unknown Game"} status="upcoming" index={idx} />
            ))}
          </div>
        ) : (
          <Card className="border-white/10 bg-black/35"><CardContent className="p-8 text-center text-white/65">No upcoming tournaments.</CardContent></Card>
        )}
      </section>

      <section className="px-6 pb-20 max-w-7xl mx-auto">
        <SectionHeader icon={<Activity className="w-6 h-6 text-red-300" />} title="Live Tournaments" subtitle="Only live matches" />
        {liveTournaments.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {liveTournaments.map((t, idx) => (
              <TournamentMatchCard key={t.id} tournament={t} gameName={gameById.get(t.gameId)?.name || "Unknown Game"} status="live" index={idx} />
            ))}
          </div>
        ) : (
          <Card className="border-white/10 bg-black/35"><CardContent className="p-8 text-center text-white/65">No live tournaments.</CardContent></Card>
        )}
      </section>

      {isError && (
        <div className="px-6 pb-16 max-w-7xl mx-auto">
          <Card className="border-red-500/40 bg-black/40">
            <CardContent className="p-6 text-center text-red-300">Failed to load tournaments. Try refreshing.</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
