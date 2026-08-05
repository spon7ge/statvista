"""Shared FastAPI dependencies.

Routes may keep calling ``app.core.db`` directly; migrate to Depends here
incrementally — do not rewrite all routes in the scaffolding step.
"""
