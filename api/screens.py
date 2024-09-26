"""

"""

from sqlmodel import Session, select, case, col, func
from fastapi import APIRouter, Depends
from pydantic import BaseModel

import api.db as db
import api.recipes as recipes
import api.screen_query as screen_query

class QueryScreen(BaseModel):
    screen: db.ScreenRead
    well_match_counter: int

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
            summary="Gets a list of all screens and the number of wells in each",
            response_description="List of all screens and the number of wells in each",
            response_model=list[QueryScreen])
async def get_screens(*, session: Session=Depends(db.get_readonly_session)):
    """
    Gets a list of all screens and the number of wells in each
    """
    statement = select(db.Screen, func.count(db.Well.id)).join(db.Well).group_by(db.Screen).order_by(db.Screen.name)
    screens_counts = session.exec(statement).all()
    return [QueryScreen(screen=s, well_match_counter=c) for s,c in screens_counts]

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
                .having(func.count(db.WellCondition.id) == func.sum(case((col(db.WellCondition.id).in_(screen_conditions), 1), else_=0)))
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
    screen = session.get(db.Screen, screen_id)
    return screen.wells

@router.post("/query", 
             summary="Gets a list of screens filtered by a query and the number of wells matching the query",
             response_description="List of screens filtered by provided query and the number of wells matching the query",
             response_model=list[tuple[db.ScreenRead, int]])
async def get_screens_query(*, session: Session=Depends(db.get_readonly_session), query: screen_query.ScreenQuery):
    """
    Gets a list of screens filtered by a query and the number of wells matching the query
    """
    # Parse Query for screens
    statement = screen_query.parseScreenQuery(query)
    screens_counts = session.exec(statement).all()
    return screens_counts

@router.post("/wellQuery", 
             summary="Gets list of wells given a screen id filtered by a query",
             response_description="List of wells in specified screen filtered by provided query",
             response_model=list[db.WellRead])
async def get_screen_wells_query(*, session: Session=Depends(db.get_readonly_session), screen_id: int, well_query: screen_query.WellConditionClause):
    """
    Gets list of wells given a screen id filtered by a query
    """
    # Parse Query for well ids
    well_ids = screen_query.parseWellQuery(well_query)
    # Filter screen wells for those in query
    statement = select(db.Well).where(db.Well.screen_id == screen_id, col(db.Well.id).in_(well_ids)).order_by(db.Well.position_number)
    wells = session.exec(statement).all()
    return wells

@router.get("/conditionRecipe", 
             summary="Creates a recipe for making a condition specified by id",
             response_description="Stocks and their volumes required to make the specified condition",
             response_model=recipes.Recipe)
async def get_screen_wells(*, session: Session=Depends(db.get_readonly_session), condition_id: int):
    """
    Creates a recipe for making a condition specified by id
    """
    # TEMP hijack
    # stmnt = select(db.WellCondition).order_by(db.WellCondition.id)
    # wellconditions = session.exec(stmnt).all()
    # total = 0
    # no_factor_stocks = 0
    # failed_factors = []
    # all_overflow = 0
    # for wc in wellconditions:
    #     r = make_condition_recipe(session, wc.id)
    #     total += 1
    #     if not r.success:
    #         if r.msg == 'Could not find any combination of stocks that did not overflow!':
    #             all_overflow += 1
    #         else:
    #             no_factor_stocks += 1
    #             failed_factors.append(int(r.msg))
    # print('\n\nTOTAL:', total)
    # print('NO STOCKS FOR A FACTOR:', no_factor_stocks)
    # print('ALL STOCKS OVERFLOW:', all_overflow, '\n\n')
    # print(failed_factors, '\n\n')

    return recipes.make_condition_recipe(session, condition_id)

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