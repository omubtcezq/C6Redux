"""

"""

from sqlmodel import Session, select, func
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import api.db as db
import api.authentication as auth

class ChemicalUseCount(BaseModel):
    condition_count: int
    well_count: int
    screen_count: int
    stock_count: int

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
    statement = select(db.Chemical)
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
    statement = select(db.Chemical)
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

    # TODO Aliases

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

    # TODO Aliases

    # Log and return new chemical
    print("Chemical creation performed by user: %s" % authorised_user.username)
    return chemical

@router.delete("/delete", 
               summary="Remove a chemical",
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

    # TODO Aliases

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


# HOPEFULLY TEMPORARY

@router.get("/chemical", 
            summary="Get single chemical properties",
            response_description="Single chemical properties",
            response_model=db.ChemicalRead)
async def get_chemical(*, session: Session=Depends(db.get_readonly_session), chemical_id: int):
    """
    Get single chemical properties
    """
    statement = select(db.Chemical).where(db.Chemical.id == chemical_id)
    chemical = session.exec(statement).first()
    return chemical