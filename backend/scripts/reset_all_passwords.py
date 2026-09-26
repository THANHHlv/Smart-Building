"""Reset all users' passwords in PostgreSQL database to '123456'."""

import asyncio
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select, update
from app.core.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User


async def main():
    new_hash = hash_password("123456")
    async with async_session_factory() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print(f"Found {len(users)} users. Updating passwords to '123456'...")
        
        await session.execute(
            update(User).values(hashed_password=new_hash)
        )
        await session.commit()
        print(f"Successfully updated {len(users)} users. Default password is now '123456'.")


if __name__ == "__main__":
    asyncio.run(main())
