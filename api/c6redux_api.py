"""

"""

from fastapi import FastAPI
import api.screens as screens
import api.stocks as stocks
import api.chemicals as chemicals
import api.authentication as authentication

API_TITLE = "C6Redux_API"
API_VERSION = "v0.1.6"
API_DISPLAY_URL = "https://www.c6redux.au/api"
API_SUMMARY = "API providing reimplementation of key functions from defunct protein crystallography website C6."
API_DESCRIPTION = """
# API Functions
The provided functions in this API are grouped into the following categories:
- Screen Operations
- Stock Operations
- Chemical Operations
- Authentication Operations
- API Operations

## Screen Operations
These API calls are related to working with crystallisation screens (chemical designs for crystal imaging plates) stored in our database. They include functions for:
- Reading, creating, editing and removing of screens
- Complex screen searching (by specifying first order logic of chemicals and referenced screen conditions)
- Recipe generation of screen conditions using stored stock information

## Stock Operations
These API calls are related to working with chemical stocks stored in our database. They include functions for:
- Reading, creating, editing and removing of stocks

## Chemical Operations
These API calls are related to working with chemicals stored in our database. They include functions for:
- Reading, creating, editing and removing of chemicals
- Reading, creating, editing and removing of chemical pH curves

## Authentication Operations
These API calls are for user authentication. All API calls that make modifications to the database (creating, editing and removing) require users to be authenticated and a valid token to be provided when making calls.

## API Operations
These API calls are for API specific functions.

# Broader Project
Although the API is a standalone service, a front-end user-interface is being simultaneously developed that makes use of this API. The codebase and documentation for both the front-end site and this API can be found on [GitHub](https://github.com/omubtcezq/C6Redux) while the front-end site itself can be visited at [c6redux.au](https://www.c6redux.au).
"""

app = FastAPI(title = API_TITLE,
              summary = API_SUMMARY,
              description = API_DESCRIPTION,
              version = API_VERSION,
              servers=[
                  {"url": API_DISPLAY_URL}
              ],
              root_path_in_servers = False,
              contact = {
                  "name": "Dr Marko Ristic",
                  "url": "https://github.com/omubtcezq/C6Redux"
              },
              license={
                  "name": "GNU GPLv3",
                  "identifier": "GPL-3.0-or-later"
              })
app.include_router(screens.router)
app.include_router(stocks.router)
app.include_router(chemicals.router)
app.include_router(authentication.router)

@app.get('/api_version',
         summary="Gets the version number of the API",
         response_description="API version as string",
         tags=["API Operations"])
async def get_version() -> str:
    """
    Gets the version number of the API
    """
    return API_VERSION