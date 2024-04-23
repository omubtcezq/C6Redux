
from sqlmodel import Field, Session, SQLModel, create_engine, select
from fastapi import APIRouter


MYSQL_CONNECTION_URL = "mysql://root:rooty tooty unknown word@127.0.0.1:3306/c6reduxdb"
engine = create_engine(MYSQL_CONNECTION_URL, echo=True)

class Screen(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True) 
    name: str
    username: str
    format_name: str
    format_rows: int
    format_cols: int
    format_subs: int
    comments: str


router = APIRouter()

@router.get("/screens/")
async def get_all_screens():
    with Session(engine) as session:
        statement = select(Screen)
        screens = session.exec(statement).all()
        return screens