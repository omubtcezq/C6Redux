"""

"""

from sqlmodel import Session, select
from sqlalchemy.orm import subqueryload
from pydantic import BaseModel
from pydantic.functional_validators import model_validator
from enum import Enum

import api.db as db
import api.units_and_buffers as unbs

PRIMARY_CONC_VARY_MIN_MULTIPLIER = 0.8
PRIMARY_CONC_VARY_MAX_MULTIPLIER = 1.1
POLYMER_CONC_VARY_MIN_MULTIPLIER = 0.1
POLYMER_CONC_VARY_MAX_MULTIPLIER = 2
SALT_CONC_VARY_MIN_MULTIPLIER = 0.1
SALT_CONC_VARY_MAX_MULTIPLIER = 2
LIQUID_CONC_VARY_MIN_MULTIPLIER = 0.1
LIQUID_CONC_VARY_MAX_MULTIPLIER = 2
OTHER_CONC_VARY_MIN_MULTIPLIER = 0.2
OTHER_CONC_VARY_MAX_MULTIPLIER = 2
BUFFER_PH_VARY_MIN_OFFSET = 1
BUFFER_PH_VARY_MAX_OFFSET = 1

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

    # Check that relative coverage is a positive integer
    @model_validator(mode='after')
    def check_relative_covarege_positive(self):
        if (self.relative_coverage < 0):
            raise ValueError("Group factor relative coverage must be a positive integer!")
        return self

class AutoScreenMakerFactorGroup(BaseModel):
    name: str
    chemical_order: ChemicalOrder
    varied_distribution: VariedDistribution
    varied_grouping: VariedGrouping
    varied_sorted: bool
    well_coverage: float
    factors: list[AutoScreenMakerFactor]

    # Check that well coverage is a valid percentage
    @model_validator(mode='after')
    def check_well_covarege_percentage(self):
        if (self.well_coverage < 0 or self.well_coverage > 100):
            raise ValueError("Group well coverage must be a valid percentage (between 0 and 100)!")
        return self

class AdditiveAndDilution(BaseModel):
    additive: db.ScreenReadLite
    dilution: float

# ============================================================================ #
# Factor group generation
# ============================================================================ #

def make_factor_groups_from_well_ids(session: Session, well_ids: list[int]):
    primary_factors = []
    buffer_factors = []
    salt_factors = []
    polymer_factors = []
    liquid_factors = []
    other_factors = []
    for well_id in well_ids:
        wellcond_stmnt = select(db.WellCondition).join(db.Well).where(db.Well.id == well_id).options(subqueryload(db.WellCondition.factors).subqueryload(db.Factor.chemical))
        wellcond = session.exec(wellcond_stmnt).one()
        
        # Find primary factor in current condition and save to list of pirmary factors
        primary = unbs.factor_with_max_concentration_with_fallback(wellcond.factors)
        primary_factors.append(primary)

        # Identify and group remaining factors in condition
        for f in wellcond.factors:
            # Skip primary factor if one was found
            if primary and f.id == primary.id:
                continue
            
            # Search for buffers
            if unbs.is_buffer(f):
                buffer_factors.append(f)
            # Search for salts
            elif f.chemical.ions:
                salt_factors.append(f)
            # Search for polymers
            elif f.chemical.monomer or f.chemical.name.startswith('PEG'):
                polymer_factors.append(f)
            # Search for liquids
            elif f.unit == 'v/v':
                liquid_factors.append(f)
            # Otherwise group with other
            else:
                other_factors.append(f)
    
    # Create screen maker factor groups
    groups = []
    groups.append(factor_group_varying_conc_from_factors("Primary", primary_factors, PRIMARY_CONC_VARY_MIN_MULTIPLIER, PRIMARY_CONC_VARY_MAX_MULTIPLIER))
    groups.append(factor_group_buffer_from_factors("Buffer", buffer_factors))
    groups.append(factor_group_varying_conc_from_factors("Salt", salt_factors, SALT_CONC_VARY_MIN_MULTIPLIER, SALT_CONC_VARY_MAX_MULTIPLIER))
    groups.append(factor_group_varying_conc_from_factors("Polymer", polymer_factors, POLYMER_CONC_VARY_MIN_MULTIPLIER, POLYMER_CONC_VARY_MAX_MULTIPLIER))
    groups.append(factor_group_varying_conc_from_factors("Liquid", liquid_factors, LIQUID_CONC_VARY_MIN_MULTIPLIER, LIQUID_CONC_VARY_MAX_MULTIPLIER))
    groups.append(factor_group_varying_conc_from_factors("Other", other_factors, OTHER_CONC_VARY_MIN_MULTIPLIER, OTHER_CONC_VARY_MAX_MULTIPLIER))
    # Only include non-empty groups
    return [g for g in groups if len(g.factors)>0]

