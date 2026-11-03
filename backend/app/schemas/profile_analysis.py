from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

State = Literal["known", "unknown", "private", "not_supported", "not_applicable", "invalid"]


class Metric(BaseModel):
    id: str
    category: str
    value: float | None = None
    level: int | None = None
    target: float | None = None
    remaining: float | None = None
    progress: float | None = None
    state: State = "unknown"
    source: str
    scope: Literal["member", "shared"] = "member"


class Asset(BaseModel):
    key: str
    item_id: str
    name: str
    location: str
    category: str | None = None
    count: int = 1
    rarity: str | None = None
    modifiers: dict = Field(default_factory=dict)
    uuid: str | None = None
    match_key: str | None = None
    soulbound: bool = False
    value: float | None = None
    method: str = "unknown"
    confidence: str = "insufficient"
    price_timestamp: int | None = None


class Recommendation(BaseModel):
    id: str
    category: str
    subject: str
    current: float | None = None
    target: float | None = None
    remaining: float | None = None
    score: float
    status: Literal["available", "locked", "missing_data"] = "available"
    requirements: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    cost: float | None = None
    effort: float | None = None
    confidence: str = "medium"
    source: str
    reason: str


class AccessoryCandidate(BaseModel):
    item_id: str
    family: str
    rarity: str | None = None
    gain: float | None = None
    cost: float | None = None
    coins_per_point: float | None = None
    method: str = "unknown"
    confidence: str = "insufficient"
    requirements: list[str] = Field(default_factory=list)
    price_timestamp: int | None = None


class Pet(BaseModel):
    type: str
    rarity: str | None = None
    xp: float | None = None
    level: int | None = None
    next_xp: float | None = None
    remaining: float | None = None
    progress: float | None = None
    held_item: str | None = None
    active: bool | None = None
    state: State = "unknown"


class Networth(BaseModel):
    personal_liquid: float | None = None
    shared_bank: float | None = None
    tradable: float | None = None
    untradeable_count: int = 0
    unknown_count: int = 0
    priced_count: int = 0
    coverage: float | None = None
    known_total: float | None = None
    complete: bool = False


class Analysis(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["1"] = "1"
    rules_version: str
    uuid: str
    profile_id: str
    username: str | None = None
    profile_name: str | None = None
    profile_type: str | None = None
    coop: bool
    first_join: int | None = None
    last_save: int | None = None
    fetched_at: int
    stale: bool = False
    demo: bool = False
    source: str
    completeness: dict[str, State]
    metrics: list[Metric]
    assets: list[Asset]
    pets: list[Pet]
    recommendations: list[Recommendation]
    accessory_power: float | None = None
    accessory_power_known_subset: float | None = None
    accessories: list[AccessoryCandidate]
    networth: Networth
    warnings: list[str]
    selected_class: str | None = None
    floors: dict[str, float] = Field(default_factory=dict)
    minions: list[str] | None = None
