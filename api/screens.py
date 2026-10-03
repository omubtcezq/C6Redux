"""

"""

from sqlmodel import Session, select, case, col, func, distinct, intersect, delete
from sqlalchemy.orm import subqueryload, selectinload
from fastapi import APIRouter, Depends, Query, Request, HTTPException
from pydantic import BaseModel
from typing import Annotated
from asyncache import cached
from cachetools.keys import hashkey
from cachetools import LRUCache
from asyncio import CancelledError

import api.db as db
import api.recipes as recipes
import api.screen_query as screen_query
import api.screen_maker as screen_maker
import api.units_and_buffers as unbs
import api.condition_helper as ch
import api.condition_distance as condition_distance
import api.authentication as auth
from datetime import datetime
import json
import math

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

class SimilarScreen(BaseModel):
    screen: db.ScreenRead
    screen_id: int
    similarity_score: float
    identical_conditions: int
    identical_chemicals: int

SIMILARITY_FINGERPRINT_VERSION = 2

def make_screen_similarity_fingerprint(screen: db.Screen) -> dict:
    well_count = len(screen.wells)
    if well_count == 0:
        return {"well_count": 0, "chemicals": {}, "conditions": {}, "mean_ph": None}

    chemical_well_counts = {}
    chemical_concentration_totals = {}
    chemical_concentration_counts = {}
    condition_counts = {}
    well_ph_values = []
    total_factors = 0

    for well in screen.wells:
        well_chemicals = set()
        well_concentrations = {}
        well_ph = []
        condition_factors = []
        for factor in well.wellcondition.factors:
            chemical_id = factor.chemical_id
            well_chemicals.add(chemical_id)
            total_factors += 1
            condition_factors.append({
                "chemical_id": chemical_id,
                "concentration": factor.concentration,
                "unit": factor.unit,
                "ph": factor.ph
            })
            if factor.ph is not None:
                well_ph.append(factor.ph)
            concentration = unbs.unit_conversion(
                factor.concentration,
                factor.unit,
                factor.chemical.density,
                factor.chemical.molecular_weight,
                "M"
            )
            if concentration is not None and concentration >= 0:
                well_concentrations.setdefault(chemical_id, []).append(concentration)

        condition_signature = json.dumps(
            sorted(condition_factors, key=lambda factor: json.dumps(factor, sort_keys=True)),
            separators=(",", ":")
        )
        condition_counts[condition_signature] = condition_counts.get(condition_signature, 0) + 1

        for chemical_id in well_chemicals:
            chemical_well_counts[chemical_id] = chemical_well_counts.get(chemical_id, 0) + 1
        for chemical_id, concentrations in well_concentrations.items():
            chemical_concentration_totals[chemical_id] = (
                chemical_concentration_totals.get(chemical_id, 0) + sum(concentrations) / len(concentrations)
            )
            chemical_concentration_counts[chemical_id] = chemical_concentration_counts.get(chemical_id, 0) + 1
        if well_ph:
            well_ph_values.append(sum(well_ph) / len(well_ph))

    chemicals = {}
    for chemical_id, well_count_for_chemical in chemical_well_counts.items():
        concentration_count = chemical_concentration_counts.get(chemical_id, 0)
        mean_concentration = (
            chemical_concentration_totals[chemical_id] / concentration_count
            if concentration_count else None
        )
        chemicals[str(chemical_id)] = {
            "frequency": well_count_for_chemical / well_count,
            "log_concentration": math.log1p(mean_concentration) if mean_concentration is not None else None
        }

    return {
        "well_count": well_count,
        "mean_factors_per_well": total_factors / well_count,
        "chemicals": chemicals,
        "conditions": condition_counts,
        "mean_ph": sum(well_ph_values) / len(well_ph_values) if well_ph_values else None
    }

def persist_screen_similarity_fingerprint(
    session: Session,
    screen: db.Screen
) -> db.ScreenSimilarityFingerprint:
    fingerprint_data = json.dumps(
        make_screen_similarity_fingerprint(screen),
        separators=(",", ":")
    )
    fingerprint = session.get(db.ScreenSimilarityFingerprint, screen.id)
    if fingerprint is None:
        fingerprint = db.ScreenSimilarityFingerprint(
            screen_id=screen.id,
            version=SIMILARITY_FINGERPRINT_VERSION,
            fingerprint=fingerprint_data
        )
        session.add(fingerprint)
    else:
        fingerprint.version = SIMILARITY_FINGERPRINT_VERSION
        fingerprint.fingerprint = fingerprint_data
        fingerprint.updated_at = datetime.utcnow()
    return fingerprint

