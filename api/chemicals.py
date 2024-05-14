"""

"""

from sqlmodel import Session, select
from fastapi import APIRouter, Depends
import api.db as db

router = APIRouter(
    prefix="/chemicals",
    tags=["Chemical Operations"]
)

@router.get("/", 
            summary="Get a list of all chemicals",
            response_description="List of all chemicals",
            response_model=list[db.ChemicalContentsRead])
async def get_screens(*, session: Session=Depends(db.get_session)):
    """
    Get a list of all chemicals including frequent slock information
    """
    statement = select(db.Chemical)
    chemicals = session.exec(statement).all()
    return chemicals