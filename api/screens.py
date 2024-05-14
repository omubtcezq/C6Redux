"""

"""

from sqlmodel import Session, select, or_
from fastapi import APIRouter, Depends
from enum import Enum
from pydantic import BaseModel
import api.db as db

class LogicExpOp(str, Enum):
    and_ = "and"
    or_ = "or"

class ChemicalArg(BaseModel):
    id: int | None
    name: str | None
    conc: float | None
    units: str | None
    ph: float | None

class ChemicalLogicExp(BaseModel):
    op: LogicExpOp
    arg_left: "ChemicalLogicExp | ChemicalArg"
    arg_right: "ChemicalLogicExp | ChemicalArg"

class WellConditionArg(BaseModel):
    id: int | None = None
    include_similar: bool = False
    chems: ChemicalLogicExp | ChemicalArg | None = None

class WellConditionLogicExp(BaseModel):
    op: LogicExpOp
    arg_left: "WellConditionLogicExp | WellConditionArg"
    arg_right: "WellConditionLogicExp | WellConditionArg"

class ScreenQuery(BaseModel):
    name: str | None = None
    only_available: bool = False
    conds: WellConditionLogicExp | WellConditionArg

def parseQuery(query: ScreenQuery):
    params = []
    parseWellConditionLogicExp(query.conds, params)

def parseWellConditionLogicExp(condexp: WellConditionLogicExp, clauses):
    sub_clauses = []
    for arg in [condexp.arg_left, condexp.arg_right]:
        if type(arg) == WellConditionLogicExp:
            parseWellConditionLogicExp(arg, sub_clauses)
        else:
            parseWellConditionArg(arg, sub_clauses)
    if condexp.op == LogicExpOp.or_:
        clauses.append(or_(sub_clauses))
    else:
        clauses += sub_clauses
    return clauses

def parseWellConditionArg(cond: WellConditionArg, clauses):
    if cond.id != None:
        clauses.append(db.WellCondition.id == cond.id) # match all screens where
    elif cond.chems != None:
        sub_clauses = []
        if type(cond.chems) == ChemicalLogicExp:
            parseChemicalLogicExp(cond.chems, sub_clauses)
        else:
            parseChemicalArg(cond.chems, sub_clauses)
        clauses.append(sub_clauses)
    return clauses

def parseChemicalLogicExp(chemexp: ChemicalLogicExp, params):
    if chemexp.op == LogicExpOp.and_:
        if type(chemexp.arg_left) == ChemicalLogicExp:
            parseChemicalLogicExp(chemexp.arg_left, params)
        else:
            parseChemicalArg(chemexp.arg_left, params)
    else:
        lparams=[]
        if type(chemexp.arg_left) == ChemicalLogicExp:
            parseChemicalLogicExp(chemexp.arg_left, lparams)
        else:
            parseChemicalArg(chemexp.arg_left, lparams)
        rparams = []
        if type(chemexp.arg_right) == ChemicalLogicExp:
            parseChemicalLogicExp(chemexp.arg_right, rparams)
        else:
            parseChemicalArg(chemexp.arg_right, rparams)
        params.append(or_(lparams, rparams))
    return params

def parseChemicalArg(chem: ChemicalArg, params):
    if chem.id != None:
        params.append(db.Chemical.id == chem.id)
    elif chem.name != None:
        params.append(db.Chemical.name == chem.name)
    if chem.conc != None and chem.units != None:
        params.append(db.Chemical.conc == chem.conc)
        params.append(db.Chemical.units == chem.units)
    if chem.ph != None:
        params.append(db.Chemical.ph == chem.ph)
    return params

# ============================================================================ #
# API operations
# ============================================================================ #

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
             response_description="List of queried screens",
             response_model=list[db.ScreenRead])
async def get_screens_query(*, session: Session=Depends(db.get_session), query: ScreenQuery):
    """
    Get a list of screens filtered by query parameters
    """
    statement = select(db.Screen)
    # Parse Query here
    screens = session.exec(statement).all()
    return screens

# @router.get("/export", 
#             summary="Download a list of all screens",
#             response_description="File containing list of all screens")
# async def get_screens_export() -> str:
#     """
#     Produce and download an exported file of a list of all screens
#     """
#     return "Not yet implemented"

@router.get("/contents", 
             summary="Get the contents of a screen",
             response_description="Screen details and list of conditions",
             response_model=db.ScreenContentsRead)
async def get_screen_contents(*, session: Session=Depends(db.get_session), id: int):
    """
    Get the details and list of conditions of a screen given it's database id
    """
    screen = session.get(db.Screen, id)
    return screen

# @router.get("/recipe", 
#              summary="Download the recipes to make a screen",
#              response_description="File containing recipes for a screen")
# async def get_screen_recipes(*, session: Session=Depends(db.get_session), id: int):
#     """
#     Produce and download a file of recipes required to make all conditions in a screen given it's database id
#     """
#     return "Not yet implemented"

# @router.get("/report", 
#              summary="Download a report of requested conditions",
#              response_description="File containing details of requested conditions")
# async def get_conditions_report(*, session: Session=Depends(db.get_session), cond_id: list[int]):
#     """
#     Produce and download a file containing details of conditions given their database id's
#     """
#     return "Not yet implemented"

# @router.get("/generate", 
#              summary="Create a screen design based on chosen conditions",
#              response_description="Unsaved screen based on chosen conditions")
# async def generate_screen(*, session: Session=Depends(db.get_session), cond_id: list[int]):
#     """
#     Generate a new screen design around the supplied conditions without saving it to the database
#     """
#     return "Not yet implemented"