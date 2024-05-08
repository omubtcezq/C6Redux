"""

"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import api.c6redux_api

# Whole app serves static html/css/js front end as well as the api it queries
app = FastAPI(title="C6Redux")

# Api is mounted on /api, the rest is static
app.mount("/api", api.c6redux_api.app)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
