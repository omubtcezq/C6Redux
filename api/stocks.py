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

@router.get("/read", 
            summary="Get contents of a single stock",
            response_description="Contents of a single stock",
            response_model=db.StockContentsRead)
async def get_stocks(*, session: Session=Depends(db.get_readonly_session), stock_id: int):
    """
    Get contents of a single stock
    """
    stock = session.get(db.Stock, stock_id)
    return stock

@router.put("/update", 
            summary="Update a stock",
            response_description="The updated stock",
            response_model=db.StockContentsRead)
async def update_stock(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), updated_stock: db.StockUpdate):
    """
    Update a stock
    """
    # Find new stock factor
    factor_search_stmnt = select(db.Factor).where(db.Factor.chemical_id == updated_stock.factor.chemical_id, 
                                                 db.Factor.concentration == updated_stock.factor.concentration,
                                                 db.Factor.unit == updated_stock.factor.unit,
                                                 db.Factor.ph == updated_stock.factor.ph)
    factor = session.exec(factor_search_stmnt).first()
    # If cannot be found, create a new factor for stock
    if not factor:
        factor = db.Factor(chemical_id = updated_stock.factor.chemical_id, 
                           concentration = updated_stock.factor.concentration,
                           unit = updated_stock.factor.unit,
                           ph = updated_stock.factor.ph)
        session.add(factor)
        session.commit()
        session.refresh(factor)
    
    # Get the stock to update
    stock = session.get(db.Stock, updated_stock.id)
    # Update remaining values
    stock.factor_id = factor.id
    #stock.hazards = updated_stock.hazards # (not current editable)
    stock.name = updated_stock.name
    stock.polar = updated_stock.polar
    stock.viscosity = updated_stock.viscosity
    stock.volatility = updated_stock.volatility
    stock.density = updated_stock.density
    stock.available = updated_stock.available
    stock.creator = updated_stock.creator
    stock.location = updated_stock.location
    stock.comments = updated_stock.comments
    # Update stock
    session.add(stock)
    session.commit()
    session.refresh(stock)

    # Log and return updated stock
    print("Stock update performed by user: %s" % authorised_user.username)
    return stock

@router.post("/create", 
             summary="Create a new stock",
             response_description="The new stock",
             response_model=db.StockContentsRead)
async def update_stock(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), new_stock: db.StockUpdate):
    """
    Create a new stock
    """
    # Find new stock factor
    factor_search_stmnt = select(db.Factor).where(db.Factor.chemical_id == new_stock.factor.chemical_id, 
                                                 db.Factor.concentration == new_stock.factor.concentration,
                                                 db.Factor.unit == new_stock.factor.unit,
                                                 db.Factor.ph == new_stock.factor.ph)
    factor = session.exec(factor_search_stmnt).first()
    # If cannot be found, create a new factor for stock
    if not factor:
        factor = db.Factor(chemical_id = new_stock.factor.chemical_id, 
                           concentration = new_stock.factor.concentration,
                           unit = new_stock.factor.unit,
                           ph = new_stock.factor.ph)
        session.add(factor)
        session.commit()
        session.refresh(factor)
    
    # Create new stock object
    stock = db.Stock(factor_id = factor.id,
                     hazards = new_stock.hazards,
                     name = new_stock.name,
                     polar = new_stock.polar,
                     viscosity = new_stock.viscosity,
                     volatility = new_stock.volatility,
                     density = new_stock.density,
                     available = new_stock.available,
                     creator = new_stock.creator,
                     location = new_stock.location,
                     comments = new_stock.comments)
    
    # Save stock
    session.add(stock)
    session.commit()
    session.refresh(stock)

    # Log and return new stock
    print("Stock creation performed by user: %s" % authorised_user.username)
    return stock

@router.delete("/delete", 
               summary="Remove a stock",
               response_description="Contents of removed stock",
               response_model=db.StockContentsRead)
async def delete_stock(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), stock_id: int):
    """
    Get contents of a single stock
    """
    # find and remove stock
    stock = session.get(db.Stock, stock_id)
    session.delete(stock)
    session.commit()

    # Log and return
    print("Stock deletion performed by user: %s" % authorised_user.username)
    return stock