def factor_group_varying_conc_from_factors(name, factors, min_multiplier, max_multiplier):
    # Merging duplicates
    grouped_factors = {}
    # When varying concentration, chemical and ph need to be the same
    for f in factors:
        if (f.chemical.id, f.ph) in grouped_factors.keys():
            grouped_factors[(f.chemical.id, f.ph)].append(f)
        else:
            grouped_factors[(f.chemical.id, f.ph)] = [f]
    
    # Processing duplicates
    auto_group_factors = []
    for k in grouped_factors.keys():
        # When all units are the same, average concentration directly
        unique_units = set([f.unit for f in grouped_factors[k]])
        if len(unique_units) == 1:
            avg_conc = sum([f.concentration for f in grouped_factors[k]]) / len(grouped_factors[k])
            f = grouped_factors[k][0]
            auto_group_factors.append(AutoScreenMakerFactor(chemical=f.chemical, 
                                                            concentration=avg_conc, 
                                                            unit=f.unit, 
                                                            ph=f.ph, 
                                                            relative_coverage=1, 
                                                            vary=FactorVary.concentration, 
                                                            varied_min=round(min_multiplier*avg_conc, 3), 
                                                            varied_max=round(max_multiplier*avg_conc, 3)))
            continue

        # When units differ, avg units convertible to w/v
        concs = []
        for f in grouped_factors[k]:
            conc = unbs.unit_conversion(f.concentration, f.unit, f.chemical.density, f.chemical.molecular_weight, 'w/v')
            if conc:
                concs.append(conc)
        # Some units convertible, use them to get average, and convert back to chemical preferred units
        if len(concs) > 0:
            avg_conc = sum(concs) / len(concs)
            f = grouped_factors[k][0]
            avg_conc_best_unit = unbs.unit_conversion(avg_conc, 'w/v', f.chemical.density, f.chemical.molecular_weight, f.chemical.unit)
            auto_group_factors.append(AutoScreenMakerFactor(chemical=f.chemical, 
                                                            concentration=avg_conc_best_unit, 
                                                            unit=f.chemical.unit, 
                                                            ph=f.ph, 
                                                            relative_coverage=1, 
                                                            vary=FactorVary.concentration, 
                                                            varied_min=round(min_multiplier*avg_conc_best_unit, 3), 
                                                            varied_max=round(max_multiplier*avg_conc_best_unit, 3)))
        # No units convertible, arbitrarily take first factor conc as mean
        else:
            f = grouped_factors[k][0]
            auto_group_factors.append(AutoScreenMakerFactor(chemical=f.chemical, 
                                                            concentration=f.concentration, 
                                                            unit=f.unit, 
                                                            ph=f.ph, 
                                                            relative_coverage=1, 
                                                            vary=FactorVary.concentration, 
                                                            varied_min=round(min_multiplier*f.concentration, 3), 
                                                            varied_max=round(max_multiplier*f.concentration, 3)))
    
    # Make automatic group and return
    g = AutoScreenMakerFactorGroup(name=name, 
                                   chemical_order=ChemicalOrder.random, 
                                   varied_distribution=VariedDistribution.gaussian, 
                                   varied_grouping=VariedGrouping.none, 
                                   varied_sorted=False, 
                                   well_coverage=100,
                                   factors=auto_group_factors)
    return g

