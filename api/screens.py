"""

"""

from sqlmodel import Session, select
from fastapi import APIRouter
import api.db as db

router = APIRouter(
    prefix="/screens",
    tags=["screens"]
)

@router.get("/")
async def get_all_screens():
    with Session(db.engine) as session:
        statement = select(db.Screen)
        screens = session.exec(statement).all()
        ret = []
        for s in screens:
            ret.append({"screen":s, "frequentblock":s.frequentblock})
        return ret