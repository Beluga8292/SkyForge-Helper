"""Synthetic public-shaped fixtures only. No profile polling or production DB writes."""
from __future__ import annotations
import copy
import json
import statistics
import time
from pathlib import Path
from tests.test_intelligence import profile, UUID, ITEMS, RESOURCES
from app.services.intelligence.normalize import normalize
from app.services.intelligence.valuation import enrich
import base64,gzip,io,nbtlib
item=nbtlib.Compound({'Count':nbtlib.Byte(1),'Damage':nbtlib.Short(0),'tag':nbtlib.Compound({'ExtraAttributes':nbtlib.Compound({'id':nbtlib.String('ENCHANTED_DIAMOND')})})})
root=nbtlib.File({'i':nbtlib.List[nbtlib.Compound]([copy.deepcopy(item) for _ in range(1000)])})
buf=io.BytesIO();root.write(buf);blob=base64.b64encode(gzip.compress(buf.getvalue(),mtime=0)).decode()
raw=profile();inventory=raw['members'][UUID]['inventory'];inventory['bag_contents']={'talisman_bag':{'data':blob}}
for key in ['inv_contents','inv_armor','equipment_contents','ender_chest_contents','wardrobe_contents']:inventory[key]={'data':blob}
raw['members'][UUID]['pets_data']={'pets':[]}
samples=[]
for _ in range(5):
 start=time.perf_counter();a=normalize(raw,UUID,RESOURCES['skills'],ITEMS,10000);enrich(a,ITEMS);samples.append((time.perf_counter()-start)*1000)
assert len(a.assets)==6000
result={'fixture':True,'inventory_entries':6000,'sections':6,'runs':5,'cold_ms':round(samples[0],2),'p50_ms':round(statistics.median(samples),2),'max_ms':round(max(samples),2),'note':'Python normalization+NBT+advisor+partial valuation, in process; not live throughput or UI frame timing'}
Path('.verification/stage4-performance.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
Path('src/features/intelligence/test-large-inventory.json').write_text(json.dumps({'data':blob}))
