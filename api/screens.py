"""

"""

from sqlmodel import Session, select, or_, and_, not_, case, col, exists, alias, func
from fastapi import APIRouter, Depends
from enum import Enum
from pydantic import BaseModel, ConfigDict
from pydantic.functional_validators import model_validator
import api.db as db

# ============================================================================ #
# Screen search query type model
# ============================================================================ #

class BinOp(str, Enum):
    and_ = "and"
    or_ = "or"

class ChemicalPred(BaseModel):
    universal_quantification: bool = False
    name_search: str | None
    id: int | None
    conc: float | None
    units: str | None
    ph: float | None

    # To help with matching, don't allow extra params that might make another class match
    model_config = ConfigDict(extra='forbid')
    # Check some form of chemical identification is provided
    @model_validator(mode='after')
    def check_id_or_conc_or_ph(self):
        if self.id != None and self.name_search != None:
            raise ValueError("Cannot specify chemical with both id and name search!")
        if self.id == None and self.name_search == None and self.conc == None and self.ph == None:
            raise ValueError("Must specify chemical with at least one of id, name, concentration and unit, or ph!")
        if not((self.conc == None and self.units == None) or (self.conc != None and self.units != None)):
            raise ValueError("Chemical concentration and units must be either both or neither present!")
        return self

class ChemicalBinOp(BaseModel):
    op: BinOp
    arg_left: "ChemicalClause"
    arg_right: "ChemicalClause"

    # Help with matching
    model_config = ConfigDict(extra='forbid')

class ChemicalClause(BaseModel):
    negate: bool = False
    arg: ChemicalBinOp | ChemicalPred

    # Help with matching
    model_config = ConfigDict(extra='forbid')

class WellConditionPred(BaseModel):
    #include_similar: bool = False # TODO implement
    universal_quantification: bool = False
    id: int | None = None
    chems: ChemicalClause | None = None

    # To help with matching, don't allow extra params that might make another class match
    model_config = ConfigDict(extra='forbid')
    # Check that chemical information isn't provided if condition id is
    @model_validator(mode='after')
    def check_id_or_chemicals(self):
        if (self.id == None and self.chems == None) or (self.id != None and self.chems != None):
            raise ValueError("Must specify condition exclusively by either an id or by chemicals!")
        return self

class WellConditionBinOp(BaseModel):
    op: BinOp
    arg_left: "WellConditionClause"
    arg_right: "WellConditionClause"

    # Help with matching
    model_config = ConfigDict(extra='forbid')

class WellConditionClause(BaseModel):
    negate: bool = False
    arg: WellConditionBinOp | WellConditionPred

    # Help with matching
    model_config = ConfigDict(extra='forbid')

class ScreenQuery(BaseModel):
    #only_available: bool = False # TODO implement
    name_search: str | None = None
    owner_search: str | None = None
    conds: WellConditionClause | None = None

    # To help with matching, don't allow extra params that might make another class match
    model_config = ConfigDict(extra='forbid')
    # Check that some form of screen identification is provided for query
    @model_validator(mode='after')
    def check_name_or_conditions(self):
        if self.name_search == None and self.owner_search == None and self.conds == None:
            raise ValueError("Must specify screens by at least a name, owner name or by conditions!")
        return self

# Rebuild the classes with self reference (not sure if this is makes a difference)
ChemicalBinOp.model_rebuild()
WellConditionBinOp.model_rebuild()

# ============================================================================ #
# Screen search query parser
# ============================================================================ #

def parseScreenQuery(query: ScreenQuery):
    clauses = []
    if query.name_search != None:
        clauses.append(col(db.Screen.name).contains(query.name_search))
    if query.owner_search != None:
        clauses.append(col(db.Screen.owned_by).contains(query.owner_search))
    # Screen grouped and filtered by screens and conditions that meet query clauses
    if query.conds != None:
        well_ids = parseWellQuery(query.conds)
        clauses.append(col(db.Well.id).in_(well_ids))
        screens_counts = select(db.Screen, func.count(db.Well.id)).join(db.Well).where(*clauses).group_by(db.Screen).order_by(db.Screen.name)
    # Screen filtered by screen clauses only
    else:
        screens_counts = select(db.Screen, func.count(db.Well.id)).join(db.Well).where(*clauses).group_by(db.Screen).order_by(db.Screen.name)
    return screens_counts