def compare_screen_similarity_fingerprints(first: dict, second: dict) -> float:
    first_chemicals = first["chemicals"]
    second_chemicals = second["chemicals"]
    chemical_ids = set(first_chemicals) | set(second_chemicals)

    frequency_min = sum(
        min(first_chemicals.get(chemical_id, {}).get("frequency", 0),
            second_chemicals.get(chemical_id, {}).get("frequency", 0))
        for chemical_id in chemical_ids
    )
    frequency_max = sum(
        max(first_chemicals.get(chemical_id, {}).get("frequency", 0),
            second_chemicals.get(chemical_id, {}).get("frequency", 0))
        for chemical_id in chemical_ids
    )
    composition_similarity = frequency_min / frequency_max if frequency_max else 0

    concentration_similarities = []
    concentration_weights = []
    for chemical_id in set(first_chemicals) & set(second_chemicals):
        first_concentration = first_chemicals[chemical_id].get("log_concentration")
        second_concentration = second_chemicals[chemical_id].get("log_concentration")
        if first_concentration is None or second_concentration is None:
            continue
        weight = min(
            first_chemicals[chemical_id]["frequency"],
            second_chemicals[chemical_id]["frequency"]
        )
        concentration_similarities.append(
            math.exp(-2 * abs(first_concentration - second_concentration)) * weight
        )
        concentration_weights.append(weight)
    concentration_similarity = (
        sum(concentration_similarities) / sum(concentration_weights)
        if concentration_weights else None
    )

    first_ph = first.get("mean_ph")
    second_ph = second.get("mean_ph")
    ph_similarity = (
        max(0, 1 - abs(first_ph - second_ph) / 14)
        if first_ph is not None and second_ph is not None else None
    )

    first_size = first.get("well_count", 0)
    second_size = second.get("well_count", 0)
    size_similarity = min(first_size, second_size) / max(first_size, second_size) if first_size and second_size else 0

    weighted_scores = [(composition_similarity, 0.65), (size_similarity, 0.05)]
    if concentration_similarity is not None:
        weighted_scores.append((concentration_similarity, 0.20))
    if ph_similarity is not None:
        weighted_scores.append((ph_similarity, 0.10))
    total_weight = sum(weight for _, weight in weighted_scores)
    return sum(score * weight for score, weight in weighted_scores) / total_weight

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

@router.get("/namesBySize", 
            summary="Gets a list of all screen of a given size",
            response_description="List of all screen names matching size",
            response_model=list[db.ScreenReadLite])
async def get_screen_names_by_size(*, session: Session=Depends(db.get_readonly_session), size: int):
    """
    Gets a list of all screen of a given size
    """
    statement = select(db.Screen).join(db.Well).group_by(db.Screen.id).having(func.count(db.Well.id) == size).order_by(db.Screen.name)
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

@router.get("/similar",
            summary="Gets all other screens ranked by fingerprint similarity",
            response_model=list[SimilarScreen])
async def get_similar_screens(*, screen_id: int,
                              session: Session=Depends(db.get_write_session)):
    screen_statement = select(db.Screen).options(selectinload(db.Screen.frequentblock))
    screens = session.exec(screen_statement).all()
    screens_by_id = {screen.id: screen for screen in screens}
    if screen_id not in screens_by_id:
        raise HTTPException(status_code=404, detail="Screen not found")

    stored_fingerprints = {
        fingerprint.screen_id: fingerprint
        for fingerprint in session.exec(select(db.ScreenSimilarityFingerprint)).all()
    }
    missing_ids = {
        candidate_id
        for candidate_id in screens_by_id
        if candidate_id not in stored_fingerprints
        or stored_fingerprints[candidate_id].version != SIMILARITY_FINGERPRINT_VERSION
    }
    if missing_ids:
        full_screen_statement = (
            select(db.Screen)
            .where(db.Screen.id.in_(missing_ids))
            .options(
                selectinload(db.Screen.wells)
                .selectinload(db.Well.wellcondition)
                .selectinload(db.WellCondition.factors)
                .selectinload(db.Factor.chemical)
            )
        )
        for screen in session.exec(full_screen_statement).unique().all():
            stored_fingerprints[screen.id] = persist_screen_similarity_fingerprint(session, screen)
        session.commit()

    selected_fingerprint = json.loads(stored_fingerprints[screen_id].fingerprint)
    ranked_screens = []
    for candidate_id, fingerprint in stored_fingerprints.items():
        if candidate_id == screen_id:
            continue
        candidate_fingerprint = json.loads(fingerprint.fingerprint)
        identical_conditions = sum(
            min(count, candidate_fingerprint.get("conditions", {}).get(signature, 0))
            for signature, count in selected_fingerprint.get("conditions", {}).items()
        )
        identical_chemicals = len(
            set(selected_fingerprint["chemicals"]) & set(candidate_fingerprint["chemicals"])
        )
        ranked_screens.append((
            compare_screen_similarity_fingerprints(
                selected_fingerprint,
                candidate_fingerprint
            ),
            screens_by_id[candidate_id],
            identical_conditions,
            identical_chemicals
        ))
    ranked_screens.sort(key=lambda entry: (-entry[0], entry[1].name.lower(), entry[1].id))
    return [
        SimilarScreen(
            screen=screen,
            screen_id=screen.id,
            similarity_score=score,
            identical_conditions=identical_conditions,
            identical_chemicals=identical_chemicals
        )
        for score, screen, identical_conditions, identical_chemicals in ranked_screens
    ]

