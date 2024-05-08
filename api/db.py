"""

"""

import configparser as cp
from sqlmodel import Field, Session, SQLModel, Relationship, create_engine, select
from datetime import datetime
from typing import Optional

# Read config for database connection string
def read_connection_string():
    config = cp.ConfigParser()
    config.read("api/api.ini")
    db = config["DATABASE"]
    prefix = db["type_prefix"]
    username = db["username"]
    password = db["password"]
    ip = db["ip"]
    port = db["port"]
    database_name = db["database_name"]
    return "%s://%s:%s@%s:%s/%s" % (prefix, username, password, ip, port, database_name)

# Create engine object for subsequent queries when this file is imported
engine = create_engine(read_connection_string(), echo=True)

# Mapping DB tables to Python classes

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