def parseWellQuery(query: WellConditionClause):
    # Create clause tree for conditions
    if type(query.arg) == WellConditionBinOp:
        cond_clause = parseWellConditionBinOp(query.arg)
    else:
        cond_clause = parseWellConditionPred(query.arg)
    # Handle negation
    if query.negate:
        cond_clause = not_(cond_clause)
    cond_clause
    # Select only well ids for later 'in' clauses
    well_ids = select(db.Well.id).join(db.WellCondition).group_by(db.Well.id).having(cond_clause)
    return well_ids

def parseWellConditionBinOp(condexp: WellConditionBinOp):
    # Look at both sides of operator and add sub-clauses to list
    sub_clauses = []
    for logic in [condexp.arg_left, condexp.arg_right]:
        if type(logic.arg) == WellConditionBinOp:
            sub_clause = parseWellConditionBinOp(logic.arg)
        else:
            sub_clause = parseWellConditionPred(logic.arg)
        # Handle negation
        if logic.negate:
            sub_clause = not_(sub_clause)
        sub_clauses.append(sub_clause)
    # Combine sub-clauses with operator
    if condexp.op == BinOp.or_:
        clause = or_(*sub_clauses)
    else:
        clause = and_(*sub_clauses)
    return clause

def parseWellConditionPred(cond: WellConditionPred):
    # Selecting a specific well condition id
    conditions = select(db.WellCondition.id)
    # Either captured by an id
    if cond.id != None:
        conditions = conditions.where(db.WellCondition.id == cond.id)
    # Or by chemical information
    elif cond.chems != None:
        if type(cond.chems.arg) == ChemicalBinOp:
            chem_clause = parseChemicalBinOp(cond.chems.arg)
        else:
            chem_clause = parseChemicalPred(cond.chems.arg)
        # Handle negation
        if cond.chems.negate:
            chem_clause = not_(chem_clause)
        # Possible conditions are grouped and filtered by HAVING clause on chemical information
        conditions = conditions.join(db.WellCondition_Factor_Link).join(db.Factor).join(db.Chemical).group_by(db.WellCondition.id).having(chem_clause)

    # Expression for the number of conditions which meet criteria
    conditions_matched = func.sum(case((col(db.WellCondition.id).in_(conditions), 1), else_=0))
    # Either check if all condition met criteria (universal)
    if cond.universal_quantification:
        condition_clause = conditions_matched == func.count(db.WellCondition.id)
    # Or if any did (existential)
    else:
        condition_clause = conditions_matched > 0
    return condition_clause

def parseChemicalBinOp(chemexp: ChemicalBinOp):
    # Look at both sides of the operator and add sub-clauses to list
    sub_clauses = []
    for logic in [chemexp.arg_left, chemexp.arg_right]:
        if type(logic.arg) == ChemicalBinOp:
            sub_clause = parseChemicalBinOp(logic.arg)
        else:
            sub_clause = parseChemicalPred(logic.arg)
        # Handle negation
        if logic.negate:
            sub_clause = not_(sub_clause)
        sub_clauses.append(sub_clause)
    # Combine sub-clauses with operator
    if chemexp.op == BinOp.or_:
        clause = or_(*sub_clauses)
    else:
        clause = and_(*sub_clauses)
    return clause

def parseChemicalPred(chem: ChemicalPred):
    # Selecting a chemical by id, name search, conc/units or ph (or any combination of them except id AND name search)
    clause = True
    # Identify chemical
    if chem.id != None:
        clause = clause and db.Chemical.id == chem.id
    else:
        clause = clause and col(db.Chemical.id).contains(chem.name_search)
    # Specify concentration
    if chem.conc != None and chem.units != None:
        clause = clause and db.Chemical.conc == chem.conc and db.Chemical.units == chem.units
    # Specify ph
    if chem.ph != None:
        clause = clause and db.Chemical.ph == chem.ph
    # Expression for number of chemicals matched in a single condition
    chemicals_matched = func.sum(case((clause, 1), else_=0))
    # Either check if all chemicals met criteria (universal)
    if chem.universal_quantification:
        chem_clause = chemicals_matched == func.count(db.Chemical.id)
    # Or if any did (existential)
    else:
        chem_clause = chemicals_matched > 0
    return chem_clause

# ============================================================================ #
# API operations
# ============================================================================ #

router = APIRouter(
    prefix="/screens",
    tags=["Screen Operations"]
)

