"""

"""

import configparser as cp
from sqlmodel import Field, Session, SQLModel, Relationship, create_engine
from datetime import datetime
from typing import Union

def make_connection_string(prefix, username, password, ip, port, database_name):
    return "%s://%s:%s@%s:%s/%s" % (prefix, username, password, ip, port, database_name) 

# Read config for database connection string
def connection_string(write=False):
    config = cp.ConfigParser()
    config.read("api/api.ini")
    db = config["DATABASE"]
    if not write:
        username = db["readonly-username"]
        password = db["readonly-password"]
    else:
        username = db["write-username"]
        password = db["write-password"]
    prefix = db["type_prefix"]
    ip = db["ip"]
    port = db["port"]
    database_name = db["database_name"]
    return make_connection_string(prefix, username, password, ip, port, database_name)

# Create engine object for subsequent queries
# MySQL recycles pool every 8h leading to error if not done here as well. Recycle and check before connection
readonly_engine = create_engine(connection_string(), echo=True, pool_recycle=3600*2, pool_pre_ping=True)
write_engine = create_engine(connection_string(True), echo=True, pool_recycle=3600*2, pool_pre_ping=True)

# Get a db session to use with fastapi dependencies
def get_readonly_session():
    with Session(readonly_engine) as session:
        yield session

def get_write_session():
    with Session(write_engine) as session:
        yield session

# Mapping DB tables to Python classes and input and output objects

# ========================= Chemical Substitute Link ========================= #

class Chemical_Substitute_Link(SQLModel, table=True):
    chemical_id: int = Field(foreign_key="chemical.id", primary_key=True)
    substitute_id: int = Field(foreign_key="substitute.id", primary_key=True)

# ================================= Chemical ================================= #

class ChemicalBase(SQLModel):
    name: str

class ChemicalBaseLarge(ChemicalBase):
    unit: str | None = Field(default=None)
    formula: str | None = Field(default=None)
    density: float | None = Field(default=None)
    solubility: float | None = Field(default=None)
    pka1: float | None = Field(default=None)
    pka2: float | None = Field(default=None)
    pka3: float | None = Field(default=None)
    molecular_weight: float | None = Field(default=None)
    ions: str | None = Field(default=None)
    monomer: str | None = Field(default=None)
    chemical_abstracts_db_id: str | None = Field(default=None)
    critical_micelle_concentration: float | None = Field(default=None)
    smiles: str | None = Field(default=None)

class Chemical(ChemicalBaseLarge, table=True):
    id: int = Field(default=None, primary_key=True)
    frequentstock: Union["FrequentStock", None] = Relationship(back_populates="chemical")
    aliases: list["Alias"] = Relationship(back_populates="chemical")
    substitutes: list["Substitute"] = Relationship(back_populates="chemicals", link_model=Chemical_Substitute_Link)
    factors: list["Factor"] = Relationship(back_populates="chemical")
    phcurves: list["PhCurve"] = Relationship(back_populates="chemical", sa_relationship_kwargs={"foreign_keys": "[PhCurve.chemical_id]"})
    low_chemical_phcurves: list["PhCurve"] = Relationship(back_populates="low_chemical", sa_relationship_kwargs={"foreign_keys": "[PhCurve.low_chemical_id]"})
    high_chemical_phcurves:  list["PhCurve"] = Relationship(back_populates="high_chemical", sa_relationship_kwargs={"foreign_keys": "[PhCurve.high_chemical_id]"})

# Read when screen or stock read
class ChemicalReadLite(ChemicalBase):
    id: int

# Read when chemical names read
class ChemicalReadLiteAlias(ChemicalReadLite):
    aliases: list["AliasRead"]

# Read when chemical list is read or when chemical selected in query and units needed
class ChemicalRead(ChemicalBaseLarge):
    id: int

# Read when chemical is read
class ChemicalContentsRead(ChemicalBaseLarge):
    id: int
    frequentstock: "FreqentStockRead | None" = None
    aliases: list["AliasRead"]
    substitutes: list["SubstituteRead"]

# ============================== FrequentStock =============================== #

