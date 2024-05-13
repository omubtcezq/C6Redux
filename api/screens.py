"""

"""

from sqlmodel import Session, select
from fastapi import APIRouter, Depends
from enum import Enum
from pydantic import BaseModel
import api.db as db

class QueryOp(str, Enum):
    and_op = "and"
    or_op = "or"

class ChemicalArg(BaseModel):
    id: int | None
    name: str | None
    conc: float | None
    units: str | None
    ph: float | None

class ChemicalLogicExp(BaseModel):
    op: QueryOp
    args: list["ChemicalLogicExp | ChemicalArg"]

class ConditionArg(BaseModel):
    id: int | None
    ref: str | None
    chems: ChemicalLogicExp

class ConditionLogicExp(BaseModel):
    op: QueryOp
    args: list["ConditionLogicExp | ConditionArg"]


router = APIRouter(
    prefix="/screens",
    tags=["Screen Operations"]
)

@router.get("/", 
            summary="Get a list of all screens",
            response_description="List of all screens",
            response_model=list[db.ScreenRead])
async def get_screens(*, session: Session=Depends(db.get_session)):
    """
    Get a list of all screens including frequent block information
    """
    statement = select(db.Screen)
    screens = session.exec(statement).all()
    return screens

@router.post("/", 
             summary="Get a list of screens filtered by query",
             response_description="List of queried screens")
async def get_screens_query(*, session: Session=Depends(db.get_session), query: ConditionLogicExp, only_available: bool = False, include_similar: bool = False):
    """
    Get a list of screens filtered by query parameters
    """
    statement = select(db.Screen)
    screens = session.exec(statement).all()
    ret = []
    for s in screens:
        ret.append({"screen":s, "frequentblock":s.frequentblock})
    return ret


@router.get("/export", 
            summary="Download a list of all screens",
            response_description="File containing list of all screens")
async def get_screens_export() -> str:
    """
    Produce and download an exported file of a list of all screens
    """
    return "Not yet implemented"

@router.get("/contents", 
             summary="Get the contents of a screen",
             response_description="Screen details and list of conditions")
async def get_screen_contents(*, session: Session=Depends(db.get_session), id: int) -> str:
    """
    Get the details and list of conditions of a screen given it's database id
    """
    return "Not yet implemented"

@router.get("/recipe", 
             summary="Download the recipes to make a screen",
             response_description="File containing recipes for a screen")
async def get_screen_recipes(*, session: Session=Depends(db.get_session), id: int) -> str:
    """
    Produce and download a file of recipes required to make all conditions in a screen given it's database id
    """
    return "Not yet implemented"

@router.get("/report", 
             summary="Download a report of requested conditions",
             response_description="File containing details of requested conditions")
async def get_conditions_report(*, session: Session=Depends(db.get_session), cond_id: list[int]) -> str:
    """
    Produce and download a file containing details of conditions given their database id's
    """
    return "Not yet implemented"

@router.get("/generate", 
             summary="Create a screen design based on chosen conditions",
             response_description="Unsaved screen based on chosen conditions")
async def generate_screen(*, session: Session=Depends(db.get_session), cond_id: list[int]) -> str:
    """
    Generate a new screen design around the supplied conditions without saving it to the database
    """
    return "Not yet implemented"