@router.get("/names", 
            summary="Gets a list of all screen names",
            response_description="List of all screen names",
            response_model=list[db.ScreenReadLite])
async def get_screen_names(*, session: Session=Depends(db.get_session)):
    """
    Gets a list of all screen names
    """
    statement = select(db.Screen).order_by(db.Screen.name)
    screens = session.exec(statement).all()
    return screens

@router.get("/wellNames", 
            summary="Gets a list of well names given a screen id",
            response_description="List of well names in specified screen",
            response_model=list[db.WellReadLite])
async def get_screen_well_names(*, session: Session=Depends(db.get_session), screen_id: int):
    """
    Gets a list of well names given a screen id
    """
    statement = select(db.Well).where(db.Well.screen_id == screen_id).order_by(db.Well.position_number)
    wells = session.exec(statement).all()
    return wells

@router.get("/all", 
            summary="Gets a list of all screens and the number of wells in each",
            response_description="List of all screens and the number of wells in each",
            response_model=list[tuple[db.ScreenRead, int]])
async def get_screens(*, session: Session=Depends(db.get_session)):
    """
    Gets a list of all screens and the number of wells in each
    """
    statement = select(db.Screen, func.count(db.Well.id)).join(db.Well).group_by(db.Screen).order_by(db.Screen.name)
    screens_counts = session.exec(statement).all()
    return screens_counts

@router.get("/subsets", 
            summary="Gets a list of screens and the number of wells in each that contain only conditions found in the specified screen",
            response_description="List of screens and the number of wells in each that contain only conditions found in the specified screen",
            response_model=list[tuple[db.ScreenRead, int]])
async def get_subset_screens(*, session: Session=Depends(db.get_session), screen_id: int):
    """
    Gets a list of screens and the number of wells in each that contain only conditions found in the specified screen
    """
    # Wellcondition of specified screen
    screen_conditions = select(db.WellCondition.id).join(db.Well).join(db.Screen).where(db.Screen.id == screen_id)
    # Screens, and well counts, which only have wellconditions that are also found in the specified screen
    statement = select(db.Screen, func.count(db.Well.id)).join(db.Well).join(db.WellCondition)\
                .where(db.Screen.id != screen_id)\
                .group_by(db.Screen)\
                .having(func.count(db.WellCondition.id) == func.sum(case((col(db.WellCondition.id).in_(screen_conditions), 1), else_=0)))
    # Execute and return
    screens_counts = session.exec(statement).all()
    return screens_counts

@router.get("/wells", 
             summary="Gets list of wells given a screen id",
             response_description="List of wells in specified screen",
             response_model=list[db.WellRead])
async def get_screen_wells(*, session: Session=Depends(db.get_session), screen_id: int):
    """
    Gets list of wells given a screen id
    """
    screen = session.get(db.Screen, screen_id)
    return screen.wells

@router.post("/query", 
             summary="Gets a list of screens filtered by a query and the number of wells matching the query",
             response_description="List of screens filtered by provided query and the number of wells matching the query",
             response_model=list[tuple[db.ScreenRead, int]])
async def get_screens_query(*, session: Session=Depends(db.get_session), query: ScreenQuery):
    """
    Gets a list of screens filtered by a query and the number of wells matching the query
    """
    # Parse Query for screens
    statement = parseScreenQuery(query)
    screens_counts = session.exec(statement).all()
    return screens_counts

@router.post("/wellQuery", 
             summary="Gets list of wells given a screen id filtered by a query",
             response_description="List of wells in specified screen filtered by provided query",
             response_model=list[db.WellRead])
async def get_screen_wells_query(*, session: Session=Depends(db.get_session), screen_id: int, well_query: WellConditionClause):
    """
    Gets list of wells given a screen id filtered by a query
    """
    # Parse Query for well ids
    well_ids = parseWellQuery(well_query)
    # Filter screen wells for those in query
    statement = select(db.Well).where(db.Well.screen_id == screen_id, col(db.Well.id).in_(well_ids)).order_by(db.Well.position_number)
    wells = session.exec(statement).all()
    return wells

# @router.get("/export", 
#             summary="Download a list of all screens",
#             response_description="File containing list of all screens")
# async def get_screens_export() -> str:
#     """
#     Produce and download an exported file of a list of all screens
#     """
#     return "Not yet implemented"

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