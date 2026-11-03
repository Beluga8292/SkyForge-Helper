"""Conservative exact-modifier comparables; listing medians are not sale prices.

The existing desktop NBT reader remains the Direct-mode decoder. Python uses
nbtlib rather than introducing a second hand-written NBT parser.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import io
import json
import math
import statistics
from typing import Any

import nbtlib

from app.schemas.market import Valuation

ALGORITHM = "auction-v1"
IGNORE = {"uuid", "timestamp", "originTag", "spawnedFor"}


def identity(raw: dict) -> tuple[str, str, int, dict[str, str]] | None:
    blob = raw.get("item_bytes")
    if isinstance(blob, dict):
        blob = blob.get("data")
    if not isinstance(blob, str) or len(blob) > 262144:
        return None
    try:
        compressed = base64.b64decode(blob, validate=True)
        with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
            data = stream.read(128 * 1024 + 1)
        if len(data) > 128 * 1024:
            return None
        root = nbtlib.File.parse(io.BytesIO(data)).unpack()
        item = root["i"][0]
        return identity_from_item(item, raw.get("tier"))
    except (Exception, RecursionError):
        return None


def identity_from_item(item: dict, rarity: str | None):
    extra = item["tag"]["ExtraAttributes"]
    item_id = extra.get("id")
    raw_count = item.get("Count", 1)
    if (
        not isinstance(raw_count, (int, float))
        or isinstance(raw_count, bool)
        or not math.isfinite(raw_count)
        or not float(raw_count).is_integer()
    ):
        return None
    count = int(raw_count)
    if not isinstance(item_id, str) or not item_id or not 1 <= count <= 64:
        return None
    mods = {key: value for key, value in extra.items() if key not in IGNORE and key != "id"}
    if item_id == "PET" and "petInfo" not in mods:
        return None
    if "petInfo" in mods:
        try:
            pet = json.loads(mods["petInfo"]) if isinstance(mods["petInfo"], str) else mods["petInfo"]
            if (
                not isinstance(pet, dict)
                or not isinstance(pet.get("type"), str)
                or not isinstance(pet.get("tier"), str)
                or not isinstance(pet.get("exp"), (int, float))
                or not math.isfinite(pet["exp"])
                or pet["exp"] < 0
            ):
                return None
            # Per-instance UUID does not determine pet stats; all other fields
            # (including XP, skin, candy, held item and unknown modifiers) remain exact.
            mods["petInfo"] = {k: v for k, v in pet.items() if k != "uuid"}
        except (ValueError, TypeError):
            return None
    # Include legacy enchantments/damage too. Unknown modifiers are kept, not silently discarded.
    signature = json.dumps(
        [
            item_id,
            rarity,
            count,
            item.get("Damage"),
            item["tag"].get("display", {}).get("color"),
            mods,
            item["tag"].get("ench"),
        ],
        sort_keys=True,
        default=str,
        separators=(",", ":"),
    )
    key = hashlib.sha256(signature.encode()).hexdigest()
    return key, item_id, count, {k: json.dumps(v, sort_keys=True, default=str) for k, v in mods.items()}


def median_without(prices: list[float], index: int) -> float:
    length = len(prices) - 1

    def at(i: int) -> float:
        return prices[i + (i >= index)]

    return at(length // 2) if length % 2 else (at(length // 2 - 1) + at(length // 2)) / 2


def value_snapshot(auctions: list[dict[str, Any]], now_ms: int, identities: dict | None = None) -> list[dict]:
    prepared = []
    groups: dict[str, list[tuple[float, str]]] = {}
    for raw in auctions:
        price = raw.get("starting_bid")
        if (
            not raw.get("bin")
            or raw.get("claimed")
            or not isinstance(price, int | float)
            or not math.isfinite(price)
            or price <= 0
            or not raw.get("end")
            or raw["end"] <= now_ms
        ):
            continue
        info = identities.get(raw["uuid"]) if identities is not None else identity(raw)
        prepared.append((raw, info))
        if info:
            groups.setdefault(info[0], []).append((float(price), raw["uuid"]))
    # One representative per seller prevents a single seller from dominating a median.
    sellers = {r["uuid"]: r.get("auctioneer") for r, _ in prepared}
    sorted_groups = {}
    for key, listings in groups.items():
        by_seller: dict[str, list[tuple[float, str]]] = {}
        for entry in listings:
            seller = sellers.get(entry[1])
            if seller:
                by_seller.setdefault(seller, []).append(entry)
        representatives = []
        for seller, entries in by_seller.items():
            entries.sort()
            price = statistics.median(p for p, _ in entries)
            representatives.append((price, seller, entries[len(entries) // 2][1]))
        sorted_groups[key] = sorted(representatives)
    price_groups = {key: [p for p, _, _ in values] for key, values in sorted_groups.items()}
    seller_indices = {
        key: {seller: i for i, (_, seller, _) in enumerate(values)} for key, values in sorted_groups.items()
    }
    results = []
    for raw, info in prepared:
        key, item_id, count, mods = info if info else (None, None, None, {})
        group = sorted_groups.get(key, []) if key else []
        own_seller = sellers.get(raw["uuid"])
        size = len(group) - 1 if own_seller and group else 0
        independent = size
        reference = None
        confidence = "insufficient"
        if size >= 5 and independent >= 3:
            prices = price_groups[key]
            index = seller_indices[key][own_seller]
            reference = median_without(prices, index)
            q1, q3 = prices[len(prices) // 4], prices[3 * len(prices) // 4]
            dispersion = (q3 - q1) / reference if reference else 1
            confidence = (
                "high"
                if size >= 20 and independent >= 10 and dispersion <= 0.15
                else ("medium" if size >= 8 and independent >= 5 and dispersion <= 0.3 else "low")
            )
        difference = reference - raw["starting_bid"] if reference else None
        result = Valuation(
            auction_id=raw["uuid"],
            item_id=item_id,
            name=raw.get("item_name") or item_id or raw["uuid"],
            rarity=raw.get("tier"),
            count=count,
            listing_price=raw["starting_bid"],
            reference_price=reference,
            difference=difference,
            discount_pct=difference / reference * 100 if reference else None,
            net_upside=None,
            confidence=confidence,
            sample_size=max(0, size),
            comparable_ids=[uid for _, seller, uid in group[:26] if seller != own_seller][:25],
            match_key=key,
            modifiers=mods,
            end=raw["end"],
            start=raw.get("start") or 0,
            reason="listing_median_not_sale" if reference else "insufficient_independent_comparables",
        )
        results.append(result.model_dump())
    return results
