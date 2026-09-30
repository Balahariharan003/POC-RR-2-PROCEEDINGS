"""
Root Application Forwarder.
Exposes the clean architecture FastAPI application from app.main.
Allows running:
    uvicorn main:app --reload
or:
    uvicorn app.main:app --reload
"""

import uvicorn
from app.main import app
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
