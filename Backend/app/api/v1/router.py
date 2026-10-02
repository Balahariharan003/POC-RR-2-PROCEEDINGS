"""
Consolidated API v1 Router.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    health,
    auth,
    users,
    pipeline,
    documents,
    templates,
    audit,
    chat,
    system,
    editor,
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="", tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["Pipeline"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(templates.router, prefix="/templates", tags=["Templates"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(system.router, prefix="/system", tags=["System"])
api_router.include_router(editor.router, prefix="/editor", tags=["Editor"])

