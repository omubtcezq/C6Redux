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
async def get_chemical_names(*, session: Session=Depends(db.get_readonly_session)):
    """
    Get a list of all chemical names
    """
    statement = select(db.Chemical)
    chemicals = session.exec(statement).all()
    return chemicals

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

@router.get("/all", 
            summary="Get a list of all chemicals",
            response_description="List of all chemicals",
            response_model=list[db.ChemicalContentsRead])
async def get_chemicals(*, session: Session=Depends(db.get_readonly_session)):
    """
    Get a list of all chemicals including frequent slock information
    """
    statement = select(db.Chemical)
    chemicals = session.exec(statement).all()
    return chemicals