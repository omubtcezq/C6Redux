"""

"""

from fastapi import FastAPI
import api.screens as screens
# import stocks
# import chemicals

app = FastAPI(title="C6Redux_API")
app.include_router(screens.router)
# app.include_router(stocks.router)
# app.include_router(chemicals.router)
