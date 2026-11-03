import type { LucideIcon } from "lucide-react";
import { UserPlus } from "lucide-react";
import { useI18n } from "@/locales";
import { openLinkAccount } from "@/stores/account-dialog";
import { Button } from "@/components/ui/button";

/**
 * Shared empty state for every personal section when no Minecraft account is
 * linked. The copy and the call to action are identical everywhere so the user
 * never has to enter a nickname again.
 */
export function LinkAccountPrompt({
  icon: Icon = UserPlus,
  redirect,
  className,
}: {
  icon?: LucideIcon;
  /** Page to open automatically after the account is linked. */
  redirect?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <section className={className ?? "panel p-6"}>
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-violet/25 bg-violet-soft text-violet">
          <Icon className="size-6" />
        </span>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
          {t("account.requiredTitle")}
        </h2>
        <p className="text-[12px] leading-relaxed text-fg-muted">
          {t("account.requiredDesc")}
        </p>
        <Button
          size="sm"
          className="mt-1"
          onClick={() => openLinkAccount({ mode: "link", redirect })}
        >
          <UserPlus className="size-3.5" />
          {t("account.link")}
        </Button>
        <p className="text-[10px] text-fg-subtle">{t("account.switchAccountHint")}</p>
      </div>
    </section>
  );
}
