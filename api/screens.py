"""

"""

from sqlmodel import Session, select, case, col, func, distinct, intersect
from sqlalchemy.orm import subqueryload, selectinload
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Annotated
from asyncache import cached
from cachetools.keys import hashkey
from cachetools import LRUCache

import api.db as db
import api.recipes as recipes
import api.screen_query as screen_query
import api.screen_maker as screen_maker
import api.units_and_buffers as unbs
import api.condition_helper as ch
import api.condition_distance as condition_distance

import time

class QueryScreen(BaseModel):
    screen: db.ScreenRead
    well_match_counter: int
    screen_id: int

class QueryFactor(BaseModel):
    factor: db.FactorRead
    well: db.WellReadLite
    query_match: bool | None

class ScreenStats(BaseModel):
    num_conditions: int
    unique_chemicals: int
    avg_factors_per_condition: float

class ChemicalInfoBase(BaseModel):
    ph_min: float | None
    ph_max: float | None
    conc_min: float | None
    conc_max: float | None
    appearances: int

class ChemicalInfo(ChemicalInfoBase):
    chemical: db.ChemicalReadLite

class ChemicalCompare(BaseModel):
    chemical: db.ChemicalReadLite
    screen_info1: ChemicalInfoBase
    screen_info2: ChemicalInfoBase

class ConditionCompare(BaseModel):
    well1: db.WellRead
    well2: db.WellRead


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
            summary="Gets a list of screens that contain only conditions found in the specified screen",
            response_description="List of screens that contain only conditions found in the specified screen",
            response_model=list[QueryScreen])
