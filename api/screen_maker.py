"""

"""

from sqlmodel import Session, select
from sqlalchemy.orm import subqueryload
from pydantic import BaseModel
from enum import Enum

import api.db as db

# ============================================================================ #
# Factor group type model
# ============================================================================ #

class ChemicalOrder(str, Enum):
    random = "random"
    column = "column"
    row = "row"
    quadrant = "quadrant"

class VariedDistribution(str, Enum):
    gaussian = "gaussian"
    uniform = "uniform"
    stepwise = "stepwise"

class VariedGrouping(str, Enum):
    none = "none"
    column = "column"
    row = "row"
    quadrant = "quadrant"
    half = "half"

class FactorVary(str, Enum):
    concentration = "concentration"
    ph = "ph"
    none = "none"

class AutoScreenMakerFactor(BaseModel):
    chemical: db.ChemicalReadLite
    concentration: float | None
    unit: str
    ph: float | None
    relative_coverage: int
    vary: FactorVary
    varied_min: float | None
    varied_max: float | None

class AutoScreenMakerFactorGroup(BaseModel):
    name: str
    chemical_order: ChemicalOrder
    varied_distribution: VariedDistribution
    varied_grouping: VariedGrouping
    varied_sorted: bool
    factors: list[AutoScreenMakerFactor]

# ============================================================================ #
# Factor group generation
# ============================================================================ #

def make_factor_groups_from_wells(session: Session, wells: list[db.WellRead]):
    primary_factors = []
    buffer_fators = []
    salt_factors = []
    polymer_factors = []
    other_fators = []
    for well in wells:
        wellcond_stmnt = select(db.WellCondition).where(db.WellCondition.id == well.wellcondition_id).options(subqueryload(db.WellCondition.factors).subqueryload(db.Factor.chemical))
        wellcond = session.exec(wellcond_stmnt).all()
        
        # Find primary factor
        primary_factor_id = None
        max_conc = 0
        for f in wellcond.factors:
            # TODO concentrations are not always in the same unit - this needs to be handled as best as possible
            if f.concentration > max_conc:
                primary_factor_id = f.id
                max_conc = f.concentration
        primary_factors.append(f)

        # Group remaining factors
        for f in wellcond.factors:
            # Skip primary factor
            if f.id == primary_factor_id:
                continue
            
            # Search for buffer
            if f.ph and any([f.chemical.pka1 and abs(f.chemical.pka1 - f.ph) <= 1.2, 
                             f.chemical.pka2 and abs(f.chemical.pka2 - f.ph) <= 1.2, 
                             f.chemical.pka3 and abs(f.chemical.pka3 - f.ph) <= 1.2]):
                buffer_fators.append(f)
            # Search for salt
            elif f.chemical.ions:
                salt_factors.append(f)
            # Search for polymer
            elif f.chemical.monomer:
                polymer_factors.append(f)
            # Otherwise group with other
            else:
                other_fators.append(f)
    
    # Create screen maker factor groups
    primary = factor_group_from_well_factors("Primary", primary_factors)
    buffer = factor_group_from_well_factors("Buffer", buffer_fators, True)
    salt = factor_group_from_well_factors("Salt", salt_factors)
    polymer = factor_group_from_well_factors("Polymer", polymer_factors)
    other = factor_group_from_well_factors("Other", other_fators)
    # Only include non-empty groups
    groups = []
    if primary:
        groups.append(primary)
    if buffer:
        groups.append(buffer)
    if salt:
        groups.append(salt)
    if polymer:
        groups.append(polymer)
    if other:
        groups.append(other)
    return groups

def factor_group_from_well_factors(name, factors, vary_ph=False):
    group_factors = []
    fin_conc = None
    fin_ph = None
    for f in factors:
        for gf in group_factors:
            if f.chemical.id == gf.chemical.id:
                pass
        # TODO check for duplicates
        # TODO compute avg conc of dupes
        # TODO ph relevant pka or curve
        group_factors.append(AutoScreenMakerFactor(chemical=f.chemical, 
                                        concentration=f.concentration, 
                                        unit=f.unit, 
                                        ph=f.ph, 
                                        relative_coverage=1, 
                                        vary=FactorVary.none, 
                                        varied_min=None, 
                                        varied_max=None))
    g = AutoScreenMakerFactorGroup(name=name, 
                                   chemical_order=ChemicalOrder.random, 
                                   varied_distribution=VariedDistribution.gaussian, 
                                   varied_grouping=VariedGrouping.none, 
                                   varied_sorted=False, 
                                   factors=fs)
    return g

def make_screen_from_factor_groups(session: Session, factor_groups: list[AutoScreenMakerFactorGroup]):
    pass