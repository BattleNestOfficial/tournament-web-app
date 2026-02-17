import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Copy,
  Eye,
  Flame,
  Gamepad2,
  LogIn,
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

import type { Banner, Game, Registration, Tournament } from "@shared/schema";

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
    tone: "from-lime-700/50 via-green-700/40 to-slate-950",
  },
  {
    id: "promo-ph-2",
    title: "Battle Nest Featured Match",
    subtitle: "Compete, stream, and win in premium esports tournaments.",
    tone: "from-emerald-700/50 via-green-700/45 to-slate-950",
  },
  {
    id: "promo-ph-3",
    title: "Battle Nest Featured Match",
    subtitle: "Compete, stream, and win in premium esports tournaments.",
    tone: "from-green-700/50 via-lime-700/40 to-slate-950",
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
  return <div>{children}</div>;
}

function TournamentMatchCard({
  tournament,
  gameName,
  status,
  index,
  token,
  joined,
  onShowRoom,
  onOpenDetails,
}: {
  tournament: Tournament;
  gameName: string;
  status: ShowcaseStatus;
  index: number;
  token: string | null;
  joined: boolean;
  onShowRoom: (tournament: Tournament) => void;
  onOpenDetails: (tournamentId: number) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const countdown = useCountdown(tournament.startTime);
  const theme = SHOWCASE_THEME[status];
  const progress = Math.min(100, (tournament.filledSlots / Math.max(tournament.maxSlots, 1)) * 100);
  const canJoin = status === "hot" || status === "upcoming";
  const joinHref = token ? `/tournaments/${tournament.id}?action=join` : "/auth";
  const interactiveSelector = "a,button,input,select,textarea,[role='button']";

  function handleCardOpen(event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest(interactiveSelector)) {
      return;
    }
    onOpenDetails(Number(tournament.id));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.06, 0.35), duration: 0.45 }}
    >
      <HoloCard>
        <Card
          role="button"
          tabIndex={0}
          onClick={handleCardOpen}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            handleCardOpen(event);
          }}
          className={`group overflow-hidden border ${theme.edge} ${theme.glow} bg-gradient-to-br from-black/80 to-slate-950/80 backdrop-blur-xl cursor-pointer transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70`}
        >
            <div className="relative h-44 overflow-hidden">
              {tournament.imageUrl && !imgFailed ? (
                <img
                  src={tournament.imageUrl}
                  alt={tournament.title}
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover"
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

              <div className="grid grid-cols-2 gap-2 pt-1">
                {status === "live" ? (
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => onShowRoom(tournament)}>
                    Show ID/Password
                  </Button>
                ) : joined ? (
                  <Button size="sm" disabled className="w-full">
                    Registered
                  </Button>
                ) : canJoin ? (
                  <Button size="sm" className="w-full gap-1.5" asChild>
                    <Link href={joinHref}>
                      {token ? <Swords className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
                      Join
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" disabled variant="secondary" className="w-full">
                    {status === "live" ? "Live" : "Closed"}
                  </Button>
                )}

                <Button size="sm" variant="outline" className="w-full gap-1.5" asChild>
                  <Link href={`/tournaments/${tournament.id}`}>
                    <Eye className="w-3.5 h-3.5" />
                    View Details
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
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
  const { token } = useAuth();
  const [roomDialogTournament, setRoomDialogTournament] = useState<Tournament | null>(null);
  const [copiedRoomField, setCopiedRoomField] = useState<"roomId" | "roomPassword" | null>(null);

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

  const { data: myRegistrations = [] } = useQuery<Registration[]>({
    queryKey: ["/api/registrations/my"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch("/api/registrations/my", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: totalUsersStats } = useQuery<{ count: number }>({
    queryKey: ["/api/stats/total-users"],
    queryFn: async () => {
      const res = await fetch("/api/stats/total-users");
      if (!res.ok) {
        throw new Error("Failed to load total users");
      }
      const data = await res.json();
      return { count: Number(data?.count) || 0 };
    },
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
  const joinedTournamentIds = useMemo(
    () =>
      new Set(
        myRegistrations
          .map((r) => Number(r.tournamentId))
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    [myRegistrations]
  );

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
      totalPlayers: Number(totalUsersStats?.count) || 0,
      liveNow: normalizedTournaments.filter((t) => t.status === "live").length,
      totalPrizePool: normalizedTournaments.reduce((sum, t) => sum + (activeStatuses.has(String(t.status)) ? t.prizePool : 0), 0),
      totalPayout: normalizedTournaments.reduce((sum, t) => sum + (t.status === "completed" ? t.prizePool : 0), 0),
    };
  }, [normalizedTournaments, totalUsersStats?.count]);

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

  async function copyRoomCredential(value: string, field: "roomId" | "roomPassword") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedRoomField(field);
      window.setTimeout(() => setCopiedRoomField(null), 1200);
    } catch {
      setCopiedRoomField(null);
    }
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <ParticleField />
      <div className="absolute inset-0 -z-30 bg-gradient-to-br from-[#010701] via-[#03210b] to-[#001006]" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-36 -z-20 h-[34rem] w-[34rem] rounded-full bg-lime-500/35 blur-3xl"
        animate={{ x: [0, 45, -20, 0], y: [0, 35, 20, 0], scale: [1, 1.12, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-20 -z-20 h-[30rem] w-[30rem] rounded-full bg-emerald-500/35 blur-3xl"
        animate={{ x: [0, -35, 25, 0], y: [0, 40, -15, 0], scale: [1, 0.9, 1.08, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/3 bottom-0 -z-20 h-[28rem] w-[28rem] rounded-full bg-green-500/35 blur-3xl"
        animate={{ x: [0, -30, 18, 0], y: [0, -30, 12, 0], scale: [1, 1.05, 0.92, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#39ff7a88,transparent_56%)]"
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,#22c55e66,transparent_64%)]"
        animate={{ opacity: [0.65, 0.95, 0.65] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(3,8,3,0.12),rgba(0,0,0,0.55))]" />

      <section className="relative px-6 pt-24 pb-14 max-w-7xl mx-auto">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.9fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <Badge className="mb-4 px-4 py-1 bg-lime-500/10 text-lime-300 border border-lime-400/40">
              INDIA'S BATTLE ARENA
            </Badge>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
              BATTLE NEST
              <span className="block bg-gradient-to-r from-lime-300 via-emerald-300 to-green-400 bg-clip-text text-transparent">
                Play. Rise. Win.
              </span>
            </h1>
            <p className="mt-5 text-white/70 max-w-3xl lg:mx-0 mx-auto">
              Join high-stakes BGMI, Free Fire, CODM and more. Build your squad, enter live tournaments, and climb from local grinders to Battle Nest champions.
            </p>

            <div className="mt-8 flex items-center justify-center lg:justify-start">
              <Link href="/tournaments">
                <button className="px-7 py-3 rounded-lg bg-gradient-to-r from-lime-400 to-green-500 text-black font-semibold hover:opacity-90 transition">
                  Browse Tournaments
                </button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="lg:justify-self-end w-full max-w-xl lg:max-w-lg"
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
                <p className="text-[11px] uppercase tracking-widest text-lime-200">Featured Promotion</p>
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

          <Card className="border-lime-500/30 bg-black/45 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-lime-300 flex items-center gap-1.5 mb-1">
                <Radio className="w-3.5 h-3.5" /> Live Now
              </div>
              <p className="text-xl font-bold">{metrics.liveNow}</p>
            </CardContent>
          </Card>

          <Card className="border-lime-500/30 bg-black/45 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-lime-300 flex items-center gap-1.5 mb-1">
                <Trophy className="w-3.5 h-3.5" /> Total Prize Pool
              </div>
              <p className="text-xl font-bold">{formatMoney(metrics.totalPrizePool)}</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30 bg-black/45 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-emerald-300 flex items-center gap-1.5 mb-1">
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
              <TournamentMatchCard
                key={t.id}
                tournament={t}
                gameName={gameById.get(t.gameId)?.name || "Unknown Game"}
                status="hot"
                index={idx}
                token={token}
                joined={joinedTournamentIds.has(Number(t.id))}
                onShowRoom={setRoomDialogTournament}
                onOpenDetails={(tournamentId) => setLocation(`/tournaments/${tournamentId}`)}
              />
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
              <TournamentMatchCard
                key={t.id}
                tournament={t}
                gameName={gameById.get(t.gameId)?.name || "Unknown Game"}
                status="upcoming"
                index={idx}
                token={token}
                joined={joinedTournamentIds.has(Number(t.id))}
                onShowRoom={setRoomDialogTournament}
                onOpenDetails={(tournamentId) => setLocation(`/tournaments/${tournamentId}`)}
              />
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
              <TournamentMatchCard
                key={t.id}
                tournament={t}
                gameName={gameById.get(t.gameId)?.name || "Unknown Game"}
                status="live"
                index={idx}
                token={token}
                joined={joinedTournamentIds.has(Number(t.id))}
                onShowRoom={setRoomDialogTournament}
                onOpenDetails={(tournamentId) => setLocation(`/tournaments/${tournamentId}`)}
              />
            ))}
          </div>
        ) : (
          <Card className="border-white/10 bg-black/35"><CardContent className="p-8 text-center text-white/65">No live tournaments.</CardContent></Card>
        )}
      </section>

      <Dialog
        open={!!roomDialogTournament}
        onOpenChange={(open) => {
          if (!open) setRoomDialogTournament(null);
        }}
      >
        <DialogContent className="max-w-md border-white/20 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Room Credentials</DialogTitle>
          </DialogHeader>
          {roomDialogTournament && (
            <div className="space-y-3">
              <p className="text-sm text-white/70">{roomDialogTournament.title}</p>
              {roomDialogTournament.roomId && roomDialogTournament.roomPassword ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-2">
                  <div className="flex items-center justify-between rounded-md border border-emerald-400/30 bg-black/20 px-3 py-2">
                    <p className="text-sm text-emerald-100">
                      Room ID: <span className="font-mono font-semibold text-white">{roomDialogTournament.roomId}</span>
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyRoomCredential(roomDialogTournament.roomId!, "roomId")}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      {copiedRoomField === "roomId" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-emerald-400/30 bg-black/20 px-3 py-2">
                    <p className="text-sm text-emerald-100">
                      Password: <span className="font-mono font-semibold text-white">{roomDialogTournament.roomPassword}</span>
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyRoomCredential(roomDialogTournament.roomPassword!, "roomPassword")}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      {copiedRoomField === "roomPassword" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/75">
                  Room credentials are visible only to registered players when the tournament is live.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
