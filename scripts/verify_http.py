# ruff: noqa: ASYNC220, ASYNC221, ASYNC230, SIM115
"""Actual loopback TCP integration/load against synthetic upstream; never loads Hypixel key."""

import asyncio
import json
import os
import socket
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


async def main():
    results = []
    latencies = []
    with tempfile.TemporaryDirectory(prefix="sbc-qa-") as directory:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = {
            **os.environ,
            "PYTHONPATH": str(ROOT / "backend") + os.pathsep + str(ROOT / "scripts"),
            "SBC_QA_DB": str(Path(directory) / "qa.db"),
            "REDIS_URL": "",
            "HYPIXEL_API_KEY": "",
        }
        log = open(ROOT / ".verification/stage5-http-server.log", "w")
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "qa_http_app:create_qa_app",
                "--factory",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            env=env,
            cwd=ROOT,
            stdout=log,
            stderr=log,
        )
        try:
            async with httpx.AsyncClient(
                base_url=f"http://127.0.0.1:{port}", timeout=15
            ) as client:
                for _ in range(100):
                    try:
                        if (await client.get("/api/v1/health")).status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    await asyncio.sleep(0.1)
                else:
                    raise RuntimeError("QA server startup failed")

                async def check(path, status=200):
                    start = time.perf_counter()
                    r = await client.get(
                        "/api/v1/" + path,
                        headers={"X-Request-ID": "stage5-socket-test"},
                    )
                    latencies.append((time.perf_counter() - start) * 1000)
                    assert r.status_code == status, (path, r.status_code, r.text[:100])
                    assert r.headers.get("x-request-id") == "stage5-socket-test"
                    assert "synthetic-fixture-only" not in r.text
                    results.append(
                        {"path": path, "status": r.status_code, "result": "PASS"}
                    )
                    return r

                for path in [
                    "health",
                    "status",
                    "bazaar",
                    "auctions?page_size=2",
                    "market/status",
                    "market/overview",
                    "market/bazaar/flips?page_size=2",
                    "market/bazaar/ENCHANTED_DIAMOND/analytics",
                    "market/bazaar/ENCHANTED_DIAMOND/signals",
                    "market/auctions/opportunities?page_size=2",
                    "intelligence/status",
                ]:
                    await check(path)
                base = "intelligence/players/0123456789abcdef0123456789abcdef/profiles/fedcba9876543210fedcba9876543210/"
                for section in [
                    "overview",
                    "recommendations",
                    "accessories",
                    "dungeons",
                    "slayers",
                    "pets",
                    "networth",
                ]:
                    await check(base + section)
                await check("market/bazaar/flips?page_size=999", 422)
                await check(
                    "intelligence/players/invalid/profiles/invalid/overview", 422
                )
                await client.post("/qa/control/invalid_profile")
                await check(base + "overview", 502)
                await client.post("/qa/control/private")
                await check(base + "accessories")
                await client.post("/qa/control/normal")
                for mode, expected in [
                    ("timeout", 504),
                    ("malformed", 502),
                    ("429", 503),
                ]:
                    await client.post("/qa/control/" + mode)
                    r = await client.get("/api/v1/bazaar")
                    assert r.status_code == expected, (
                        mode,
                        r.status_code,
                        r.text[:120],
                    )
                    results.append(
                        {"scenario": mode, "status": r.status_code, "result": "PASS"}
                    )
                await asyncio.sleep(
                    1.1
                )  # fixture Retry-After only, never sleeps against Hypixel.
                await client.post("/qa/control/normal")
                await check("bazaar")
                # Repeated concurrent calls use the real service/cache and a single socket server.
                before = (await client.get("/qa/counts")).json()["upstream_requests"]
                await asyncio.gather(*(check("bazaar") for _ in range(40)))
                after = (await client.get("/qa/counts")).json()["upstream_requests"]
                assert after == before
                # Inspect actual process memory without treating it as production throughput.
                rss = (
                    int(
                        subprocess.check_output(
                            ["ps", "-o", "rss=", "-p", str(process.pid)]
                        ).strip()
                    )
                    if sys.platform != "win32"
                    else None
                )
                await client.post("/qa/control/rate")
                limited = await client.get("/api/v1/bazaar")
                assert limited.status_code == 429 and limited.headers.get("retry-after")
                results.append(
                    {"scenario": "backend rate limit and Retry-After", "result": "PASS"}
                )
                # Rate limit recovery happens on a separately allowed public health path? Control is rate limited too:
                # wait is avoided by clearing through process restart below.
        finally:
            process.terminate()
            process.wait(timeout=15)
            log.close()
        result = {
            "fixture": True,
            "transport": "real localhost TCP / uvicorn; synthetic Hypixel MockTransport",
            "checks": results,
            "requests_measured": len(latencies),
            "p50_ms": round(statistics.median(latencies), 2),
            "p95_ms": round(sorted(latencies)[int(len(latencies) * 0.95)], 2),
            "rss_kib": rss,
            "errors": 0,
            "graceful_exit": process.returncode in (0, -15)
            and "Application shutdown complete"
            in (ROOT / ".verification/stage5-http-server.log").read_text(),
            "exit_code": process.returncode,
            "upstream_cache_load_requests": after - before,
        }
        assert result["graceful_exit"]
        (ROOT / ".verification/stage5-http.json").write_text(
            json.dumps(result, indent=2)
        )
        print(json.dumps({k: v for k, v in result.items() if k != "checks"}))


asyncio.run(main())
