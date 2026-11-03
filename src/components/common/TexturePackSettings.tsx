import { useEffect, useRef, useState } from "react";
import { Image, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/locales";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldHint } from "@/components/ui/input";
import { InfoNote } from "@/components/common/States";
import { listRegistryMaterials } from "@/features/items/registry";
import {
  importTexturePack,
  removeTexturePack,
  texturePackMeta,
} from "@/features/textures/resolver";
import { initTextureCache, type PackMeta } from "@/features/textures/storage";
import { vanillaStatus, warmVanillaMaterials } from "@/features/textures/vanilla";

export function TexturePackSettings() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<PackMeta | null>(null);
  const [importing, setImporting] = useState(false);
  const [vanillaBusy, setVanillaBusy] = useState(false);
  const [vanillaCount, setVanillaCount] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    void initTextureCache().then(() => {
      setMeta(texturePackMeta());
      void vanillaStatus().then((status) => setVanillaCount(status.ready ? status.count : null));
    });
  }, []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const imported = await importTexturePack(file);
      setMeta(imported);
      toast.success(t("settings.packImported"), {
        description: t("settings.packSummary", {
          items: imported.itemCount,
          materials: imported.materialCount,
          textures: imported.textureCount,
        }),
      });
    } catch (error) {
      toast.error(t("settings.packImportError"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setConfirmRemove(false);
    try {
      await removeTexturePack();
      setMeta(null);
      toast.success(t("settings.packRemoved"));
    } catch {
      toast.error(t("toasts.error"));
    }
  };

  const handleVanilla = async () => {
    setVanillaBusy(true);
    try {
      const result = await warmVanillaMaterials(listRegistryMaterials());
      const status = await vanillaStatus();
      setVanillaCount(status.ready ? status.count : null);
      toast.success(t("settings.vanillaReady", { count: status.count }), {
        description: `${result.loaded} textures · ${result.missing} missing · ${result.failed} failed`,
      });
    } catch {
      toast.error(t("toasts.error"));
    } finally {
      setVanillaBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-medium text-fg">{t("settings.texturePack")}</p>
        <FieldHint>{t("settings.texturePackHint")}</FieldHint>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.cats,application/zip"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
        >
          {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {importing ? t("settings.importingPack") : t("settings.importPack")}
        </Button>
        {meta ? (
          <Button size="sm" variant={confirmRemove ? "destructive" : "ghost"} onClick={() => void handleRemove()}>
            <Trash2 className="size-3.5" />
            {confirmRemove ? t("common.delete") : t("settings.removePack")}
          </Button>
        ) : null}
      </div>

      {meta ? (
        <div className="rounded-xl border border-line bg-surface-2/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={meta.source === "furfsky" ? "violet" : "cyan"}>
              <Image className="size-3" /> {meta.source === "furfsky" ? "FurfSky Reborn" : "Resource pack"}
            </Badge>
            <span className="truncate text-[11px] font-medium text-fg">{meta.name}</span>
          </div>
          <p className="mt-1.5 text-[10.5px] text-fg-subtle">
            {t("settings.packSummary", {
              items: meta.itemCount,
              materials: meta.materialCount,
              textures: meta.textureCount,
            })}
            {meta.unresolvedItems ? ` · ${meta.unresolvedItems} unresolved` : ""}
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-3 py-2 text-[10.5px] text-fg-subtle">
          {t("settings.packNone")}
        </p>
      )}

      <div className="border-t border-line pt-4">
        <p className="text-[12px] font-medium text-fg">{t("settings.vanillaTextures")}</p>
        <FieldHint>{t("settings.vanillaHint")}</FieldHint>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={vanillaBusy} onClick={() => void handleVanilla()}>
            {vanillaBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Image className="size-3.5" />}
            {vanillaBusy ? t("settings.vanillaPreparing") : t("settings.downloadVanilla")}
          </Button>
          {vanillaCount != null ? (
            <Badge variant="green">{t("settings.vanillaReady", { count: vanillaCount })}</Badge>
          ) : null}
        </div>
      </div>

      <InfoNote>{t("settings.textureSourcesNote")}</InfoNote>
    </div>
  );
}