@cached(cache=LRUCache(maxsize= 125), key = lambda *args, **kwargs: hashkey(kwargs["screen_id"]))
async def get_subset_screens(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    Gets a list of screens and the number of wells in each that contain only conditions found in the specified screen
    """
    statement = (
    select(db.Screen).join(db.Well).group_by(db.Screen).order_by(db.Screen.name)
    .options(
        subqueryload(db.Screen.wells)
        .subqueryload(db.Well.wellcondition)
        .subqueryload(db.WellCondition.factors)
        .subqueryload(db.Factor.chemical),
        subqueryload(db.Screen.frequentblock),
    ))
    screens = session.exec(statement).all()
    statement = select(db.Screen).where(db.Screen.id == screen_id).options(
        subqueryload(db.Screen.wells)
        .subqueryload(db.Well.wellcondition)
        .subqueryload(db.WellCondition.factors)
        .subqueryload(db.Factor.chemical),
        subqueryload(db.Screen.frequentblock),
    )
    comparison_screen = session.exec(statement).one()

    subset_screens = []
    for screen in screens:
        if screen.id == comparison_screen.id:
            continue
        is_subset = True
        for i in range(len(comparison_screen.wells) - 1, -1, -1):
            well_a = comparison_screen.wells[i]
            match = False
            # Look for a match in list_b
            for j, well_b in enumerate(screen.wells):
                if ch.condition_equality(well_a.wellcondition, well_b.wellcondition):
                    # Match found: delete from both to maintain 1:1 equality
                    del comparison_screen.wells[i]
                    del screen.wells[j]
                    match = True
                    break  # Stop looking for a match for this specific item_a
            if not match:
                break
            if len(screen.wells) == 0:
                subset_screens.append(screen)

        
    
    return [QueryScreen(screen=s, well_match_counter=0, screen_id=s.id) for s in subset_screens]

    # # Wellcondition of specified screen
    # screen_conditions = select(db.WellCondition.id).join(db.Well).join(db.Screen).where(db.Screen.id == screen_id)
    # # Screens, and well counts, which only have wellconditions that are also found in the specified screen
    # statement = select(db.Screen, func.count(db.Well.id)).join(db.Well).join(db.WellCondition)\
    #             .where(db.Screen.id != screen_id)\
    #             .group_by(db.Screen)\
    #             .having(func.count(db.WellCondition.id) == func.sum(case((col(db.WellCondition.id).in_(screen_conditions), 1), else_=0)))\
    #             .options(subqueryload(db.Screen.frequentblock))
    # # Execute and return
    # screens_counts = session.exec(statement).all()
    # return screens_counts

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
    return [QueryScreen(screen=s, well_match_counter=c, screen_id=s.id) for s,c in screens_counts]

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
        print([f for w in wells for f in w.wellcondition.factors])
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

@router.get("/automaticScreenMakerFactorGroups", 
             summary="Creates groups of factors and instructions on how to vary them for generating an automatic optimisation screen from a list of selected well ids",
             response_description="Groups of factors and how to vary them for automatic optimisation from the conditions of the supplied well ids",
             response_model=list[screen_maker.AutoScreenMakerFactorGroup])
async def get_custom_condition_custom_stocks_recipe(*, session: Session=Depends(db.get_readonly_session), well_ids: Annotated[list[int], Query()]):
    """
    Creates groups of factors and instructions on how to vary them for generating an automatic optimisation screen from a list of selected well ids
    """
    return screen_maker.make_factor_groups_from_well_ids(session, well_ids)

@router.get("/stats", 
            summary="Gets small number of statistics about a screen from its screen id",
            response_description="Statistics about given screen",
            response_model=ScreenStats)
async def get_screen_stats(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    Gets small number of statistics about a screen from its screen id   
    """
    statement = select(func.count(distinct(db.Well.id)).label("num_conditions"), 
                       func.count(distinct(db.Chemical.id)).label("unique_chemicals"),
                       func.count((db.Factor.id)).label("total_factors")
                       ).select_from(db.Well)\
     .join(db.WellCondition)\
     .join(db.WellCondition.factors)\
     .join(db.Factor.chemical)\
     .where(db.Well.screen_id == screen_id)
    
    result = session.exec(statement).one()
    num_conditions = result.num_conditions
    unique_chemicals = result.unique_chemicals
    total_factors = result.total_factors
    avg_factors_per_condition = total_factors / num_conditions if num_conditions > 0 else 0
    
    return ScreenStats(
        num_conditions=num_conditions, 
        unique_chemicals=unique_chemicals, 
        avg_factors_per_condition=avg_factors_per_condition
    )

@router.get("/screenReport", 
            summary="Creates information on all the unique chemicals in a screen",
            response_description="Statistics about given screen's unique chemicals",
            response_model=list[ChemicalInfo])
async def screen_report(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    Gets statistics about a screen's unique chemicals from its screen id   
    """
    statement = (
        select(
            db.Chemical,
            func.min(db.Factor.ph).label("ph_min"),
            func.max(db.Factor.ph).label("ph_max"),
            func.min(db.Factor.concentration).label("conc_min"),
            func.max(db.Factor.concentration).label("conc_max"),
            func.count(distinct(db.Well.id)).label("appearances")
        )
        .join(db.Factor)
        .join(db.WellCondition_Factor_Link)
        .join(db.WellCondition)
        .join(db.Well)
        .join(db.Screen)
        .where(db.Screen.id == screen_id)
        .group_by(db.Chemical.id)
    )

    results = session.exec(statement).all()

    return [
        ChemicalInfo(
            chemical=c,
            ph_min=ph_min,
            ph_max=ph_max,
            conc_min=conc_min,
            conc_max=conc_max,
            appearances=appearances,
        )
        for c, ph_min, ph_max, conc_min, conc_max, appearances in results
    ]

@router.get("/compareScreen", 
            summary="Compares chemicals shared between two screens",
            response_description="Information about chemicals shared between two screens",
            response_model=list[ChemicalCompare])
@cached(cache=LRUCache(maxsize= 125), key = lambda *args, **kwargs: hashkey(tuple([kwargs["screen_id1"], kwargs["screen_id2"]])))
async def compare_screens(*, session: Session=Depends(db.get_readonly_session), screen_id1: int, screen_id2: int):
    """
    Gets information about chemicals shared between two screens, with stats specific to each screen
    """
    # Get shared chemical IDs using SQL intersect
    chemicals_in_screen1 = (
        select(db.Chemical.id)
        .join(db.Factor)
        .join(db.WellCondition_Factor_Link)
        .join(db.WellCondition)
        .join(db.Well)
        .join(db.Screen)
        .where(db.Screen.id == screen_id1)
        .distinct()
    )

    chemicals_in_screen2 = (
        select(db.Chemical.id)
        .join(db.Factor)
        .join(db.WellCondition_Factor_Link)
        .join(db.WellCondition)
        .join(db.Well)
        .join(db.Screen)
        .where(db.Screen.id == screen_id2)
        .distinct()
    )

    shared_ids_subquery = chemicals_in_screen1.intersect(chemicals_in_screen2)

    # Get report for screen 1 (only shared chemicals)
    statement1 = (
        select(
            db.Chemical,
            func.min(db.Factor.ph).label("ph_min"),
            func.max(db.Factor.ph).label("ph_max"),
            func.min(db.Factor.concentration).label("conc_min"),
            func.max(db.Factor.concentration).label("conc_max"),
            func.count(distinct(db.Well.id)).label("appearances")
        )
        .join(db.Factor)
        .join(db.WellCondition_Factor_Link)
        .join(db.WellCondition)
        .join(db.Well)
        .join(db.Screen)
        .where(db.Screen.id == screen_id1)
        .where(db.Chemical.id.in_(shared_ids_subquery))
        .group_by(db.Chemical.id)
    )
    results1 = session.exec(statement1).all()
    dict1 = {c.id: (c, ph_min, ph_max, conc_min, conc_max, appearances) for c, ph_min, ph_max, conc_min, conc_max, appearances in results1}

    # Get report for screen 2 (only shared chemicals)
    statement2 = (
        select(
            db.Chemical,
            func.min(db.Factor.ph).label("ph_min"),
            func.max(db.Factor.ph).label("ph_max"),
            func.min(db.Factor.concentration).label("conc_min"),
            func.max(db.Factor.concentration).label("conc_max"),
            func.count(distinct(db.Well.id)).label("appearances")
        )
        .join(db.Factor)
        .join(db.WellCondition_Factor_Link)
        .join(db.WellCondition)
        .join(db.Well)
        .join(db.Screen)
        .where(db.Screen.id == screen_id2)
        .where(db.Chemical.id.in_(shared_ids_subquery))
        .group_by(db.Chemical.id)
    )
    results2 = session.exec(statement2).all()
    dict2 = {c.id: (c, ph_min, ph_max, conc_min, conc_max, appearances) for c, ph_min, ph_max, conc_min, conc_max, appearances in results2}

    # Build response with shared chemicals
    shared = []
    for chem_id in dict1:
        chem, ph_min1, ph_max1, conc_min1, conc_max1, app1 = dict1[chem_id]
        _, ph_min2, ph_max2, conc_min2, conc_max2, app2 = dict2[chem_id]
        shared.append(ChemicalCompare(
            chemical=chem,
            screen_info1=ChemicalInfoBase(
                ph_min=ph_min1,
                ph_max=ph_max1,
                conc_min=conc_min1,
                conc_max=conc_max1,
                appearances=app1
            ),
            screen_info2=ChemicalInfoBase(
                ph_min=ph_min2,
                ph_max=ph_max2,
                conc_min=conc_min2,
                conc_max=conc_max2,
                appearances=app2
            )
        ))

    return shared

@router.get("/compareScreenConditions", 
            summary="Compares conditions shared between two screens",
            response_description="all conditions shared between two screens",
            response_model=list[ConditionCompare])
@cached(cache=LRUCache(maxsize= 125), key = lambda *args, **kwargs: hashkey(tuple([kwargs["screen_id1"], kwargs["screen_id2"]])))
async def compare_screen_conditions(*, session: Session=Depends(db.get_readonly_session), screen_id1: int, screen_id2: int):
    """
    all conditions shared between two screens
    """
    # Get report for screen 1
    statement1 = (
        select(db.Well)
        .join(db.Screen)
        .where(db.Screen.id == screen_id1)
        .distinct()
    )
    statement2 = (
        select(db.Well)
        .join(db.Screen)
        .where(db.Screen.id == screen_id2)
        .distinct()
    )
    
    wells_screen1 = session.exec(statement1).all()
    wells_screen2 = session.exec(statement2).all()

    shared_conditions = []
    for well1 in wells_screen1:
        for well2 in wells_screen2:
            if (ch.condition_equality(well1.wellcondition, well2.wellcondition)):
                shared_conditions.append(ConditionCompare(well1= well1, well2= well2))

    return shared_conditions

@router.get("/diversity", 
            summary="Diversity of conditions within screen",
            response_description="float representing average distance of conditions within screen",
            response_model=float)
@cached(cache=LRUCache(maxsize= 125), key = lambda *args, **kwargs: hashkey(kwargs["screen_id"]))
async def diversity(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    float representing average distance of conditions within screen
    """
    statement = (
        select(db.Screen)
        .where(db.Screen.id == screen_id).options(
        selectinload(db.Screen.wells)
        .selectinload(db.Well.wellcondition)
        .selectinload(db.WellCondition.factors)
        .selectinload(db.Factor.chemical))
        .distinct().limit(1)
    )
    
    result = session.exec(statement).unique().one()
    return condition_distance.distance_inside_screen(session, result)

@router.get("/compareDiversity", 
            summary="Diversity of conditions between screens",
            response_description="float representing average distance of conditions between screens",
            response_model=float)
@cached(cache=LRUCache(maxsize= 125), key = lambda *args, **kwargs: hashkey(tuple(sorted([kwargs["screen_id1"], kwargs["screen_id2"]]))))
async def compare_diversity(*, session: Session=Depends(db.get_readonly_session), screen_id1: int, screen_id2: int):
    """
    float representing average distance of conditions between screens
    """
    statement = (
        select(db.Screen)
        .where(db.Screen.id == screen_id1).options(
        selectinload(db.Screen.wells)
        .selectinload(db.Well.wellcondition)
        .selectinload(db.WellCondition.factors)
        .selectinload(db.Factor.chemical))
        .distinct().limit(1)
    )
    screen1 = session.exec(statement).unique().one()

    statement = (
        select(db.Screen)
        .where(db.Screen.id == screen_id2).options(
        selectinload(db.Screen.wells)
        .selectinload(db.Well.wellcondition)
        .selectinload(db.WellCondition.factors)
        .selectinload(db.Factor.chemical))
        .distinct().limit(1)
    )
    screen2 = session.exec(statement).unique().one()
    
    return condition_distance.distance_between_screens(session, screen1, screen2)


def test():
    """Test function to query screens directly"""
    from sqlmodel import Session
    
    # Create session using your existing connection string
    engine = db.readonly_engine
    with Session(engine) as session:
        statement = (
            select(db.Screen).options(
            selectinload(db.Screen.wells)
            .selectinload(db.Well.wellcondition)
            .selectinload(db.WellCondition.factors)
            .selectinload(db.Factor.chemical))
            .distinct().limit(1)
        )
        
        result = session.exec(statement).unique().one()
        print(condition_distance.distance_inside_screen(session, result), "\n\n\n")




if __name__ == "__main__":
    test()




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