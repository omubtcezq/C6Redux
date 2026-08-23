"""

"""

from sqlmodel import Session, select
from sqlalchemy.orm import subqueryload
from pydantic import BaseModel
from pydantic.functional_validators import model_validator
from enum import Enum
from random import random, choices
from numpy import random as nprandom
from math import floor

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
    column = "column"
    row = "row"
    quadrant = "quadrant"
    uniform = "uniform"
    stepwise = "stepwise"
    uniform_random = "uniform_random"
    gaussian_random = "gaussian_random"
    uniform_random_sorted = "uniform_random_sorted"
    gaussian_random_sorted = "gaussian_random_sorted"

class Location(str, Enum):
    random = "random"
    column = "column"
    row = "row"
    quadrant = "quadrant"
    page = "page"
    fixed = "fixed"
    

class VariedDistribution(str, Enum):
    gaussian = "gaussian"
    uniform = "uniform"

class VariedGrouping(str, Enum):
    none = "none"
    series = "series"

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
    location: Location
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

# defines how much of the screen to generate wells for
class RangeDimensions(BaseModel):
    left: int
    right: int
    top: int
    bottom: int

class ConditionGridQuery(BaseModel):
    factor_groups: list[AutoScreenMakerFactorGroup]
    additive_and_dilution: AdditiveAndDilution | None = None
    included_wells_ids: list[int] 
    size: int
    range_dimensions: RangeDimensions | None = None

class GridFactor(BaseModel):
    chemical: db.ChemicalReadLite
    concentration: float | None
    unit: str
    ph: float | None
    group_name: str
    ammt: float

