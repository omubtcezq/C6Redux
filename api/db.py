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
# MySQL recycles pool every 8h leading to error if not done here as well. Recycle and check before connection
engine = create_engine(read_connection_string(), echo=True, pool_recycle=3600*2, pool_pre_ping=True)

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
    chemical_abstracts_db_id: str | None = Field(default=None)
    critical_micelle_concentration: float | None = Field(default=None)
    smiles: str | None = Field(default=None)

class Chemical(ChemicalBaseLarge, table=True):
    id: int = Field(default=None, primary_key=True)
    frequentstock: Union["FrequentStock", None] = Relationship(back_populates="chemical")
    aliases: list["Alias"] = Relationship(back_populates="chemical")
    substitutes: list["Substitute"] = Relationship(back_populates="chemicals", link_model=Chemical_Substitute_Link)
    classes: list["Class"] = Relationship(back_populates="chemicals", link_model=Chemical_Class_Link)
    factors: list["Factor"] = Relationship(back_populates="chemical")

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
    classes: list["ClassRead"]

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

class WellCondition_Factor_LinkBase(SQLModel):
    wellcondition_id: int = Field(foreign_key="wellcondition.id")
    factor_id: int = Field(foreign_key="factor.id")
    class_id: int | None = Field(foreign_key="class.id")

class WellCondition_Factor_Link(WellCondition_Factor_LinkBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    wellcondition: "WellCondition" = Relationship(back_populates="factor_links")
    factor: "Factor" = Relationship(back_populates="wellcondition_links")
    classvar: "Class" = Relationship(back_populates="factor_links")

# Read when screen is read
class WellCondition_Factor_LinkRead(WellCondition_Factor_LinkBase):
    id: int
    factor: "FactorRead"
    classvar: "ClassRead | None"


# ================================== Class =================================== #

class ClassBase(SQLModel):
    name: str

class Class(ClassBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    chemicals: list[Chemical] = Relationship(back_populates="classes", link_model=Chemical_Class_Link)
    factor_links: list["WellCondition_Factor_Link"] = Relationship(back_populates="classvar")

# Read when screen is read
class ClassRead(ClassBase):
    id: int

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
    wellcondition_links: list["WellCondition_Factor_Link"] = Relationship(back_populates="factor")

# Read when screen or stock is read
class FactorRead(FactorBase):
    id: int
    chemical: ChemicalReadLite

# ============================ Stock Hazard Link ============================= #

class Stock_Hazard_Link(SQLModel, table=True):
    stock_id: int = Field(foreign_key="stock.id", primary_key=True)
    hazard_id: int = Field(foreign_key="hazard.id", primary_key=True)

# ================================== Stock =================================== #

class StockBase(SQLModel):
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

class Stock(StockBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    factor: Factor = Relationship(back_populates="stocks")
    hazards: list["Hazard"] = Relationship(back_populates="stocks", link_model=Stock_Hazard_Link)

# Read when stocks read
class StockRead(StockBase):
    id: int
    factor: FactorRead

# Read when one stocks read
class StockContentsRead(StockRead):
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
    well: "Well" = Relationship(back_populates="wellcondition")
    factor_links: list[WellCondition_Factor_Link] = Relationship(back_populates="wellcondition")

# Read when screen read
class WellConditionRead(WellConditionBase):
    id: int
    factor_links: list[WellCondition_Factor_LinkRead]

# =================================== Well =================================== #

class WellBase(SQLModel):
    screen_id: int = Field(foreign_key="screen.id")
    wellcondition_id: int = Field(foreign_key="wellcondition.id")
    position_number: int
    label: str

class Well(WellBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    screen: Screen = Relationship(back_populates="wells")
    wellcondition: WellCondition = Relationship(back_populates="well")

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