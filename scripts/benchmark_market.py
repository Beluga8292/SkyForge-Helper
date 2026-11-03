"""Synthetic Stage 3 CPU/cache benchmark. No live upstream or production writes."""
from __future__ import annotations

import asyncio
import json
import statistics
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.cache.service import CacheResult
from app.container import Container
from app.core.config import Settings
from app.schemas.market import FlipRequest
from app.services.market.flip_engine import calculate
from tests.conftest import MockUpstream
from tests.test_market import blob, product

async def main():
    started=time.perf_counter()
    results=[calculate(f'ITEM_{i}',product(),FlipRequest()) for i in range(2201)]
    flip_ms=(time.perf_counter()-started)*1000
    now=time.time();encoded=[blob(f'ITEM_{i}') for i in range(500)]
    lots=[{'uuid':f'a{i}','item_name':f'Item {i%500}','tier':'LEGENDARY','bin':True,
        'starting_bid':100_000+(i%37)*100,'item_bytes':encoded[i%500],
        'end':int((now+3600)*1000),'start':int(now*1000),'auctioneer':f'seller{i}'} for i in range(50000)]
    with tempfile.TemporaryDirectory(dir=ROOT/'.verification') as directory:
        settings=Settings(_env_file=None,environment='test',database_url=f'sqlite+aiosqlite:///{directory}/bench.db',
            redis_url='',auto_create_tables=True,log_level='ERROR')
        c=await Container.create(settings,transport=MockUpstream().transport())
        c.auctions.get_snapshot=AsyncMock(return_value=CacheResult(value={'snapshot_id':'synthetic-50k','auctions':lots},
            status='hit',fetched_at=now,stored_at=now,cache_age_ms=0,stale=False,source='memory'))
        try:
            started=time.perf_counter();cold=await c.market.auctions(min_discount=-100)
            cold_ms=(time.perf_counter()-started)*1000
            warm=[]
            for _ in range(20):
                started=time.perf_counter();await c.market.auctions(min_discount=0)
                warm.append((time.perf_counter()-started)*1000)
            output={'fixture':True,'bazaar_products':len(results),'bazaar_cold_ms':round(flip_ms,2),
                'auction_listings':len(lots),'auction_cold_decode_and_index_ms':round(cold_ms,2),
                'auction_analysis_limited':cold.analysis_limited,'auction_warm_p50_ms':round(statistics.median(warm),2),
                'auction_warm_p95_ms':round(sorted(warm)[18],2),'warm_requests':20,
                'note':'Python service in process, synthetic NBT fixtures; not production throughput or browser frame timing'}
            (ROOT/'.verification/stage3-performance.json').write_text(json.dumps(output,indent=2))
            print(json.dumps(output,indent=2))
        finally:await c.close()

asyncio.run(main())
