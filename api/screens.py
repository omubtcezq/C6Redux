"""

"""

from sqlmodel import Session, select, or_, and_, case, col, func
from fastapi import APIRouter, Depends
from enum import Enum
from pydantic import BaseModel, ConfigDict
from pydantic.functional_validators import model_validator
import api.db as db

# ============================================================================ #
# Screen search query type model
# ============================================================================ #

class LogicExpOp(str, Enum):
    and_ = "and"
    or_ = "or"

class ChemicalArg(BaseModel):
    id: int | None
    conc: float | None
    units: str | None
    ph: float | None
    # To help with mathcing, don't allow extra params that might make another class match
    model_config = ConfigDict(extra='forbid')
    # Check some form of chemical identification is provided
    @model_validator(mode='after')
    def check_id_or_conc_or_ph(self):
        if self.id == None and self.conc == None and self.ph == None:
            raise ValueError("Must specify chemical with at least one of id, concentration and unit, or ph!")
        if not((self.conc == None and self.units == None) or (self.conc != None and self.units != None)):
            raise ValueError("Chemical concentration and units must be either both or neither present!")
        return self

class ChemicalLogicExp(BaseModel):
    op: LogicExpOp
    arg_left: "ChemicalLogicExp | ChemicalArg"
    arg_right: "ChemicalLogicExp | ChemicalArg"
    model_config = ConfigDict(extra='forbid')

class WellConditionArg(BaseModel):
    id: int | None = None
    include_similar: bool = False
    chems: ChemicalLogicExp | ChemicalArg | None = None
    # To help with mathcing, don't allow extra params that might make another class match
    model_config = ConfigDict(extra='forbid')
    # Check that chemical information isn't provided if condition id is
    @model_validator(mode='after')
    def check_id_or_chemicals(self):
        if (self.id == None and self.chems == None) or (self.id != None and self.chems != None):
            raise ValueError("Must specify condition exclusively by either an id or by chemicals!")
        return self

class WellConditionLogicExp(BaseModel):
    op: LogicExpOp
    arg_left: "WellConditionLogicExp | WellConditionArg"
    arg_right: "WellConditionLogicExp | WellConditionArg"
    model_config = ConfigDict(extra='forbid')

class ScreenQuery(BaseModel):
    name: str | None = None
    only_available: bool = False
    conds: WellConditionLogicExp | WellConditionArg | None = None
    # To help with mathcing, don't allow extra params that might make another class match
    model_config = ConfigDict(extra='forbid')
    # Check that some form of screen identification is provided for query
    @model_validator(mode='after')
    def check_name_or_conditions(self):
        if self.name == None and self.conds == None:
            raise ValueError("Must specify screens by at least a name or by conditions!")
        return self

# Rebuild the classes with self reference (not sure if this is makes a difference)
ChemicalLogicExp.model_rebuild()
WellConditionLogicExp.model_rebuild()

# ============================================================================ #
# Screen search query parser
# ============================================================================ #

def parseQuery(query: ScreenQuery):
    # Create clause tree for conditions
    if type(query.conds) == WellConditionLogicExp:
        clauses = parseWellConditionLogicExp(query.conds)
    else:
        clauses = parseWellConditionArg(query.conds)
    # Final statement groups by screen
    screens = select(db.Screen).join(db.Well).join(db.WellCondition).where(clauses).group_by(db.Screen)
    return screens

def parseWellConditionLogicExp(condexp: WellConditionLogicExp):
    # Look at both sides of operator and add sub-clauses to list
    sub_clauses = []
    for arg in [condexp.arg_left, condexp.arg_right]:
        if type(arg) == WellConditionLogicExp:
            sub_clauses.append(parseWellConditionLogicExp(arg))
        else:
            sub_clauses.append(parseWellConditionArg(arg))
    # Combine sub-clauses with operator
    if condexp.op == LogicExpOp.or_:
        clause = or_(*sub_clauses)
    else:
        clause = and_(*sub_clauses)
    return clause

def parseWellConditionArg(cond: WellConditionArg):
    # Selecting a specific well condition id
    conditions = select(db.WellCondition.id)
    # Either captured by an id
    if cond.id != None:
        conditions = conditions.where(db.WellCondition.id == cond.id)
    # Or by chemical information
    elif cond.chems != None:
        if type(cond.chems) == ChemicalLogicExp:
            clauses = parseChemicalLogicExp(cond.chems)
        else:
            clauses = parseChemicalArg(cond.chems)
        # Possible conditions are grouped and filtered by HAVING clause on chemical information
        conditions = conditions.join(db.WellCondition_Factor_Link).join(db.Factor).join(db.Chemical).group_by(db.WellCondition.id).having(clauses)
    # Condition expression is checking if the condition is in the produced list
    condition_sub_clause = col(db.WellCondition.id).in_(conditions)
    return condition_sub_clause

def parseChemicalLogicExp(chemexp: ChemicalLogicExp):
    # Look at both sides of the operator and add sub-clauses to list
    sub_clauses = []
    for arg in [chemexp.arg_left, chemexp.arg_right]:
        if type(arg) == ChemicalLogicExp:
            sub_clauses.append(parseChemicalLogicExp(arg))
        else:
            sub_clauses.append(parseChemicalArg(arg))
    # Combine sub-clauses with operator
    if chemexp.op == LogicExpOp.or_:
        clause = or_(*sub_clauses)
    else:
        clause = and_(*sub_clauses)
    return clause

def parseChemicalArg(chem: ChemicalArg):
    # Selecting a chemical by id, conc/units or ph (or any combination of them)
    match_conditions = True
    if chem.id != None:
        match_conditions = match_conditions and db.Chemical.id == chem.id
    if chem.conc != None and chem.units != None:
        match_conditions = match_conditions and db.Chemical.conc == chem.conc and db.Chemical.units == chem.units
    if chem.ph != None:
        match_conditions = match_conditions and db.Chemical.ph == chem.ph
    # Chemical expression is true if the selected chemical is present in any factor for a condition (used after GROUP BY)
    literal = func.max(case((match_conditions, 1), else_=0))==1
    return literal

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
    # Parse Query here
    statement = parseQuery(query)
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