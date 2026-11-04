"""Small worker-built search keys; never decode NBT in an HTTP search."""

from __future__ import annotations

import base64
import gzip
import io
import re
import unicodedata

import nbtlib


def normalize(value: str) -> str:
    value = re.sub(r"§.", "", value)
    value = unicodedata.normalize("NFKC", value).casefold().replace("\u2019", "").replace("'", "")
    return " ".join(re.findall(r"[^\W_]+", value))


ALIASES = {"aotv": "aspect of the void", "aote": "aspect of the end"}


def query_tokens(value: str) -> list[str]:
    text = normalize(value)
    return ALIASES.get(text, text).split()


def search_key(raw: dict) -> tuple[str, bool]:
    auction_id = raw.get("uuid") or ""
    words = [raw.get("item_name") or "", auction_id, auction_id.replace("-", "")]
    identified = False
    blob = raw.get("item_bytes")
    if isinstance(blob, dict):
        blob = blob.get("data")
    try:
        if isinstance(blob, str) and len(blob) <= 262144:
            with gzip.GzipFile(fileobj=io.BytesIO(base64.b64decode(blob, validate=True))) as stream:
                data = stream.read(128 * 1024 + 1)
            if len(data) > 128 * 1024:
                raise ValueError("NBT too large")
            item = nbtlib.File.parse(io.BytesIO(data)).unpack()["i"][0]
            extra = item["tag"]["ExtraAttributes"]
            item_id = extra.get("id")
            if isinstance(item_id, str):
                identified = True
                words.extend(
                    [
                        item_id,
                        str(extra.get("uuid", "")),
                        str(extra.get("uuid", "")).replace("-", ""),
                        str(extra.get("modifier", "")),
                    ]
                )
                words.extend((extra.get("enchantments") or {}).keys())
                scrolls = extra.get("ability_scroll") or []
                if isinstance(scrolls, list):
                    words.extend(s for s in scrolls if isinstance(s, str))
    except Exception:
        # A bad item blob must not remove the otherwise searchable auction.
        identified = False
    return normalize(" ".join(word for word in words if isinstance(word, str))), identified