class GridWell(BaseModel):
    condition: list[GridFactor | None]

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
                                                            concentration=round(avg_conc, 3), 
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
                                                            concentration=round(avg_conc_best_unit, 3), 
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
                                                            concentration=round(f.concentration, 3), 
                                                            unit=f.unit, 
                                                            ph=f.ph, 
                                                            relative_coverage=1, 
                                                            vary=FactorVary.concentration, 
                                                            varied_min=round(min_multiplier*f.concentration, 3), 
                                                            varied_max=round(max_multiplier*f.concentration, 3)))
    
    # Make automatic group and return
    g = AutoScreenMakerFactorGroup(name=name,
                                   chemical_order=ChemicalOrder.gaussian_random, 
                                   location=Location.random,
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
            conc = 0.1
        else:
            best_unit = 'w/v'
            conc = 10
        auto_group_factors.append(AutoScreenMakerFactor(chemical=f.chemical, 
                                                        concentration=conc, 
                                                        unit=best_unit, 
                                                        ph=round(ph_to_use, 3), 
                                                        relative_coverage=1, 
                                                        vary=FactorVary.ph, 
                                                        varied_min=round(ph_bottom, 3), 
                                                        varied_max=round(ph_top,3)))

    # Make automatic group and return
    g = AutoScreenMakerFactorGroup(name=name, 
                                   chemical_order=ChemicalOrder.gaussian_random, 
                                   location=Location.random,
                                   well_coverage=100,
                                   factors=auto_group_factors)
    return g


def factor_from_group(g: AutoScreenMakerFactorGroup, i, j, i_max, j_max):
    if g.location == Location.random:
        return choices(g.factors, weights=map(lambda f: f.relative_coverage, g.factors), k=1)[0]
    if g.location == Location.column:
        return g.factors[floor((j / j_max) * len(g.factors))]
    if g.location == Location.row:
        return g.factors[floor((i / i_max) * len(g.factors))]
    if g.location == Location.quadrant:
        if i < (i_max // 2):
            if j < (j_max // 2):
                return g.factors[0]
        if i < (i_max // 2):
            if j >= (j_max // 2):
                return g.factors[1]
        if i >= (i_max // 2):
            if j < (j_max // 2):
                return g.factors[2]
        if i >= (i_max // 2):
            if j >= (j_max // 2):
                return g.factors[3]
    if g.location == Location.page:
        if j < (j_max // 2):
            return g.factors[0]
        else:
            return g.factors[1]
    if g.location == Location.fixed:
        return g.factors[0]


# Helper: given a group and a cell (i,j) in a grid of size rows x cols, return the bounds
# (start_row, end_row, start_col, end_col) of the region that the cell belongs to for that group's location
def region_bounds_for_cell(g: AutoScreenMakerFactorGroup, i, j, rows, cols):
    num = len(g.factors) if g.factors else 1
    # default full grid
    start_row, end_row, start_col, end_col = 0, rows - 1, 0, cols - 1

    if num <= 1 or g.location == Location.random or g.location == Location.fixed:
        return start_row, end_row, start_col, end_col

    if g.location == Location.column:
        # determine which factor's column block this j belongs to
        factor_idx = int(floor((j / cols) * num))
        factor_idx = max(0, min(num - 1, factor_idx))
        start_col = int(floor((factor_idx * cols) / num))
        end_col = int(floor(((factor_idx + 1) * cols) / num)) - 1
        if end_col < start_col:
            end_col = start_col
        return start_row, end_row, start_col, end_col

    if g.location == Location.row:
        factor_idx = int(floor((i / rows) * num))
        factor_idx = max(0, min(num - 1, factor_idx))
        start_row = int(floor((factor_idx * rows) / num))
        end_row = int(floor(((factor_idx + 1) * rows) / num)) - 1
        if end_row < start_row:
            end_row = start_row
        return start_row, end_row, start_col, end_col

    if g.location == Location.quadrant:
        mid_row = rows // 2
        mid_col = cols // 2
        if i < mid_row:
            start_row = 0
            end_row = mid_row - 1 if mid_row > 0 else 0
            if j < mid_col:
                start_col = 0
                end_col = mid_col - 1 if mid_col > 0 else 0
            else:
                start_col = mid_col
                end_col = cols - 1
        else:
            start_row = mid_row
            end_row = rows - 1
            if j < mid_col:
                start_col = 0
                end_col = mid_col - 1 if mid_col > 0 else 0
            else:
                start_col = mid_col
                end_col = cols - 1
        return start_row, end_row, start_col, end_col

    if g.location == Location.page:
        mid_col = cols // 2
        if j < mid_col:
            return 0, rows - 1, 0, mid_col - 1 if mid_col > 0 else 0
        else:
            return 0, rows - 1, mid_col, cols - 1

    # fallback
    return start_row, end_row, start_col, end_col


def region_key(g: AutoScreenMakerFactorGroup, i, j, rows, cols):
    srow, erow, scol, ecol = region_bounds_for_cell(g, i, j, rows, cols)
    return (srow, erow, scol, ecol)



def make_condition_grid_from_factor_groups(session: Session, query: ConditionGridQuery):
    size = query.size
    if size == 24:
        grid_rows = 4
        grid_cols = 6
    elif size == 48:
        grid_rows = 6
        grid_cols = 8
    else:
        grid_rows = 8
        grid_cols = 12
    
    if query.range_dimensions == None:
        rows = grid_rows
        cols = grid_cols
    else:
        cols = query.range_dimensions.right - query.range_dimensions.left + 1
        rows = query.range_dimensions.bottom - query.range_dimensions.top + 1    
    
    # Create well grid
    filled_grid = []
    for i in range(rows):
        row = []
        for j in range(cols):
            condition = GridWell(condition=[])
            row.append(condition)
        filled_grid.append(row)


    # make factors (making factors before makes it easier to deal with sorting)
    random_generated_factors = {}
    for g in query.factor_groups:
        if len(g.factors) == 0:
            continue

        # Helper to produce a GridFactor from a factor and ammt
        def make_gridfactor_from(factor, ammt, gname):
            if factor is None:
                return None
            if factor.vary == "ph":
                return GridFactor(chemical= factor.chemical, ammt = ammt, unit = factor.unit, ph = round(factor.varied_min + (factor.varied_max - factor.varied_min) * ammt, ndigits=2), concentration = factor.concentration, vary= factor.vary, group_name = gname)
            elif factor.vary == "concentration":
                return GridFactor(chemical= factor.chemical, ammt = ammt, unit = factor.unit, ph = factor.ph, concentration = round(factor.varied_min + (factor.varied_max - factor.varied_min) * ammt, ndigits=2), vary= factor.vary, group_name = gname)
            else:
                return GridFactor(chemical= factor.chemical, ammt = .5, unit = factor.unit, ph = factor.ph, concentration = factor.concentration, vary= factor.vary, group_name = gname)

        # RANDOMIZED orders: generate ammt lists per region so variation is localized to group's location
        if g.chemical_order in ("gaussian_random", "uniform_random", "gaussian_random_sorted", "uniform_random_sorted"):
            region_ammt = {}
            # Generate ammt values per cell but bucket them by region
            for ii in range(rows):
                for jj in range(cols):
                    if g.chemical_order in ("gaussian_random", "gaussian_random_sorted"):
                        val = max(min(nprandom.normal(loc=.5, scale=.2), 1), 0)
                    else:
                        val = random()
                    key = region_key(g, ii, jj, rows, cols)
                    region_ammt.setdefault(key, []).append(val)

            # Sort if requested, per-region
            if g.chemical_order in ("gaussian_random_sorted", "uniform_random_sorted"):
                for k in region_ammt:
                    region_ammt[k].sort(reverse=True)

            # Build factor_list in same iteration order but consume from region lists
            factor_list = []
            for ii in range(rows):
                for jj in range(cols):
                    key = region_key(g, ii, jj, rows, cols)
                    ammt = region_ammt[key].pop(0)
                    if random() * 100 < g.well_coverage:
                        factor = factor_from_group(g, ii, jj, rows, cols)
                        gf = make_gridfactor_from(factor, ammt, g.name)
                        factor_list.append(gf)
                    else:
                        factor_list.append(None)

            random_generated_factors[g.name] = factor_list
            continue

        # For ordering types that have a directional/ordered ammt (row/column/stepwise/uniform), compute ammt relative to the cell's region
        if g.chemical_order == "row":
            for ii in range(rows):
                for jj in range(cols):
                    if random() * 100 < g.well_coverage:
                        factor = factor_from_group(g, ii, jj, rows, cols)
                        srow, erow, scol, ecol = region_bounds_for_cell(g, ii, jj, rows, cols)
                        local_rows = erow - srow + 1
                        local_i = ii - srow
                        if local_rows <= 1:
                            ammt = .5
                        else:
                            ammt = local_i / (local_rows - 1)
                        f = make_gridfactor_from(factor, ammt, g.name)
                        filled_grid[ii][jj].condition.append(f)
                    else:
                        filled_grid[ii][jj].condition.append(None)
            continue

        if g.chemical_order == "column":
            for jj in range(cols):
                for ii in range(rows):
                    if random() * 100 < g.well_coverage:
                        factor = factor_from_group(g, ii, jj, rows, cols)
                        srow, erow, scol, ecol = region_bounds_for_cell(g, ii, jj, rows, cols)
                        local_cols = ecol - scol + 1
                        local_j = jj - scol
                        if local_cols <= 1:
                            ammt = .5
                        else:
                            ammt = local_j / (local_cols - 1)
                        f = make_gridfactor_from(factor, ammt, g.name)
                        filled_grid[ii][jj].condition.append(f)
                    else:
                        filled_grid[ii][jj].condition.append(None)
            continue

        if g.chemical_order == "quadrant":
            # preserve existing quadrant pattern (four quadrant amplitude mapping)
            def add_to_grid(ii, jj, ammt):
                if random() * 100 < g.well_coverage:
                    factor = factor_from_group(g, ii, jj, rows, cols)
                    f = make_gridfactor_from(factor, ammt, g.name)
                    filled_grid[ii][jj].condition.append(f)
                else:
                    filled_grid[ii][jj].condition.append(None)

            for ii in range(rows // 2):
                for jj in range(cols // 2):
                    add_to_grid(ii, jj, 0)
            for ii in range(rows - rows // 2):
                for jj in range(cols // 2):
                    add_to_grid(rows // 2 + ii, jj, .33)
            for ii in range(rows // 2):
                for jj in range(cols - cols // 2):
                    add_to_grid(ii, cols // 2 + jj, .66)
            for ii in range(rows - rows // 2):
                for jj in range(cols - cols // 2):
                    add_to_grid(rows // 2 + ii, cols // 2 + jj, 1)
            continue

        if g.chemical_order == "uniform":
            for jj in range(cols):
                for ii in range(rows):
                    if random() * 100 < g.well_coverage:
                        factor = factor_from_group(g, ii, jj, rows, cols)
                        ammt = .5
                        f = make_gridfactor_from(factor, ammt, g.name)
                        filled_grid[ii][jj].condition.append(f)
                    else:
                        filled_grid[ii][jj].condition.append(None)
            continue

        if g.chemical_order == "stepwise":
            for ii in range(rows):
                for jj in range(cols):
                    if random() * 100 < g.well_coverage:
                        factor = factor_from_group(g, ii, jj, rows, cols)
                        srow, erow, scol, ecol = region_bounds_for_cell(g, ii, jj, rows, cols)
                        local_rows = erow - srow + 1
                        local_cols = ecol - scol + 1
                        local_i = ii - srow
                        local_j = jj - scol
                        local_total = local_rows * local_cols
                        local_index = local_i * local_cols + local_j
                        if local_total <= 1:
                            ammt = .5
                        else:
                            ammt = local_index / (local_total - 1)
                        f = make_gridfactor_from(factor, ammt, g.name)
                        filled_grid[ii][jj].condition.append(f)
                    else:
                        filled_grid[ii][jj].condition.append(None)
            continue = factor.concentration, group_name = g.name)
                    filled_grid[i][j].condition.append(f)
                else:
                    filled_grid[i][j].condition.append(None)

            for i in range(rows // 2):
                for j in range(cols // 2):
                    add_to_grid(i, j, 0)
            for i in range(rows - rows // 2):
                for j in range(cols // 2):
                    add_to_grid(rows // 2 + i, j, .33)
            for i in range(rows // 2):
                for j in range(cols - cols // 2):
                    add_to_grid(i, cols // 2 + j, .66)
            for i in range(rows - rows // 2):
                for j in range(cols - cols // 2):
                    add_to_grid(rows // 2 + i, cols // 2 + j, 1)

                    

        if g.chemical_order == "uniform":
            index = 0
            for j in range(cols):
                for i in range(rows):
                    if random() * 100 < g.well_coverage:
                        factor = factor_from_group(g, i, j, rows, cols)
                        ammt = .5
                        f = GridFactor(chemical= factor.chemical, ammt = ammt, unit = factor.unit, ph = factor.ph, concentration = factor.concentration, group_name = g.name)
                        filled_grid[i][j].condition.append(f)
                        index += 1
                    else:
                        filled_grid[i][j].condition.append(None)

        if g.chemical_order == "stepwise":         
            index = 0
            for i in range(rows):
                for j in range(cols):
                    if random() * 100 < g.well_coverage:
                        factor = factor_from_group(g, i, j, rows, cols)
                        if rows == 1 and cols == 1:
                            ammt = .5
                        else:
                            ammt = index / ((rows * cols) - 1)
                        f = None
                        if factor.vary == "ph":
                            f = GridFactor(chemical= factor.chemical, ammt = ammt, unit = factor.unit, ph = round(factor.varied_min + (factor.varied_max - factor.varied_min) * ammt, ndigits=2), concentration = factor.concentration, group_name = g.name)
                        elif factor.vary == "concentration":
                            f = GridFactor(chemical= factor.chemical, ammt = ammt, unit = factor.unit, ph = factor.ph, concentration = round(factor.varied_min + (factor.varied_max - factor.varied_min) * ammt, ndigits=2), group_name = g.name)
                        else:    
                            ammt = .5
                            f = GridFactor(chemical= factor.chemical, ammt = ammt, unit = factor.unit, ph = factor.ph, concentration = factor.concentration, group_name = g.name)
                        filled_grid[i][j].condition.append(f)
                        index += 1
                    else:
                        filled_grid[i][j].condition.append(None)

     # insert random factors into grid
    for i in range(rows):
        for j in range(cols):
            for group_name in random_generated_factors:
                filled_grid[i][j].condition.append(random_generated_factors[group_name].pop())

    
    # Add additive
    if query.additive_and_dilution != None:
        statement = (
            select(db.Screen).where(db.Screen.id== query.additive_and_dilution.additive.id)
        )
        screen = session.exec(statement).one()
        index = 0
        dilution = query.additive_and_dilution.dilution / 100
        for i in range(rows):
            for j in range(cols):
                well = screen.wells[index]
                for factor in well.wellcondition.factors:
                    f = GridFactor(chemical= factor.chemical, ammt = dilution, unit = factor.unit, ph = factor.ph, concentration = round(factor.concentration * dilution, ndigits=2), group_name = "C3AdditiveScreen")
                    filled_grid[i][j].condition.append(f)
                index += 1

    # Add included wells
    statement = (
        select(db.Well).where(db.Well.id.in_(query.included_wells_ids))
    )
    results = session.exec(statement).all()
    i = 2
    j = 2    
    for well in results:
        filled_grid[i][j].condition = []
        for factor in well.wellcondition.factors:
            f = GridFactor(chemical= factor.chemical, ammt = .5, unit = factor.unit, ph = factor.ph, concentration = factor.concentration, group_name = "C3IncludedWells")
            filled_grid[i][j].condition.append(f)
        j += 1
        if j >= cols:
            j = 0
            i += 1

    if query.range_dimensions == None:
        return filled_grid
    
    # Create create final grid and insert so that its placed into right range
    grid = []
    for i in range(grid_rows):
        row = []
        for j in range(grid_cols):
            condition = GridWell(condition=[])
            row.append(condition)
        grid.append(row)

    for i in range(rows):
        for j in range(cols):
            grid[i + query.range_dimensions.top][j + query.range_dimensions.left] = filled_grid[i][j]
        

    return grid

