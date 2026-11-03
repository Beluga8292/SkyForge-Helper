import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Link2, Unlink, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/locales";
import { useSettingsStore } from "@/stores/settings";
import { openLinkAccount } from "@/stores/account-dialog";
import { clearTransientAccountCaches } from "@/features/account/caches";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";

/**
 * The single linked-account block in the sidebar. All personal pages read the
 * same `settings.lastProfile` state, so this card is the one place to link,
 * switch or unlink an account.
 */
export function SidebarAccount({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const queryClient = useQueryClient();
  const linked = useSettingsStore((state) => state.settings.lastProfile);
  const setLinkedProfile = useSettingsStore((state) => state.setLinkedProfile);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const openLink = () =>
    openLinkAccount({ mode: "link", redirect: location.pathname });
  const openSwitch = () =>
    openLinkAccount({ mode: "switch", redirect: location.pathname });

  if (!linked) {
    if (collapsed) {
      return (
        <div className="flex justify-center pb-1.5">
          <Tooltip content={t("account.link")} side="right">
            <button
              type="button"
              onClick={openLink}
              className="flex size-9 items-center justify-center rounded-lg border border-dashed border-line-strong text-fg-subtle transition-colors hover:border-violet/40 hover:text-violet"
              aria-label={t("account.link")}
            >
              <UserPlus className="size-4" />
            </button>
          </Tooltip>
        </div>
      );
    }
    return (
      <div className="mb-1.5 rounded-xl border border-dashed border-line-strong bg-surface-2/25 p-2.5">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          {t("account.unlinked")}
        </p>
        <button
          type="button"
          onClick={openLink}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet/35 bg-violet-soft px-2 py-1.5 text-[11.5px] font-medium text-violet transition-colors hover:border-violet/60 hover:bg-violet/15"
        >
          <UserPlus className="size-3.5" />
          {t("account.link")}
        </button>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1.5 pb-1.5">
        <Tooltip content={`${linked.name}${linked.profileName ? ` · ${linked.profileName}` : ""}`} side="right">
          <Link
            to="/profile"
            onClick={onNavigate}
            className="relative flex size-9 items-center justify-center"
            aria-label={linked.name}
          >
            <PlayerAvatar uuid={linked.uuid} name={linked.name} size={34} rounded="rounded-lg" />
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-green" />
          </Link>
        </Tooltip>
        <Tooltip content={t("account.switch")} side="right">
          <button
            type="button"
            onClick={openSwitch}
            className="flex size-8 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label={t("account.switch")}
          >
            <ArrowLeftRight className="size-3.5" />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="mb-1.5 rounded-xl border border-line bg-surface-2/45 p-2.5">
      <div className="flex items-center gap-2.5">
        <Link
          to="/profile"
          onClick={onNavigate}
          className="relative flex shrink-0 items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-violet"
          aria-label={linked.name}
        >
          <PlayerAvatar uuid={linked.uuid} name={linked.name} size={34} rounded="rounded-lg" />
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-green" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/profile"
            onClick={onNavigate}
            className="block truncate text-[12px] font-medium text-fg hover:text-violet"
          >
            {linked.name}
          </Link>
          <p className="flex items-center gap-1 truncate text-[10px] text-fg-subtle">
            <Link2 className="size-2.5 shrink-0" />
            <span className="truncate">
              {linked.profileName ?? t("account.profileLabel")}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-red/10 hover:text-red"
          aria-label={t("account.unlink")}
          title={t("account.unlink")}
        >
          <Unlink className="size-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={openSwitch}
        className={cn(
          "mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg",
        )}
      >
        <ArrowLeftRight className="size-3.5" />
        {t("account.switch")}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("account.unlinkTitle")}
        description={t("account.unlinkDesc")}
        confirmLabel={t("account.unlinkConfirm")}
        destructive
        onConfirm={() => {
          const uuid = linked.uuid;
          setLinkedProfile(null);
          clearTransientAccountCaches(queryClient, uuid);
          setConfirmOpen(false);
          toast.success(t("account.unlinked"));
        }}
      />
    </div>
  );
}
