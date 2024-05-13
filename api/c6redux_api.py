"""

"""

from fastapi import FastAPI
import api.screens as screens
# import stocks
# import chemicals

description = """
C6 Redux API markdown goes here
"""

app = FastAPI(title="C6Redux_API",
              summary="C6 reimplementation",
              description=description,
              version="alpha",
              contact={
                  "name": "Developer 1",
                  "url": "https://github.com/omubtcezq/C6Redux",
                  "email": "no.email@yet.com",
              })
app.include_router(screens.router)
# app.include_router(stocks.router)
# app.include_router(chemicals.router)
