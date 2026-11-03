import asyncio
import contextlib
import signal

import httpx
from app.container import Container
from app.workers.jobs import JobRunner
from qa_http_app import handle, qa_settings


async def main():
    container = await Container.create(
        qa_settings(), transport=httpx.MockTransport(handle)
    )
    runner = JobRunner(container)
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, runner.stop)
    try:
        await runner.run()
    finally:
        await container.close()


asyncio.run(main())
