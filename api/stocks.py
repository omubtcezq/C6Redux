"""

"""

from sqlmodel import Session, select, or_
from fastapi import APIRouter, Depends
import api.db as db
import api.authentication as auth

# TODO on update and delete of stock, check for factors that are no longer used (as stock or screen) and delete them from db

# ============================================================================ #
# API operations
# ============================================================================ #

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

@router.put("/update", 
            summary="Update a stock",
            response_description="The updated stock",
            response_model=db.StockRead)
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
    
    # Find stock hazards
    if len(updated_stock.hazards) > 0:
        hazard_search_stmnt = select(db.Hazard).where(or_(*[db.Hazard.id == h.id for h in updated_stock.hazards]))
        hazards = session.exec(hazard_search_stmnt).all()
    else:
        hazards = []
    
    # Get the stock to update
    stock = session.get(db.Stock, updated_stock.id)
    # Update relations
    stock.factor_id = factor.id
    stock.apiuser_id = updated_stock.apiuser_id
    stock.hazards = hazards
    # Update remaining values
    stock.name = updated_stock.name
    stock.polar = updated_stock.polar
    stock.viscosity = updated_stock.viscosity
    stock.volatility = updated_stock.volatility
    stock.density = updated_stock.density
    stock.available = updated_stock.available
    stock.comments = updated_stock.comments
    # Add updated stock
    session.add(stock)
    session.commit()
    session.refresh(stock)

    # Log and return updated stock
    print("Stock update performed by user: %s" % authorised_user.username)
    return stock

@router.post("/create", 
             summary="Create a new stock",
             response_description="The new stock",
             response_model=db.StockRead)
async def create_stock(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), new_stock: db.StockCreate):
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
    
    # Find stock hazards
    if len(new_stock.hazards) > 0:
        hazard_search_stmnt = select(db.Hazard).where(or_(*[db.Hazard.id == h.id for h in new_stock.hazards]))
        hazards = session.exec(hazard_search_stmnt).all()
    else:
        hazards = []
    
    # Create new stock object
    stock = db.Stock(factor_id = factor.id,
                     apiuser_id = new_stock.apiuser_id,
                     name = new_stock.name,
                     polar = new_stock.polar,
                     viscosity = new_stock.viscosity,
                     volatility = new_stock.volatility,
                     density = new_stock.density,
                     available = new_stock.available,
                     comments = new_stock.comments)
    stock.hazards = hazards
    
    # Save stock
    session.add(stock)
    session.commit()
    session.refresh(stock)

    # Log and return new stock
    print("Stock creation performed by user: %s" % authorised_user.username)
    return stock

@router.delete("/delete", 
               summary="Remove a stock",
               response_description="None")
async def delete_stock(*, authorised_user: db.ApiUserRead=Depends(auth.get_authorised_user), session: Session=Depends(db.get_write_session), stock_id: int):
    """
    Delete a stock from the database
    """
    # find and remove stock
    stock = session.get(db.Stock, stock_id)
    session.delete(stock)
    session.commit()

    # Log and return
    print("Stock deletion performed by user: %s" % authorised_user.username)
    return

@router.get("/users", 
            summary="Get a list of users that can create stocks",
            response_description="List of users that can create stocks",
            response_model=list[db.ApiUserRead])
async def get_users(*, session: Session=Depends(db.get_readonly_session)):
    """
    Get a list of users that can create stocks
    """
    statement = select(db.ApiUser).order_by(db.ApiUser.username)
    users = session.exec(statement).all()
    return users

@router.get("/hazards", 
            summary="Get a list of hazards that a stock can have",
            response_description="List of hazards that a stock can have",
            response_model=list[db.HazardRead])
async def get_hazards(*, session: Session=Depends(db.get_readonly_session)):
    """
    Get a list of hazards that a stock can have
    """
    statement = select(db.Hazard).order_by(db.Hazard.name)
    hazards = session.exec(statement).all()
    return hazards