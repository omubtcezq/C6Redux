"""

"""

from sqlmodel import Session, select, case, col, func
from sqlalchemy.orm import subqueryload
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

import api.db as db
import api.recipes as recipes
import api.screen_query as screen_query

class QueryScreen(BaseModel):
    screen: db.ScreenRead
    well_match_counter: int

class QueryFactor(BaseModel):
    factor: db.FactorRead
    well: db.WellReadLite
    query_match: bool | None

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
async def get_screen_names(*, session: Session=Depends(db.get_readonly_session)):
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
async def get_screen_well_names(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    Gets a list of well names given a screen id
    """
    statement = select(db.Well).where(db.Well.screen_id == screen_id).order_by(db.Well.position_number)
    wells = session.exec(statement).all()
    return wells

@router.get("/all", 
            summary="Gets a list of all screens",
            response_description="List of all screens",
            response_model=list[db.ScreenRead])
async def get_screens(*, session: Session=Depends(db.get_readonly_session)):
    """
    Gets a list of all screens
    """
    statement = select(db.Screen).join(db.Well).group_by(db.Screen).order_by(db.Screen.name).options(subqueryload(db.Screen.frequentblock))
    screens = session.exec(statement).all()
    return screens

@router.get("/subsets", 
            summary="Gets a list of screens and the number of wells in each that contain only conditions found in the specified screen",
            response_description="List of screens and the number of wells in each that contain only conditions found in the specified screen",
            response_model=list[tuple[db.ScreenRead, int]])
async def get_subset_screens(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    Gets a list of screens and the number of wells in each that contain only conditions found in the specified screen
    """
    # Wellcondition of specified screen
    screen_conditions = select(db.WellCondition.id).join(db.Well).join(db.Screen).where(db.Screen.id == screen_id)
    # Screens, and well counts, which only have wellconditions that are also found in the specified screen
    statement = select(db.Screen, func.count(db.Well.id)).join(db.Well).join(db.WellCondition)\
                .where(db.Screen.id != screen_id)\
                .group_by(db.Screen)\
                .having(func.count(db.WellCondition.id) == func.sum(case((col(db.WellCondition.id).in_(screen_conditions), 1), else_=0)))\
                .options(subqueryload(db.Screen.frequentblock))
    # Execute and return
    screens_counts = session.exec(statement).all()
    return screens_counts

@router.get("/wells", 
             summary="Gets list of wells given a screen id",
             response_description="List of wells in specified screen",
             response_model=list[db.WellRead])
async def get_screen_wells(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    Gets list of wells given a screen id
    """
    screen = session.get(db.Screen, screen_id)#.options(subqueryload(db.Screen.wells).subqueryload(db.Well.wellcondition).subqueryload(db.WellCondition.factors))
    return screen.wells

@router.post("/query", 
             summary="Gets a list of screen query objects including the number of matching wells filtered by a query",
             response_description="List of screen query objects including number of matching wells filtered by provided query",
             response_model=list[QueryScreen])
async def get_screens_query(*, session: Session=Depends(db.get_readonly_session), query: screen_query.ScreenQuery):
    """
    List of screen query objects including number of matching wells filtered by provided query
    """
    # Parse Query for screens
    if query:
        statement = screen_query.parseScreenQuery(query).options(subqueryload(db.Screen.frequentblock))
    else:
        statement = select(db.Screen, func.count(db.Well.id)).join(db.Well).group_by(db.Screen).order_by(db.Screen.name).options(subqueryload(db.Screen.frequentblock))
    screens_counts = session.exec(statement).all()
    return [QueryScreen(screen=s, well_match_counter=c) for s,c in screens_counts]

@router.post("/factorQuery", 
             summary="Gets list of well query objects for a given screen each flagged whether it meets the passed condition query",
             response_description="List of well query objects for specified screen flagged if meeting provided query",
             response_model=list[QueryFactor])
async def get_screen_factors_query(*, session: Session=Depends(db.get_readonly_session), screen_id: int, well_query: screen_query.WellQuery):
    """
    List of well query objects for specified screen flagged if meeting provided query
    """
    if well_query.conds:
        # Parse Query for well ids
        well_ids = screen_query.parseRelevantWellQuery(well_query)
        statement = select(db.Well, case((col(db.Well.id).in_(well_ids), 1), else_=0)).where(db.Well.screen_id == screen_id).order_by(db.Well.position_number).options(subqueryload(db.Well.wellcondition).subqueryload(db.WellCondition.factors).subqueryload(db.Factor.chemical).subqueryload(db.Chemical.aliases))
        wells_flags = session.exec(statement).all()
        return [QueryFactor(factor=f, well=w, query_match=True if m else False) for w,m in wells_flags for f in w.wellcondition.factors]
    else:
        statement = select(db.Well).where(db.Well.screen_id == screen_id).order_by(db.Well.position_number).options(subqueryload(db.Well.wellcondition).subqueryload(db.WellCondition.factors).subqueryload(db.Factor.chemical).subqueryload(db.Chemical.aliases))
        wells = session.exec(statement).all()
        return [QueryFactor(factor=f, well=w, query_match=None) for w in wells for f in w.wellcondition.factors]

@router.get("/conditionRecipe", 
             summary="Creates a recipe for making a condition specified by id",
             response_description="Stocks and their volumes required to make the specified condition",
             response_model=recipes.Recipe)
async def get_condition_recipe(*, session: Session=Depends(db.get_readonly_session), condition_id: int):
    """
    Creates a recipe for making a condition specified by id
    """
    return recipes.make_condition_recipe(session, condition_id)

@router.post("/customConditionRecipe", 
             summary="Creates a recipe for making a condition specified by list of new factors",
             response_description="Stocks and their volumes required to make the specified condition",
             response_model=recipes.Recipe)
async def get_custom_condition_recipe(*, session: Session=Depends(db.get_readonly_session), custom_condition: recipes.CustomCondition):
    """
    Creates a recipe for making a condition specified by list of new factors
    """
    return recipes.make_custom_condition_recipe(session, custom_condition)

@router.post("/customConditionCustomStocksRecipe", 
             summary="Creates a recipe for making a condition specified by list of new condition factors using only stocks specified by a list of new stock factors",
             response_description="Stocks from the specified list of new stock factors and their volumes required to make the specified condition",
             response_model=recipes.Recipe)
async def get_custom_condition_custom_stocks_recipe(*, session: Session=Depends(db.get_readonly_session), custom_condition: recipes.CustomCondition, custom_stocks: recipes.CustomStocks):
    """
    Creates a recipe for making a condition specified by list of new condition factors using only stocks specified by a list of new stock factors
    """
    return recipes.make_custom_condition_custom_stocks_recipe(session, custom_condition, custom_stocks)

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
# async def get_screen_recipes(*, session: Session=Depends(db.get_readonly_session), id: int):
#     """
#     Produce and download a file of recipes required to make all conditions in a screen given it's database id
#     """
#     return "Not yet implemented"

# @router.get("/report", 
#              summary="Download a report of requested conditions",
#              response_description="File containing details of requested conditions")
# async def get_conditions_report(*, session: Session=Depends(db.get_readonly_session), cond_id: list[int]):
#     """
#     Produce and download a file containing details of conditions given their database id's
#     """
#     return "Not yet implemented"

# @router.get("/generate", 
#              summary="Create a screen design based on chosen conditions",
#              response_description="Unsaved screen based on chosen conditions")
# async def generate_screen(*, session: Session=Depends(db.get_readonly_session), cond_id: list[int]):
#     """
#     Generate a new screen design around the supplied conditions without saving it to the database
#     """
#     return "Not yet implemented"