@router.get("/subsets", 
            summary="Gets a list of screens that contain only conditions found in the specified screen",
            response_description="List of screens that contain only conditions found in the specified screen",
            response_model=list[QueryScreen])
@cached(cache=LRUCache(maxsize= 125), key = lambda *args, **kwargs: hashkey(kwargs["screen_id"]))
async def get_subset_screens(*, session: Session=Depends(db.get_readonly_session), screen_id: int, request: Request):
    """
    Gets a list of screens and the number of wells in each that contain only conditions found in the specified screen
    """
    if await request.is_disconnected():
        raise CancelledError()
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
    
    if await request.is_disconnected():
        raise CancelledError()
    
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
        if await request.is_disconnected():
            raise CancelledError()
        if screen.id == comparison_screen.id:
            continue
        if len(screen.wells) > len(comparison_screen.wells):
            continue

        # Match each candidate well to a distinct well in the selected screen.
        # The candidate is a subset when all of its wells can be matched.
        matched_comparison_wells = set()
        is_subset = True
        for candidate_well in screen.wells:
            match = None
            for comparison_index, comparison_well in enumerate(comparison_screen.wells):
                if comparison_index in matched_comparison_wells:
                    continue
                if ch.condition_equality(candidate_well.wellcondition, comparison_well.wellcondition):
                    match = comparison_index
                    break
            if match is None:
                is_subset = False
                break
            matched_comparison_wells.add(match)

        if is_subset:
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

@router.post("/conditionGrid", 
             summary="Creates a grid of conditions from factor groups",
             response_description="list of conditions",
             response_model=list[list[screen_maker.GridWell]])
async def get_condition_grid(*, session: Session=Depends(db.get_readonly_session), query: screen_maker.ConditionGridQuery):
    """
    Creates a grid of conditions from factor groups
    """
    return screen_maker.make_condition_grid_from_factor_groups(session, query)


# --------------------------------------------------------------------------- #
# Models and endpoint to create/save a new screen from the UI
# --------------------------------------------------------------------------- #
class FactorCreateForScreen(BaseModel):
    chemical_id: int
    concentration: float | None = None
    unit: str | None = None
    ph: float | None = None

class WellForScreen(BaseModel):
    position_number: int
    label: str
    condition: list[FactorCreateForScreen] | None = None

class ScreenCreatePayload(BaseModel):
    name: str
    owned_by: str
    format_rows: int
    format_cols: int
    wells: list[WellForScreen]

@router.post("/create",
             summary="Create a new screen",
             response_description="The new Screen",
             response_model=db.ScreenRead)
