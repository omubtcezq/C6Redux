"""

"""

from sqlmodel import Session, select
from fastapi import APIRouter, Depends
import api.db as db
import api.authentication as auth

router = APIRouter(
    prefix="/stocks",
    tags=["Stock Operations"]
)

@router.get("/all", 
            summary="Get a list of all stocks",
            response_description="List of all stocks",
            response_model=list[db.StockRead])
async def get_stocks(*, session: Session=Depends(db.get_readonly_session)):
    """
    Get a list of all stocks
    """
    statement = select(db.Stock).order_by(db.Stock.available.desc(), db.Stock.name)
    stocks = session.exec(statement).all()
    return stocks