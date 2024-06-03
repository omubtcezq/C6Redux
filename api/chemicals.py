"""

"""

from sqlmodel import Session, select
from fastapi import APIRouter, Depends
import api.db as db

router = APIRouter(
    prefix="/chemicals",
    tags=["Chemical Operations"]
)

@router.get("/names", 
            summary="Get a list of all chemical names",
            response_description="List of all chemical names",
            response_model=list[db.ChemicalReadLiteAlias])
async def get_chemical_names(*, session: Session=Depends(db.get_session)):
    """
    Get a list of all chemical names
    """
    statement = select(db.Chemical)
    chemicals = session.exec(statement).all()
    return chemicals

@router.get("/", 
            summary="Get a list of all chemicals",
            response_description="List of all chemicals",
            response_model=list[db.ChemicalRead])
async def get_chemicals(*, session: Session=Depends(db.get_session)):
    """
    Get a list of all chemicals including frequent slock information
    """
    statement = select(db.Chemical)
    chemicals = session.exec(statement).all()
    return chemicals