async def create_screen(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), new_screen: ScreenCreatePayload):
    """
    Create a new screen with wells and conditions. This endpoint expects the frontend to pass the grid
    as a list of wells, each with a position_number, label, and a list of factors (chemical_id, concentration, unit, ph).
    """
    # Create screen entry
    screen = db.Screen(
        name=new_screen.name,
        available=1,
        owned_by=new_screen.owned_by,
        creation_date=datetime.utcnow(),
        format_name=f"{new_screen.format_rows}x{new_screen.format_cols}",
        format_rows=new_screen.format_rows,
        format_cols=new_screen.format_cols
    )
    session.add(screen)
    session.commit()
    session.refresh(screen)

    # For each well passed, create a WellCondition, Factors and a Well
    for w in new_screen.wells:
        wc = db.WellCondition(computed_similarities=0)
        session.add(wc)
        session.commit()
        session.refresh(wc)

        # Add factors to the well condition
        if w.condition:
            for f in w.condition:
                if f is None:
                    continue
                # Create Factor row (links to existing chemical by id)
                factor = db.Factor(chemical_id=f.chemical_id, concentration=f.concentration if f.concentration is not None else 0, unit=f.unit if f.unit is not None else '', ph=f.ph)
                session.add(factor)
                session.commit()
                session.refresh(factor)
                # Associate factor with well condition
                wc.factors.append(factor)
            session.commit()

        # Create well pointing to the created condition and the new screen
        well = db.Well(screen_id=screen.id, wellcondition_id=wc.id, position_number=w.position_number, label=w.label)
        session.add(well)
        session.commit()

    fingerprint_screen_statement = (
        select(db.Screen)
        .where(db.Screen.id == screen.id)
        .options(
            selectinload(db.Screen.wells)
            .selectinload(db.Well.wellcondition)
            .selectinload(db.WellCondition.factors)
            .selectinload(db.Factor.chemical)
        )
    )
    screen = session.exec(fingerprint_screen_statement).unique().one()
    persist_screen_similarity_fingerprint(session, screen)
    session.commit()
    session.refresh(screen)
    print("Screen creation performed by user: %s" % authorised_user.username)
    return screen

@router.delete("/{screen_id}",
               summary="Delete a screen",
               status_code=204)
async def delete_screen(*, screen_id: int,
                        authenticated_user: db.ApiUser=Depends(auth.get_authenticated_user),
                        session: Session=Depends(db.get_write_session)):
    screen = session.get(db.Screen, screen_id)
    if screen is None:
        raise HTTPException(status_code=404, detail="Screen not found")
    if not authenticated_user.admin and authenticated_user.username != screen.owned_by:
        raise HTTPException(status_code=403, detail="Only the screen owner or an admin can delete this screen")

    session.exec(delete(db.ScreenSimilarityFingerprint).where(
        db.ScreenSimilarityFingerprint.screen_id == screen_id
    ))
    well_conditions = [well.wellcondition_id for well in screen.wells]
    session.exec(delete(db.Well).where(db.Well.screen_id == screen_id))
    if well_conditions:
        session.exec(delete(db.WellCondition_Factor_Link).where(
            db.WellCondition_Factor_Link.wellcondition_id.in_(well_conditions)
        ))
        session.exec(delete(db.WellCondition).where(db.WellCondition.id.in_(well_conditions)))
    session.exec(delete(db.FrequentBlock).where(db.FrequentBlock.screen_id == screen_id))
    session.delete(screen)
    session.commit()


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
async def diversity(*, session: Session=Depends(db.get_readonly_session), screen_id: int, request: Request):
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
    return await condition_distance.distance_inside_screen(session, request, result)

@router.get("/compareDiversity", 
            summary="Diversity of conditions between screens",
            response_description="float representing average distance of conditions between screens",
            response_model=float)
@cached(cache=LRUCache(maxsize= 125), key = lambda *args, **kwargs: hashkey(tuple(sorted([kwargs["screen_id1"], kwargs["screen_id2"]]))))
async def compare_diversity(*, session: Session=Depends(db.get_readonly_session), screen_id1: int, screen_id2: int, request: Request):
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
    
    return await condition_distance.distance_between_screens(session, request, screen1, screen2)


def test():
    """Test function to query screens directly"""
    from api.authentication import hash_password
    from api.db import ApiUser, write_engine
    from sqlmodel import Session

    # Create new user
    new_user = ApiUser(
        username="newuser",
        password_hash=hash_password("password123"),  # Password is hashed with bcrypt
        admin=1  # Set to 1 to allow write operations; 0 for read-only
    )

    # # Add to database
    # with Session(write_engine) as session:
    #     session.add(new_user)
    #     session.commit()
    #     print(f"User '{new_user.username}' created with ID {new_user.id}")




if __name__ == "__main__":
    test()

@router.post("/test", 
            summary="Create a new screen",
            response_description="The new Screen",
            response_model=None)
async def testpost(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), new_screen: db.ScreenCreate):
    """
    Create a new screen
    """
    print(new_screen, "WOW")
    print(authorised_user)
    




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