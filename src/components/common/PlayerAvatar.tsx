import { cn } from "@/utils/cn";

/**
 * Minecraft head with a deterministic initial fallback. The remote avatar is
 * optional: if it is blocked or offline the initial stays visible.
 */
export function PlayerAvatar({
  uuid,
  name,
  size = 32,
  className,
  rounded = "rounded-lg",
}: {
  uuid?: string | null;
  name?: string | null;
  /** Rendered CSS size in pixels (the remote image is requested at 2x). */
  size?: number;
  className?: string;
  rounded?: string;
}) {
  const label = (name ?? uuid ?? "?").slice(0, 1).toUpperCase();
  const pixel = Math.max(16, Math.round(size * 2));
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-line bg-gradient-to-br from-violet/30 to-cyan/15 font-semibold uppercase text-fg",
        rounded,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      aria-hidden="true"
    >
      <span>{label}</span>
      {uuid ? (
        <img
          src={`https://mc-heads.net/avatar/${encodeURIComponent(uuid)}/${pixel}`}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full object-cover [image-rendering:pixelated]"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}
