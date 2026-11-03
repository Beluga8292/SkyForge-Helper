import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { Bootstrap } from "@/app/Bootstrap";
import { useSettingsStore } from "@/stores/settings";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 60_000,
            gcTime: 30 * 60_000,
          },
        },
      }),
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250}>
          <Bootstrap>{children}</Bootstrap>
          <AppToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function AppToaster() {
  const theme = useSettingsStore((state) => state.settings.theme);
  return (
    <Toaster
      position="bottom-right"
      theme={theme === "light" ? "light" : "dark"}
      closeButton
      toastOptions={{
        classNames: {
          toast: "sbc-toast",
          title: "sbc-toast-title",
          description: "sbc-toast-description",
        },
      }}
    />
  );
}