class FrequentStockBase(SQLModel):
    chemical_id: int = Field(foreign_key="chemical.id", primary_key=True)
    concentration: float | None = Field(default=None)
    unit: str | None = Field(default=None)
    precipitation_concentration: float | None = Field(default=None)

class FrequentStock(FrequentStockBase, table=True):
    chemical: Chemical = Relationship(back_populates="frequentstock")

# Read when chemical is read
class FreqentStockRead(FrequentStockBase):
    pass

# ================================== Alias =================================== #

class AliasBase(SQLModel):
    name: str
    chemical_id: int = Field(foreign_key="chemical.id")

class Alias(AliasBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    chemical: Chemical = Relationship(back_populates="aliases")

# Read when chemical is read
class AliasRead(AliasBase):
    id: int

# ================================ Substitute ================================ #

class SubstituteBase(SQLModel):
    name: str

class Substitute(SubstituteBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    chemicals: list[Chemical] = Relationship(back_populates="substitutes", link_model=Chemical_Substitute_Link)

# Read when substitute is read
class SubstituteRead(SubstituteBase):
    id: int

# ======================== WellCondition Factor Link ========================= #

class WellCondition_Factor_Link(SQLModel, table=True):
    wellcondition_id: int = Field(foreign_key="wellcondition.id", primary_key=True)
    factor_id: int = Field(foreign_key="factor.id", primary_key=True)

# ================================== Factor ================================== #

class FactorBase(SQLModel):
    chemical_id: int = Field(foreign_key="chemical.id")
    concentration: float
    unit: str
    ph: float | None = Field(default=None)

class Factor(FactorBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    chemical: Chemical = Relationship(back_populates="factors")
    stocks: list["Stock"] = Relationship(back_populates="factor")
    wellconditions: list["WellCondition"] = Relationship(back_populates="factors", link_model=WellCondition_Factor_Link)

# Read when screen or stock is read
class FactorRead(FactorBase):
    id: int
    chemical: ChemicalReadLite

# Use when creating stock
class FactorCreate(FactorBase):
    pass

# ============================ Stock Hazard Link ============================= #

class Stock_Hazard_Link(SQLModel, table=True):
    stock_id: int = Field(foreign_key="stock.id", primary_key=True)
    hazard_id: int = Field(foreign_key="hazard.id", primary_key=True)

# ================================== Stock =================================== #

class StockBase(SQLModel):
    name: str
    polar: int | None = Field(default=None)
    viscosity: int | None = Field(default=None)
    volatility: int | None = Field(default=None)
    density: float | None = Field(default=None)
    available: int
    creator: str
    location: str | None = Field(default=None)
    comments: str | None = Field(default=None)

class StockReadBase(StockBase):
    factor_id: int = Field(foreign_key="factor.id")

class Stock(StockReadBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    factor: Factor = Relationship(back_populates="stocks")
    hazards: list["Hazard"] = Relationship(back_populates="stocks", link_model=Stock_Hazard_Link)

# Read when recipe generated
class StockReadLite(StockReadBase):
    id: int

# Read when stocks read
class StockRead(StockReadBase):
    id: int
    factor: FactorRead

# Read when one stock read
class StockContentsRead(StockRead):
    hazards: list["HazardRead"]

# Use when updating stock
class StockUpdate(StockBase):
    id: int
    factor: FactorCreate
    hazards: list["HazardRead"]

# Use when creating a stock
class StockCreate(StockBase):
    factor: FactorCreate
    hazards: list["HazardRead"]

# ================================== Hazard ================================== #

class HazardBase(SQLModel):
    name: str

class Hazard(HazardBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    stocks: list[Stock] = Relationship(back_populates="hazards", link_model=Stock_Hazard_Link)

# Read when stocks read
class HazardRead(HazardBase):
    id: int

# ================================== PhCurve ================================== #

class PhCurveBase(SQLModel):
    chemical_id: int = Field(foreign_key="chemical.id")
    low_range: float
    low_chemical_id: int = Field(foreign_key="chemical.id")
    high_range: float
    high_chemical_id: int = Field(foreign_key="chemical.id")
    hh: int

class PhCurve(PhCurveBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    chemical: Chemical = Relationship(back_populates="phcurves", sa_relationship_kwargs={"foreign_keys": "[PhCurve.chemical_id]"})
    low_chemical: Chemical = Relationship(back_populates="low_chemical_phcurves", sa_relationship_kwargs={"foreign_keys": "[PhCurve.low_chemical_id]"})
    high_chemical: Chemical = Relationship(back_populates="high_chemical_phcurves", sa_relationship_kwargs={"foreign_keys": "[PhCurve.high_chemical_id]"})
    points: list["PhPoint"] = Relationship(back_populates="phcurve")

# ================================== PhPoint ================================== #

class PhPointBase(SQLModel):
    phcurve_id: int = Field(foreign_key="phcurve.id")
    high_chemical_percentage: float
    result_ph: float

class PhPoint(PhPointBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    phcurve: PhCurve = Relationship(back_populates="points")

# ================================== Screen ================================== #

class ScreenBase(SQLModel):
    name: str

class ScreenBaseLarge(ScreenBase):
    owned_by: str
    creation_date: datetime | None
    format_name: str | None = Field(default=None)
    format_rows: int | None = Field(default=None)
    format_cols: int | None = Field(default=None)
    comments: str | None = Field(default=None)

class Screen(ScreenBaseLarge, table=True):
    id: int | None = Field(default=None, primary_key=True)
    frequentblock: Union["FrequentBlock", None] = Relationship(back_populates="screen")
    wells: list["Well"] = Relationship(back_populates="screen")

class ScreenNew(ScreenBase):
    pass

# Read when screen names read
class ScreenReadLite(ScreenBase):
    id: int

# Read when screen list is read
class ScreenRead(ScreenBaseLarge):
    id: int

# Read when screen is read
class ScreenContentsRead(ScreenBaseLarge):
    wells: list["WellRead"]

# ============================== FrequentBlock =============================== #

class FrequentBlockBase(SQLModel):
    screen_id: int = Field(foreign_key="screen.id", primary_key=True)
    reservoir_volume: float | None = Field(default=None)
    solution_volume: float | None = Field(default=None)

class FrequentBlock(FrequentBlockBase, table=True):
    screen: Screen = Relationship(back_populates="frequentblock")

# Read when screen list or screen read
class FrequentBlockRead(FrequentBlockBase):
    pass

# ============================== WellCondition =============================== #

class WellConditionBase(SQLModel):
    computed_similarities: int

class WellCondition(WellConditionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    wells: list["Well"] = Relationship(back_populates="wellcondition")
    factors: list[Factor] = Relationship(back_populates="wellconditions", link_model=WellCondition_Factor_Link)

# Read when screen read
class WellConditionRead(WellConditionBase):
    id: int
    factors: list[FactorRead]

# =================================== Well =================================== #

class WellBase(SQLModel):
    screen_id: int = Field(foreign_key="screen.id")
    wellcondition_id: int = Field(foreign_key="wellcondition.id")
    position_number: int
    label: str

class Well(WellBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    screen: Screen = Relationship(back_populates="wells")
    wellcondition: WellCondition = Relationship(back_populates="wells")

# Read when condition by reference dropdown read
class WellReadLite(WellBase):
    id: int

# Read when screen read
class WellRead(WellBase):
    id: int
    wellcondition: WellConditionRead

# ========================= WellConditionSimilarity ========================== #

class WellConditionSimilarity(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    wellcondition_id1: int = Field(foreign_key="wellcondition.id")
    wellcondition_id2: int = Field(foreign_key="wellcondition.id")
    similarity: float
    wellcondition1: WellCondition = Relationship(sa_relationship_kwargs={"foreign_keys": "[WellConditionSimilarity.wellcondition_id1]"})
    wellcondition2: WellCondition = Relationship(sa_relationship_kwargs={"foreign_keys": "[WellConditionSimilarity.wellcondition_id2]"})

# ============================== ApiUser =============================== #

class ApiUserBase(SQLModel):
    username: str
    write_permission: int

class ApiUser(ApiUserBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    password_hash: str

# Read when authorised user requested from token
class ApiUserRead(ApiUserBase):
    id: int