def factor_group_buffer_from_factors(name, factors):
    # Merging duplicates
    grouped_factors = {}
    curve_lookup = {}
    # When varying ph, chemical and (curve xor hh pka) need to be the same
    for f in factors:
        # Arbitrarily only consider the first curve, highly unlikely for there to be more, fine to make new groups in this case
        curves = unbs.get_phcurves_relevant_to_buffer(f)
        hh_pka = None
        if len(curves) == 0:
            hh_pka = unbs.get_henderson_hasselbalch_pka_relevant_to_buffer(f)
            curve_id = None
        else:
            curve_id = curves[0].id
            curve_lookup[curve_id] = curves[0]

        if (f.chemical.id, curve_id, hh_pka) in grouped_factors.keys():
            grouped_factors[(f.chemical.id, curve_id, hh_pka)].append(f)
        else:
            grouped_factors[(f.chemical.id, curve_id, hh_pka)] = [f]
    
    # Processing duplicates
    auto_group_factors = []
    for k in grouped_factors.keys():
        # If pka in key, use it for the ph
        if k[2]:
            ph_to_use = k[2]
            ph_bottom = ph_to_use - BUFFER_PH_VARY_MIN_OFFSET
            ph_top = ph_to_use + BUFFER_PH_VARY_MAX_OFFSET
        # If not then curve is, use it for ph
        else:
            ph_to_use = sum([f.ph for f in grouped_factors[k]]) / len(grouped_factors[k])
            curve = curve_lookup[k[1]]
            ph_bottom = ph_to_use - BUFFER_PH_VARY_MIN_OFFSET
            if ph_bottom < curve.low_range:
                ph_bottom = curve.low_range
            ph_top = ph_to_use + BUFFER_PH_VARY_MAX_OFFSET
            if ph_top > curve.high_range:
                ph_top = curve.high_range

        f = grouped_factors[k][0]
        if f.chemical.unit == 'M' or f.chemical.unit == 'mM':
            best_unit = 'M'
            conc = 0.2
        else:
            best_unit = 'w/v'
            conc = 20
        auto_group_factors.append(AutoScreenMakerFactor(chemical=f.chemical, 
                                                        concentration=conc, 
                                                        unit=best_unit, 
                                                        ph=ph_to_use, 
                                                        relative_coverage=1, 
                                                        vary=FactorVary.ph, 
                                                        varied_min=round(ph_bottom, 3), 
                                                        varied_max=round(ph_top,3)))

    # Make automatic group and return
    g = AutoScreenMakerFactorGroup(name=name, 
                                   chemical_order=ChemicalOrder.random, 
                                   varied_distribution=VariedDistribution.gaussian, 
                                   varied_grouping=VariedGrouping.none, 
                                   varied_sorted=False, 
                                   well_coverage=100,
                                   factors=auto_group_factors)
    return g

def make_condition_grid_from_factor_groups(session: Session, factor_groups: list[AutoScreenMakerFactorGroup], additive_and_dilution: AdditiveAndDilution, included_wells: list[db.WellReadLite], size: int):
    if size == 24:
        rows = 4
        cols = 6
    elif size == 48:
        rows = 6
        cols = 8
    else:
        rows = 8
        cols = 12
    
    # Create well grid
    grid = []
    for i in range(rows):
        row = []
        for j in range(cols):
            condition = db.WellCondition(computed_similarities=0)
            row.append(condition)
        grid.append(row)
    
    # Process factor groups
    for g in factor_groups:
        # How many wells contiain this group
        wells_in_group = int(g.well_coverage * size / 100)
        # How many do not
        wells_not_in_group = size - wells_in_group
        # How many factors
        factors_in_group = len(g.factors)
        relative_coverage_sum = sum([f.relative_coverage for f in g.factors])

        # Get the number of wells that will contain each factor

        if g.chemical_order == ChemicalOrder.random:
            factor_draws_to_make = wells_in_group
            for f in g.factors:
                # How many wells contain this factor
                wells_with_factor = int(f.relative_coverage/relative_coverage_sum * wells_in_group) # What if columns or rows - won't work

        elif g.chemical_order == ChemicalOrder.column:
            factor_draws_to_make = wells_in_group / cols # What if more factors than columns

        elif g.chemical_order == ChemicalOrder.row:
            factor_draws_to_make = wells_in_group / rows

        elif g.chemical_order == ChemicalOrder.quadrant:
            factor_draws_to_make = wells_in_group / 4

        # When selecting factor in group include possible "empty factor" that handles <100% well coverage
        pass
        

    # Add additive


    # Overwrite some conditions with included wells
    # These start at c3 (avoids edge effects and references old lab name - hehe)



    pass