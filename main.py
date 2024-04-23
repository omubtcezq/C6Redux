from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import api

from fastapi.middleware.cors import CORSMiddleware

# Whole app serves static html/css/js as well as the api
app = FastAPI(title="whole app")
api_app = FastAPI(title="api")
api_app.include_router(api.router)

# Api is mounted on /api, the rest is static
app.mount("/api", api_app)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
