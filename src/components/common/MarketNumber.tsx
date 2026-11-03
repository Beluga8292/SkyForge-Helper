import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
export function MarketNumber({
  label,
  value,
  onChange,
  min = 0,
  max = 1e15,
  integer = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  integer?: boolean;
}) {
  const [draft, setDraft] = useState(String(value)),
    focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);
  const normalize = (n: number) => {
    const bounded = Math.max(min, Math.min(max, n));
    return integer ? Math.round(bounded) : bounded;
  };
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] text-fg-muted">{label}</span>
      <Input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={integer ? 1 : "any"}
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const n = Number(text);
          if (text !== "" && Number.isFinite(n) && n >= min && n <= max)
            onChange(integer ? Math.round(n) : n);
        }}
        onBlur={() => {
          focused.current = false;
          const n = draft.trim() ? Number(draft) : value;
          const normalized = Number.isFinite(n) ? normalize(n) : value;
          setDraft(String(normalized));
          onChange(normalized);
        }}
      />
    </label>
  );
}
