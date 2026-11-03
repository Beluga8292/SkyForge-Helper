import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/locales";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="panel w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-violet/25 bg-violet-soft text-violet">
          <Compass className="size-6" />
        </div>
        <p className="mt-4 font-mono text-[42px] font-semibold leading-none tracking-[-0.05em] text-fg">404</p>
        <h1 className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-fg">{t("errors.notFound")}</h1>
        <p className="mt-1.5 text-[12px] leading-relaxed text-fg-muted">{t("errors.retryHint")}</p>
        <Button asChild size="sm" className="mt-5">
          <Link to="/">
            <ArrowLeft className="size-3.5" /> {t("nav.dashboard")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
