"""

"""

from sqlmodel import Session, select, func
from sqlalchemy.orm import subqueryload
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import api.db as db
import api.authentication as auth

class ChemicalUseCount(BaseModel):
    condition_count: int
    well_count: int
    screen_count: int
    stock_count: int

# ============================================================================ #
# API operations
# ============================================================================ #

router = APIRouter(
    prefix="/chemicals",
    tags=["Chemical Operations"]
)

@router.get("/names", 
            summary="Get a list of all chemical names",
            response_description="List of all chemical names",
            response_model=list[db.ChemicalReadLite])
async def get_chemical_names(*, session: Session=Depends(db.get_readonly_session)):
    """
    Get a list of all chemical names
    """
    statement = select(db.Chemical).options(subqueryload(db.Chemical.aliases))
    chemicals = session.exec(statement).all()
    return chemicals

@router.get("/all", 
            summary="Get a list of all chemicals",
            response_description="List of all chemicals",
            response_model=list[db.ChemicalRead])
async def get_chemicals(*, session: Session=Depends(db.get_readonly_session)):
    """
    Get a list of all chemicals including frequent slock information
    """
    statement = select(db.Chemical).options(subqueryload(db.Chemical.aliases), subqueryload(db.Chemical.frequentstock))
    chemicals = session.exec(statement).all()
    return chemicals

@router.put("/update", 
            summary="Update a chemical",
            response_description="The updated chemical",
            response_model=db.ChemicalRead)
async def update_chemical(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), updated_chemical: db.ChemicalUpdate):
    """
    Update a chemical
    """
    # Add updated chemical
    chemical = session.get(db.Chemical, updated_chemical.id).sqlmodel_update(updated_chemical.model_dump(exclude_unset=True))
    session.add(chemical)
    session.commit()
    session.refresh(chemical)

    # Add frequent stock if information is there
    frequentstock = session.get(db.FrequentStock, chemical.id)
    frequentstock_info_in_updated = updated_chemical.frequentstock and (updated_chemical.frequentstock.concentration or updated_chemical.frequentstock.precipitation_concentration)
    # Already info in db, updated it with new info
    if frequentstock and frequentstock_info_in_updated:
        frequentstock.sqlmodel_update(updated_chemical.frequentstock.model_dump(exclude_unset=True))
        session.add(frequentstock)
    # No info in db, create new entry and update it
    elif not frequentstock and frequentstock_info_in_updated:
        frequentstock = db.FrequentStock(chemical_id=chemical.id).sqlmodel_update(updated_chemical.frequentstock.model_dump(exclude_unset=True))
        session.add(frequentstock)
    # Info in db but removed in update, remove it
    elif frequentstock and not frequentstock_info_in_updated:
        session.delete(frequentstock)
    session.commit()
    session.refresh(chemical)

    # Remove all aliases and re-add new ones
    for alias in chemical.aliases:
        session.delete(alias)
    for new_alias in updated_chemical.aliases:
        session.add(db.Alias().sqlmodel_update(new_alias.model_dump(exclude_unset=True)))
    session.commit()
    session.refresh(chemical)

    # Log and return updated chemical
    print("Chemical update performed by user: %s" % authorised_user.username)
    return chemical

@router.post("/create", 
             summary="Create a new chemical",
             response_description="The new Chemical",
             response_model=db.ChemicalRead)
async def create_chemical(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), new_chemical: db.ChemicalCreate):
    """
    Create a new chemical
    """
    # Add chemical with frequentstock and alias information
    chemical = db.Chemical().sqlmodel_update(new_chemical.model_dump(exclude_unset=True))
    session.add(chemical)
    session.commit()
    session.refresh(chemical)

    # Create frequent stock if info is there
    frequentstock_info_in_new = new_chemical.frequentstock and (new_chemical.frequentstock.concentration or new_chemical.frequentstock.precipitation_concentration)
    if frequentstock_info_in_new:
        frequentstock = db.FrequentStock(chemical_id=chemical.id).sqlmodel_update(new_chemical.frequentstock.model_dump(exclude_unset=True))
        session.add(frequentstock)
    session.commit()
    session.refresh(chemical)

    # Remove all aliases and re-add new ones
    for alias in chemical.aliases:
        session.delete(alias)
    for new_alias in new_chemical.aliases:
        session.add(db.Alias(chemical_id=chemical.id).sqlmodel_update(new_alias.model_dump(exclude_unset=True)))
    session.commit()
    session.refresh(chemical)

    # Log and return new chemical
    print("Chemical creation performed by user: %s" % authorised_user.username)
    return chemical

@router.delete("/delete", 
               summary="Delete a chemical from the database",
               response_description="None")
async def delete_chemical(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), chemical_id: int):
    """
    Delete a chemical from the database
    """
    # Remove frequent stock if it was there too
    frequentstock = session.get(db.FrequentStock, chemical_id)
    if frequentstock:
        session.delete(frequentstock)
    session.commit()

    # Find the chemical to remove
    chemical = session.get(db.Chemical, chemical_id)
    # Check if there are any factors with the chemical that do not belong to a stock or wellcondition
    for factor in chemical.factors:
        if factor.stocks == [] and factor.wellconditions == []:
            # found, delete these as well
            session.delete(factor)
    session.commit()

    # Remove all aliases
    for alias in chemical.aliases:
        session.delete(alias)
    session.commit()

    session.delete(chemical)
    session.commit()

    # Log and return
    print("Chemical deletion performed by user: %s" % authorised_user.username)
    return

