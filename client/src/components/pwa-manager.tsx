import { useEffect, useRef } from "react";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  activateWaitingServiceWorker,
  ensurePushPermission,
  flushQueuedResultsFromClient,
  registerBattleNestServiceWorker,
  registerResultsBackgroundSync,
} from "@/lib/pwa";

export default function PwaManager() {
  const { toast } = useToast();
  const hasReloadedRef = useRef(false);

  useEffect(() => {
    ensurePushPermission().catch(() => {});

    registerBattleNestServiceWorker({
      onUpdateAvailable: (registration) => {
        toast({
          title: "Update available",
          description: "A new Battle Nest version is ready.",
          action: (
            <ToastAction
              altText="Update now"
              onClick={() => activateWaitingServiceWorker(registration)}
            >
              Update
            </ToastAction>
          ),
        });
      },
      onControllerUpdated: () => {
        if (hasReloadedRef.current) return;
        hasReloadedRef.current = true;
        window.location.reload();
      },
      onMessage: (message) => {
        if (message?.type === "RESULT_SYNC_SUCCESS") {
          queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
          queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
          toast({
            title: "Offline results synced",
            description: "Queued match results were submitted successfully.",
          });
          return;
        }

        if (message?.type === "RESULT_SYNC_ERROR") {
          toast({
            title: "Result sync issue",
            description: String(message?.message || "Some queued results need manual review."),
            variant: "destructive",
          });
          return;
        }

        if (message?.type === "OPEN_URL" && message?.url) {
          window.location.href = String(message.url);
        }
      },
    }).catch(() => {});

    const syncNow = async () => {
      await flushQueuedResultsFromClient().catch(() => {});
      await registerResultsBackgroundSync().catch(() => {});
    };

    const onOnline = () => {
      syncNow().catch(() => {});
    };

    window.addEventListener("online", onOnline);
    syncNow().catch(() => {});

    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [toast]);

  return null;
}
