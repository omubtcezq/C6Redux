from datetime import datetime
from typing import Optional
from sqlmodel import Field, Session, SQLModel, Relationship, create_engine, select
from fastapi import APIRouter


MYSQL_CONNECTION_URL = "mysql://root:rooty tooty unknown word@127.0.0.1:3306/c6reduxdb"
engine = create_engine(MYSQL_CONNECTION_URL, echo=True)

class Screen(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True) 
    name: str
    creator: str
    creation_date: datetime
    format_name: int
    format_rows: int
    format_cols: int
    comments: str
    frequentblock: Optional["FrequentBlock"] = Relationship(back_populates="screen")

class FrequentBlock(SQLModel, table=True):
    screen_id: Optional[int] = Field(default=None, foreign_key="screen.id", primary_key=True)
    reservoir_volume: Optional[float]
    solution_volume: Optional[float]
    screen: Screen = Relationship(back_populates="frequentblock")

router = APIRouter()

@router.get("/screens/")
async def get_all_screens():
    with Session(engine) as session:
        statement = select(Screen)
        screens = session.exec(statement).all()
        ret = []
        for s in screens:
            ret.append({"screen":s, "frequentblock":s.frequentblock})
        return ret