@router.get("/useOfChemical", 
            summary="Get a count of wells, wellconditions, screens and stocks that use a specific chemical",
            response_description="Object with integer counts of wells, wellconditions, screens and stocks that use specified chemicals",
            response_model=ChemicalUseCount)
async def get_use_of_chemical(*, session: Session=Depends(db.get_readonly_session), chemical_id: int):
    """
    Get a count of wells, wellconditions, screens and stocks that use a specific chemical
    """
    condition_count_stmnt = select(func.count(db.WellCondition.id)).join(db.WellCondition_Factor_Link).join(db.Factor).where(db.Factor.chemical_id == chemical_id)
    well_count_stmnt = select(func.count(db.Well.id)).join(db.WellCondition).join(db.WellCondition_Factor_Link).join(db.Factor).where(db.Factor.chemical_id == chemical_id)
    screen_count_stmnt = select(func.count(db.Screen.id)).join(db.Well).join(db.WellCondition).join(db.WellCondition_Factor_Link).join(db.Factor).where(db.Factor.chemical_id == chemical_id)
    stock_count_stmnt = select(func.count(db.Stock.id)).join(db.Factor).where(db.Factor.chemical_id == chemical_id)
    condition_count = session.exec(condition_count_stmnt).one()
    well_count = session.exec(well_count_stmnt).one()
    screen_count = session.exec(screen_count_stmnt).one()
    stock_count = session.exec(stock_count_stmnt).one()
    counter = ChemicalUseCount(condition_count=condition_count,
                               well_count=well_count,
                               screen_count=screen_count,
                               stock_count=stock_count)
    return counter

@router.get("/phcurve_all", 
            summary="Get a list of all pH curves",
            response_description="List of all pH curves",
            response_model=list[db.PhCurveRead])
async def get_phcurves(*, session: Session=Depends(db.get_readonly_session)):
    """
    Get a list of all pH curves
    """
    statement = select(db.PhCurve).options(subqueryload(db.PhCurve.chemical).subqueryload(db.Chemical.aliases), 
                                           subqueryload(db.PhCurve.low_chemical).subqueryload(db.Chemical.aliases),
                                           subqueryload(db.PhCurve.high_chemical).subqueryload(db.Chemical.aliases),
                                           subqueryload(db.PhCurve.points))
    curves = session.exec(statement).all()
    return curves

@router.put("/phcurve_update", 
            summary="Update a pH curve",
            response_description="The updated pH curve",
            response_model=db.PhCurveRead)
async def update_phcurve(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), updated_phcurve: db.PhCurveUpdate):
    """
    Update a pH curve
    """
    # Add updated phcurve
    phcurve = session.get(db.PhCurve, updated_phcurve.id).sqlmodel_update(updated_phcurve.model_dump(exclude_unset=True))
    session.add(phcurve)
    session.commit()
    session.refresh(phcurve)

    # Remove all phpoints and re-add new ones
    for phpoint in phcurve.points:
        session.delete(phpoint)
    for new_point in updated_phcurve.points:
        session.add(db.PhPoint().sqlmodel_update(new_point.model_dump(exclude_unset=True)))
    session.commit()
    session.refresh(phcurve)

    # Log and return updated chemical
    print("pH curve update performed by user: %s" % authorised_user.username)
    return phcurve

@router.post("/phcurve_create", 
             summary="Create a new pH curve",
             response_description="The new pH curve",
             response_model=db.PhCurveRead)
async def create_chemical(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), new_phcurve: db.PhCurveCreate):
    """
    Create a new pH curve
    """
    # Add phcurve and point information
    phcurve = db.PhCurve().sqlmodel_update(new_phcurve.model_dump(exclude_unset=True))
    session.add(phcurve)
    session.commit()
    session.refresh(phcurve)

    # Remove all points and re-add new ones
    for point in phcurve.points:
        session.delete(point)
    for new_point in new_phcurve.points:
        session.add(db.PhPoint(phcurve_id=phcurve.id).sqlmodel_update(new_point.model_dump(exclude_unset=True)))
    session.commit()
    session.refresh(phcurve)

    # Log and return new pH curve
    print("pH curve creation performed by user: %s" % authorised_user.username)
    return phcurve

@router.delete("/phcurve_delete", 
               summary="Delete a pH curve from the database",
               response_description="None")
async def delete_chemical(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), phcurve_id: int):
    """
    Delete a pH curve from the database
    """

    # Find the phcurve to remove
    phcurve = session.get(db.PhCurve, phcurve_id)

    # Remove all points
    for point in phcurve.points:
        session.delete(point)
    session.commit()

    session.delete(phcurve)
    session.commit()

    # Log and return
    print("pH curve deletion performed by user: %s" % authorised_user.username)
    return
