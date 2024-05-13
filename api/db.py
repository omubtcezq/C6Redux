"""

"""

import configparser as cp
from sqlmodel import Field, Session, SQLModel, Relationship, create_engine, select
from datetime import datetime
from typing import Union

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

# Create engine object for subsequent queries
engine = create_engine(read_connection_string(), echo=True)

# Get a db session to use with fastapi dependencies
def get_session():
    with Session(engine) as session:
        yield session

# Mapping DB tables to Python classes and input and output objects

# ========================= Chemical Substitute Link ========================= #

class Chemical_Substitute_Link(SQLModel, table=True):
    chemical_id: int = Field(foreign_key="chemical.id", primary_key=True)
    substitute_id: int = Field(foreign_key="substitute.id", primary_key=True)

# =========================== Chemical Class Link ============================ #

class Chemical_Class_Link(SQLModel, table=True):
    chemical_id: int = Field(foreign_key="chemical.id", primary_key=True)
    class_id: int = Field(foreign_key="class.id", primary_key=True)

# ================================= Chemical ================================= #

class Chemical(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    name: str
    unit: str | None = Field(default=None)
    formula: str | None = Field(default=None)
    density: float | None = Field(default=None)
    solubility: float | None = Field(default=None)
    pka1: float | None = Field(default=None)
    pka2: float | None = Field(default=None)
    pka3: float | None = Field(default=None)
    molecular_weight: float | None = Field(default=None)
    ions: str | None = Field(default=None)
    chemical_abstracts_db_id: str | None = Field(default=None)
    critical_micelle_concentration: float | None = Field(default=None)
    smiles: str | None = Field(default=None)
    frequentstock: Union["FrequentStock", None] = Relationship(back_populates="chemical")
    aliases: list["Alias"] = Relationship(back_populates="chemical")
    substitutes: list["Substitute"] = Relationship(back_populates="chemicals", link_model=Chemical_Substitute_Link)
    classes: list["Class"] = Relationship(back_populates="chemicals", link_model=Chemical_Class_Link)
    factors: list["Factor"] = Relationship(back_populates="chemical")

# ============================== FrequentStock =============================== #

class FrequentStock(SQLModel, table=True):
    chemical_id: int = Field(foreign_key="chemical.id", primary_key=True)
    concentration: float | None = Field(default=None)
    unit: str | None = Field(default=None)
    precipitation_concentration: float | None = Field(default=None)
    chemical: Chemical = Relationship(back_populates="frequentstock")

# ================================== Alias =================================== #

class Alias(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    chemical_id: int = Field(foreign_key="chemical.id")
    chemical: Chemical = Relationship(back_populates="aliases")

# ================================ Substitute ================================ #

class Substitute(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    chemicals: list[Chemical] = Relationship(back_populates="substitutes", link_model=Chemical_Substitute_Link)

# ======================== WellCondition Factor Link ========================= #

class WellCondition_Factor_Link(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    wellcondition_id: int = Field(foreign_key="wellcondition.id")
    factor_id: int = Field(foreign_key="factor.id")
    class_id: int | None = Field(foreign_key="class.id")

# ================================== Class =================================== #

class Class(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    chemicals: list[Chemical] = Relationship(back_populates="classes", link_model=Chemical_Class_Link)
    wellconditions: list["WellCondition"] = Relationship(back_populates="classes", link_model=WellCondition_Factor_Link)
    factors: list["Factor"] = Relationship(back_populates="classes", link_model=WellCondition_Factor_Link)

# ================================== Factor ================================== #

class Factor(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    chemical_id: int = Field(foreign_key="chemical.id")
    concentration: float
    unit: str
    ph: float | None = Field(default=None)
    chemical: Chemical = Relationship(back_populates="factors")
    stocks: list["Stock"] = Relationship(back_populates="factor")
    wellconditions: list["WellCondition"] = Relationship(back_populates="factors", link_model=WellCondition_Factor_Link)
    classes: list[Class] = Relationship(back_populates="factors", link_model=WellCondition_Factor_Link)

# ============================ Stock Hazard Link ============================= #

class Stock_Hazard_Link(SQLModel, table=True):
    stock_id: int = Field(foreign_key="stock.id", primary_key=True)
    hazard_id: int = Field(foreign_key="hazard.id", primary_key=True)

# ================================== Stock =================================== #

class Stock(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    factor_id: int = Field(foreign_key="factor.id")
    name: str
    polar: int | None = Field(default=None)
    viscosity: int | None = Field(default=None)
    volatility: int | None = Field(default=None)
    density: float | None = Field(default=None)
    available: int
    creator: str
    location: str | None = Field(default=None)
    comments: str | None = Field(default=None)
    factor: Factor = Relationship(back_populates="stocks")
    hazards: list["Hazard"] = Relationship(back_populates="stocks", link_model=Stock_Hazard_Link)

# ================================== Hazard ================================== #

class Hazard(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    stocks: list[Stock] = Relationship(back_populates="hazards", link_model=Stock_Hazard_Link)

# ================================== Screen ================================== #

class ScreenBase(SQLModel):
    name: str
    creator: str
    creation_date: datetime | None
    format_name: str | None = Field(default=None)
    format_rows: int | None = Field(default=None)
    format_cols: int | None = Field(default=None)
    comments: str | None = Field(default=None)

class Screen(ScreenBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    frequentblock: Union["FrequentBlock", None] = Relationship(back_populates="screen")
    wells: list["Well"] = Relationship(back_populates="screen")

class ScreenNew(ScreenBase):
    pass

class ScreenRead(ScreenBase):
    id: int
    frequentblock: "FrequentBlockRead | None" = None

# ============================== FrequentBlock =============================== #

class FrequentBlockBase(SQLModel):
    screen_id: int = Field(foreign_key="screen.id", primary_key=True)
    reservoir_volume: float | None = Field(default=None)
    solution_volume: float | None = Field(default=None)

class FrequentBlock(FrequentBlockBase, table=True):
    screen: Screen = Relationship(back_populates="frequentblock")

class FrequentBlockRead(FrequentBlockBase):
    pass

# ============================== WellCondition =============================== #

class WellCondition(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    computed_similarities: int
    well: "Well" = Relationship(back_populates="wellcondition")
    factors: list[Factor] = Relationship(back_populates="wellconditions", link_model=WellCondition_Factor_Link)
    classes: list[Class] = Relationship(back_populates="wellconditions", link_model=WellCondition_Factor_Link)

# =================================== Well =================================== #

class Well(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    screen_id: int = Field(foreign_key="screen.id")
    wellcondition_id: int = Field(foreign_key="wellcondition.id")
    position_number: int
    label: str
    screen: Screen = Relationship(back_populates="wells")
    wellcondition: WellCondition = Relationship(back_populates="well")

# ========================= WellConditionSimilarity ========================== #

class WellConditionSimilarity(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    wellcondition_id1: int = Field(foreign_key="wellcondition.id")
    wellcondition_id2: int = Field(foreign_key="wellcondition.id")
    similarity: float
    wellcondition1: WellCondition = Relationship(sa_relationship_kwargs={"foreign_keys": "[WellConditionSimilarity.wellcondition_id1]"})
    wellcondition2: WellCondition = Relationship(sa_relationship_kwargs={"foreign_keys": "[WellConditionSimilarity.wellcondition_id2]"})