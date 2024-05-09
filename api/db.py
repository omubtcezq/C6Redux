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

class Chemical(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    name: str
    unit: Optional[str]
    formula: Optional[str]
    density: Optional[float]
    solubility: Optional[float]
    pka1: Optional[float]
    pka2: Optional[float]
    pka3: Optional[float]
    molecular_weight: Optional[float]
    ions: Optional[str]
    chemical_abstracts_db_id: Optional[str]
    critical_micelle_concentration: Optional[float]
    smiles: Optional[str]
    frequentstock: Optional["FrequentStock"] = Relationship(back_populates="chemical")
    aliases: list["Alias"] = Relationship(back_populates="chemical")
    substitutes: list["Substitute"] = Relationship(back_populates="chemicals", link_model="Chemical_Substitute_Link")
    classes: list["Class"] = Relationship(back_populates="chemicals", link_model="Chemical_Class_Link")
    factors: list["Factor"] = Relationship(back_populates="chemical")

class FrequentStock(SQLModel, table=True):
    chemical_id: int = Field(foreign_key="chemical.id", primary_key=True)
    concentration: Optional[float]
    unit: Optional[str]
    precipitation_concentration: Optional[float]
    chemical: Chemical = Relationship(back_populates="frequentstock")

class Alias(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    chemical_id: int = Field(foreign_key="chemical.id")
    chemical: Chemical = Relationship(back_populates="aliases")

class Substitute(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    chemicals: list[Chemical] = Relationship(back_populates="substitutes", link_model="Chemical_Substitute_Link")

class Chemical_Substitute_Link(SQLModel, table=True):
    chemical_id: int = Field(foreign_key="chemical.id", primary_key=True)
    substitute_id: int = Field(foreign_key="substitute.id", primary_key=True)

class Class(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    chemicals: list[Chemical] = Relationship(back_populates="classes", link_model="Chemical_Class_Link")
    wellconditions: list["WellCondition"] = Relationship(back_populates="classes", link_model="WellCondition_Factor_Link")
    factors: list["Factor"] = Relationship(back_populates="classes", link_model="WellCondition_Factor_Link")

class Chemical_Class_Link(SQLModel, table=True):
    chemical_id: int = Field(foreign_key="chemical.id", primary_key=True)
    class_id: int = Field(foreign_key="class.id", primary_key=True)

class Factor(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chemical_id: int = Field(foreign_key="chemical.id")
    concentration: float
    unit: str
    ph: Optional[float]
    chemical: Chemical = Relationship(back_populates="factors")
    stocks: list["Stock"] = Relationship(back_populates="factor")
    wellconditions: list["WellCondition"] = Relationship(back_populates="factors", link_model="WellCondition_Factor_Link")
    classes: list[Class] = Relationship(back_populates="factors", link_model="WellCondition_Factor_Link")

class Stock(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    factor_id: int = Field(foreign_key="factor.id")
    name: str
    polar: Optional[int]
    viscosity: Optional[int]
    volatility: Optional[int]
    density: Optional[float]
    available: int
    creator: str
    location: Optional[str]
    comments: Optional[str]
    factor: Factor = Relationship(back_populates="stocks")
    hazards: list["Hazard"] = Relationship(back_populates="stocks", link_model="Stock_Hazard_Link")

class Hazard(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    stocks: list[Stock] = Relationship(back_populates="hazards", link_model="Stock_Hazard_Link")

class Stock_Hazard_Link(SQLModel, table=True):
    stock_id: int = Field(foreign_key="stock.id", primary_key=True)
    hazard_id: int = Field(foreign_key="hazard.id", primary_key=True)

class Screen(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    creator: str
    creation_date: datetime
    format_name: Optional[int]
    format_rows: Optional[int]
    format_cols: Optional[int]
    comments: Optional[str]
    frequentblock: Optional["FrequentBlock"] = Relationship(back_populates="screen")
    wells: list["Well"] = Relationship(back_populates="screen")

class FrequentBlock(SQLModel, table=True):
    screen_id: int = Field(foreign_key="screen.id", primary_key=True)
    reservoir_volume: Optional[float]
    solution_volume: Optional[float]
    screen: Screen = Relationship(back_populates="frequentblock")

class WellCondition(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    computed_similarities: int
    well: "Well" = Relationship(back_populates="wellcondition")
    factors: list[Factor] = Relationship(back_populates="wellconditions", link_model="WellCondition_Factor_Link")
    classes: list[Class] = Relationship(back_populates="wellconditions", link_model="WellCondition_Factor_Link")

class Well(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    screen_id: int = Field(foreign_key="screen.id")
    wellcondition_id: int = Field(foreign_key="wellcondition.id")
    position_number: int
    label: str
    screen: Screen = Relationship(back_populates="wells")
    wellcondition: WellCondition = Relationship(back_populates="well")

class WellCondition_Factor_Link(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    wellcondition_id: int = Field(foreign_key="wellcondition.id")
    factor_id: int = Field(foreign_key="factor.id")
    class_id: Optional[int] = Field(foreign_key="class.id")

class WellConditionSimilarity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    wellcondition_id1: int = Field(foreign_key="wellcondition.id")
    wellcondition_id2: int = Field(foreign_key="wellcondition.id")
    similarity: float
    wellcondition1: WellCondition = Relationship(back_populates=None)
    wellcondition2: WellCondition = Relationship(back_populates=None)