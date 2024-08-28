"""

"""

from sqlmodel import Session, select, or_, and_, not_, case, col, exists, alias, func
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from pydantic.functional_validators import model_validator
from enum import Enum
from itertools import product
from collections import Counter
import api.db as db

# ============================================================================ #
# Screen search query type model
# ============================================================================ #

class BinOp(str, Enum):
    and_ = "and"
    or_ = "or"

class ChemicalPred(BaseModel):
    universal_quantification: bool = False
    name_search: str | None
    id: int | None
    conc: float | None
    units: str | None
    ph: float | None

    # To help with matching, don't allow extra params that might make another class match
    model_config = ConfigDict(extra='forbid')
    # Check some form of chemical identification is provided
    @model_validator(mode='after')
    def check_id_or_conc_or_ph(self):
        if self.id != None and self.name_search != None:
            raise ValueError("Cannot specify chemical with both id and name search!")
        if self.id == None and self.name_search == None and self.conc == None and self.ph == None:
            raise ValueError("Must specify chemical with at least one of id, name, concentration and unit, or ph!")
        if not((self.conc == None and self.units == None) or (self.conc != None and self.units != None)):
            raise ValueError("Chemical concentration and units must be either both or neither present!")
        return self

class ChemicalBinOp(BaseModel):
    op: BinOp
    arg_left: "ChemicalClause"
    arg_right: "ChemicalClause"

    # Help with matching
    model_config = ConfigDict(extra='forbid')

class ChemicalClause(BaseModel):
    negate: bool = False
    arg: ChemicalBinOp | ChemicalPred

    # Help with matching
    model_config = ConfigDict(extra='forbid')

class WellConditionPred(BaseModel):
    #include_similar: bool = False # TODO implement
    universal_quantification: bool = False
    id: int | None = None
    chems: ChemicalClause | None = None

    # To help with matching, don't allow extra params that might make another class match
    model_config = ConfigDict(extra='forbid')
    # Check that chemical information isn't provided if condition id is
    @model_validator(mode='after')
    def check_id_or_chemicals(self):
        if (self.id == None and self.chems == None) or (self.id != None and self.chems != None):
            raise ValueError("Must specify condition exclusively by either an id or by chemicals!")
        return self

class WellConditionBinOp(BaseModel):
    op: BinOp
    arg_left: "WellConditionClause"
    arg_right: "WellConditionClause"

    # Help with matching
    model_config = ConfigDict(extra='forbid')

class WellConditionClause(BaseModel):
    negate: bool = False
    arg: WellConditionBinOp | WellConditionPred

    # Help with matching
    model_config = ConfigDict(extra='forbid')

class ScreenQuery(BaseModel):
    #only_available: bool = False # TODO implement
    name_search: str | None = None
    owner_search: str | None = None
    conds: WellConditionClause | None = None

    # To help with matching, don't allow extra params that might make another class match
    model_config = ConfigDict(extra='forbid')
    # Check that some form of screen identification is provided for query
    @model_validator(mode='after')
    def check_name_or_conditions(self):
        if self.name_search == None and self.owner_search == None and self.conds == None:
            raise ValueError("Must specify screens by at least a name, owner name or by conditions!")
        return self

# Rebuild the classes with self reference (not sure if this is makes a difference)
ChemicalBinOp.model_rebuild()
WellConditionBinOp.model_rebuild()

# ============================================================================ #
# Screen search query parser
# ============================================================================ #

def parseScreenQuery(query: ScreenQuery):
    clauses = []
    if query.name_search != None:
        clauses.append(col(db.Screen.name).contains(query.name_search))
    if query.owner_search != None:
        clauses.append(col(db.Screen.owned_by).contains(query.owner_search))
    # Screen grouped and filtered by screens and conditions that meet query clauses
    if query.conds != None:
        well_ids = parseWellQuery(query.conds)
        clauses.append(col(db.Well.id).in_(well_ids))
        screens_counts = select(db.Screen, func.count(db.Well.id)).join(db.Well).where(*clauses).group_by(db.Screen).order_by(db.Screen.name)
    # Screen filtered by screen clauses only
    else:
        screens_counts = select(db.Screen, func.count(db.Well.id)).join(db.Well).where(*clauses).group_by(db.Screen).order_by(db.Screen.name)
    return screens_counts

def parseWellQuery(query: WellConditionClause):
    # Create clause tree for conditions
    if type(query.arg) == WellConditionBinOp:
        cond_clause = parseWellConditionBinOp(query.arg)
    else:
        cond_clause = parseWellConditionPred(query.arg)
    # Handle negation
    if query.negate:
        cond_clause = not_(cond_clause)
    cond_clause
    # Select only well ids for later 'in' clauses
    well_ids = select(db.Well.id).join(db.WellCondition).group_by(db.Well.id).having(cond_clause)
    return well_ids

def parseWellConditionBinOp(condexp: WellConditionBinOp):
    # Look at both sides of operator and add sub-clauses to list
    sub_clauses = []
    for logic in [condexp.arg_left, condexp.arg_right]:
        if type(logic.arg) == WellConditionBinOp:
            sub_clause = parseWellConditionBinOp(logic.arg)
        else:
            sub_clause = parseWellConditionPred(logic.arg)
        # Handle negation
        if logic.negate:
            sub_clause = not_(sub_clause)
        sub_clauses.append(sub_clause)
    # Combine sub-clauses with operator
    if condexp.op == BinOp.or_:
        clause = or_(*sub_clauses)
    else:
        clause = and_(*sub_clauses)
    return clause

def parseWellConditionPred(cond: WellConditionPred):
    # Selecting a specific well condition id
    conditions = select(db.WellCondition.id)
    # Either captured by an id
    if cond.id != None:
        conditions = conditions.where(db.WellCondition.id == cond.id)
    # Or by chemical information
    elif cond.chems != None:
        if type(cond.chems.arg) == ChemicalBinOp:
            chem_clause = parseChemicalBinOp(cond.chems.arg)
        else:
            chem_clause = parseChemicalPred(cond.chems.arg)
        # Handle negation
        if cond.chems.negate:
            chem_clause = not_(chem_clause)
        # Possible conditions are grouped and filtered by HAVING clause on chemical information
        conditions = conditions.join(db.WellCondition_Factor_Link).join(db.Factor).join(db.Chemical).group_by(db.WellCondition.id).having(chem_clause)

    # Expression for the number of conditions which meet criteria
    conditions_matched = func.sum(case((col(db.WellCondition.id).in_(conditions), 1), else_=0))
    # Either check if all condition met criteria (universal)
    if cond.universal_quantification:
        condition_clause = conditions_matched == func.count(db.WellCondition.id)
    # Or if any did (existential)
    else:
        condition_clause = conditions_matched > 0
    return condition_clause

def parseChemicalBinOp(chemexp: ChemicalBinOp):
    # Look at both sides of the operator and add sub-clauses to list
    sub_clauses = []
    for logic in [chemexp.arg_left, chemexp.arg_right]:
        if type(logic.arg) == ChemicalBinOp:
            sub_clause = parseChemicalBinOp(logic.arg)
        else:
            sub_clause = parseChemicalPred(logic.arg)
        # Handle negation
        if logic.negate:
            sub_clause = not_(sub_clause)
        sub_clauses.append(sub_clause)
    # Combine sub-clauses with operator
    if chemexp.op == BinOp.or_:
        clause = or_(*sub_clauses)
    else:
        clause = and_(*sub_clauses)
    return clause

def parseChemicalPred(chem: ChemicalPred):
    # Selecting a chemical by id, name search, conc/units or ph (or any combination of them except id AND name search)
    clauses = []
    # Identify chemical
    if chem.id != None:
        clauses.append(db.Chemical.id == chem.id)
    else:
        clauses.append(col(db.Chemical.name).contains(chem.name_search))
    # Specify concentration
    if chem.conc != None and chem.units != None:
        clauses.append(db.Factor.concentration == chem.conc and db.Factor.unit == chem.units)
    # Specify ph
    if chem.ph != None:
        clauses.append(db.Factor.ph == chem.ph)
    # Expression for number of chemicals matched in a single condition
    chemicals_matched = func.sum(case((and_(*clauses), 1), else_=0))
    # Either check if all chemicals met criteria (universal)
    if chem.universal_quantification:
        chem_clause = chemicals_matched == func.count(db.Chemical.id)
    # Or if any did (existential)
    else:
        chem_clause = chemicals_matched > 0
    return chem_clause

# ============================================================================ #
# Recipe generation
# ============================================================================ #

class StockVolume(BaseModel):
    stock: db.StockReadRecipe
    volume: float

class Recipe(BaseModel):
    success: bool
    msg: str
    stocks: list[StockVolume] | None
    water: float | None


def make_condition_recipe(session: Session, condition_id: int):
    well_condition = session.get(db.WellCondition, condition_id)
    possible_stocks = {}
    for f in well_condition.factors:
        possible_stocks[f.id] = []

        # Search for stocks of the factor chemical
        stocks_for_factor_stmnt = select(db.Stock).join(db.Factor).where(db.Factor.chemical_id == f.chemical_id)
        stocks_for_factor = session.exec(stocks_for_factor_stmnt).all()
        #print('\n\n', stocks_for_factor, '\n\n')
        for s in stocks_for_factor:

            # Same chemical and ph (ph may be none)
            if s.factor.ph == f.ph:
                # Match units and concentration
                stock_vol = stock_volume(s.factor, f.concentration, f.unit, 1)
                if stock_vol:
                    possible_stocks[f.id].append([{"stock": s, "volume": stock_vol}])
                # Fails if overflow or incompatible units
                else:
                    continue

            # Same chemical and ph within 0.2 units
            elif f.ph and s.factor.ph:
                if abs(f.ph - s.factor.ph) <= 0.2:
                    stock_vol = stock_volume(s.factor, f.concentration, f.unit, 1)
                    if stock_vol:
                        possible_stocks[f.id].append([{"stock": s, "volume": stock_vol}])
                    # Fails if overflow or incompatible units
                    else:
                        continue
        
        # If factor has ph it is likely a buffer
        if f.ph:
            # First search for ph curves
            suitable_curve = False
            for phcurve in f.chemical.phcurves:
                if f.ph >= phcurve.low_range and f.ph <= phcurve.high_range:
                    suitable_curve = True
                    # Get low and high ph stocks
                    stocks_for_low_chemical_stmnt = select(db.Stock).join(db.Factor).where(db.Factor.chemical_id == phcurve.low_chemical.id)
                    stocks_for_low_chemical = session.exec(stocks_for_low_chemical_stmnt).all()
                    stocks_for_high_chemical_stmnt = select(db.Stock).join(db.Factor).where(db.Factor.chemical_id == phcurve.high_chemical.id)
                    stocks_for_high_chemical = session.exec(stocks_for_high_chemical_stmnt).all()
                    #print('\n',f.id,'\n',stocks_for_low_chemical,'\n\n', stocks_for_high_chemical)
                    # Store suitable stocks for the low ph stock
                    seen_concs = {}
                    for low_s in stocks_for_low_chemical:
                        if low_s.factor.ph and abs(low_s.factor.ph - phcurve.low_range) <= 0.2 and low_s.factor.ph < f.ph:
                            # Save matching low ph stocks grouped by concentration
                            if (low_s.factor.concentration, low_s.factor.unit) not in seen_concs.keys():
                                seen_concs[(low_s.factor.concentration, low_s.factor.unit)] = []
                            seen_concs[(low_s.factor.concentration, low_s.factor.unit)].append(low_s)
                    
                    #print('\nSEARCHING\n', seen_concs,'\n\n')
                    # Search for suitable high ph stocks that have same concentration as a suitable low ph stock
                    for high_s in stocks_for_high_chemical:
                        if high_s.factor.ph and abs(high_s.factor.ph - phcurve.high_range) <= 0.2 and high_s.factor.ph > f.ph:
                            # Loop through matching low ph stocks for all possible pairs
                            if (high_s.factor.concentration, high_s.factor.unit) in seen_concs.keys():
                                for low_s in seen_concs[(high_s.factor.concentration, high_s.factor.unit)]:

                                    # Either compute henderson haselbalch interpolation
                                    if phcurve.hh:
                                        pkas = [f.chemical.pka1, f.chemical.pka2, f.chemical.pka3]
                                        hh_pka = None
                                        for pka in pkas:
                                            if pka and pka > phcurve.low_range and pka < phcurve.high_range:
                                                hh_pka = pka
                                                break
                                        if not hh_pka:
                                            break
                                        low_stock_fraction = henderson_hasselbalch(hh_pka, low_s.factor.ph, high_s.factor.ph, f.ph)
                                        high_stock_fraction = 1-low_stock_fraction

                                    # Or use curve points to find stock ratios
                                    else:
                                        points = sorted(phcurve.points, key=lambda p: p.result_ph)
                                        closest_point = points[0]
                                        for p in points[1:]:
                                            if abs(p.result_ph - f.ph) < abs(closest_point.result_ph - f.ph):
                                                closest_point = p
                                        high_stock_fraction = closest_point.high_chemical_percentage / 100
                                        low_stock_fraction = 1-high_stock_fraction

                                    # Add the two stocks needed to get the desired ph
                                    low_stock_vol = stock_volume(low_s.factor, f.concentration, f.unit, low_stock_fraction)
                                    high_stock_vol = stock_volume(high_s.factor, f.concentration, f.unit, high_stock_fraction)
                                    if low_stock_vol != None and high_stock_vol != None:
                                        stocks = []
                                        if low_stock_vol > 0:
                                            stocks.append({"stock": low_s, "volume": low_stock_vol})
                                        if high_stock_vol > 0:
                                            stocks.append({"stock": high_s, "volume": high_stock_vol})
                                        possible_stocks[f.id].append(stocks)

            # Next, check if chemical meets default henderson haselbalch interpolation
            hh_pka = None
            for i,pka in enumerate([f.chemical.pka1, f.chemical.pka2, f.chemical.pka3]):
                # Check for the pka close to the factor ph
                if pka != None and abs(f.ph - pka) <= 1.2:
                    # Check there are no pkas too close to this one
                    close_pka = False
                    for j,cmp_pka in enumerate([f.chemical.pka1, f.chemical.pka2, f.chemical.pka3]):
                        if i == j:
                            continue
                        else:
                            if cmp_pka != None and abs(pka - cmp_pka) <= 2:
                                close_pka = True
                                break
                    if close_pka:
                        break
                    else:
                        hh_pka = pka
                        break
            # Use HH if chemical has a pka close to factor ph and no other pkas close to it
            if hh_pka:

                # Store suitable stocks for the low ph stock. Similar to logic above but low and high stocks are the same chemical and bounds around hh_pka guessed as default
                seen_concs = {}
                for low_s in stocks_for_factor:
                    # Save matching low ph stocks grouped by concentration
                    if low_s.factor.ph and abs(hh_pka - low_s.factor.ph) <= 1.2 and low_s.factor.ph < f.ph:
                        if (low_s.factor.concentration, low_s.factor.unit) not in seen_concs.keys():
                            seen_concs[(low_s.factor.concentration, low_s.factor.unit)] = []
                        seen_concs[(low_s.factor.concentration, low_s.factor.unit)].append(low_s)
                
                # Search for suitable high ph stocks that have same concentration as a suitable low ph stock
                for high_s in stocks_for_factor:
                    if high_s.factor.ph and abs(hh_pka - high_s.factor.ph) <= 1.2 and high_s.factor.ph > f.ph:
                        # Loop through matching low ph stocks for all possible pairs
                        if (high_s.factor.concentration, high_s.factor.unit) in seen_concs.keys():
                            for low_s in seen_concs[(high_s.factor.concentration, high_s.factor.unit)]:
                                low_stock_fraction = henderson_hasselbalch(hh_pka, low_s.factor.ph, high_s.factor.ph, f.ph)
                                high_stock_fraction = 1-low_stock_fraction
                                low_stock_vol = stock_volume(low_s.factor, f.concentration, f.unit, low_stock_fraction)
                                high_stock_vol = stock_volume(high_s.factor, f.concentration, f.unit, high_stock_fraction)
                                if low_stock_vol != None and high_stock_vol != None:
                                    stocks = []
                                    if low_stock_vol > 0:
                                        stocks.append({"stock": low_s, "volume": low_stock_vol})
                                    if high_stock_vol > 0:
                                        stocks.append({"stock": high_s, "volume": high_stock_vol})
                                    possible_stocks[f.id].append(stocks)
            
            # If no suitable curve found and no suitable HH interpretation, assume salt with specified ph
            if not suitable_curve and not hh_pka:
                # Take stock with no ph or ph close to neutral (7)
                for s in stocks_for_factor:
                    if s.factor.ph == None or abs(s.factor.ph - 7) <= 0.2:
                        stock_vol = stock_volume(s.factor, f.concentration, f.unit, 1)
                        if stock_vol:
                            possible_stocks[f.id].append([{"stock": s, "volume": stock_vol}])
                        # Fails if overflow or incompatible units
                        else:
                            continue

    # Return object
    recipe = Recipe(success=False, msg="", stocks=None, water=None)
    # Check if factors had no possible stocks
    if any([not stocks for stocks in possible_stocks.values()]):
        recipe.success = False
        recipe.msg = 'Could not find any valid stocks for some factors in the condition!'
        # TEMP hijack
        # for factor_id,stocks in possible_stocks.items():
        #     if stocks == []:
        #         recipe.msg = '%d' % factor_id
        #print('\n\n',possible_stocks,'\n\n')
        return recipe
    # Check if all possible recipes overflowed
    stocks = choose_stocks_condition(possible_stocks)
    if not stocks:
        recipe.success = False
        recipe.msg = 'Could not find any combination of stocks that did not overflow!'
    # Return stocks and remaining water volume
    else:
        recipe.success = True
        recipe.msg = ''
        recipe.stocks = [StockVolume(stock=sv["stock"], volume=round(sv["volume"], 3)) for sv in stocks]
        # Water volume computed from rounded volumes to avoid rounding overflow
        recipe.water = round(1-sum(round(sv["volume"], 3) for sv in stocks), 3)
    return recipe

def unit_conversion(conc, unit, density, desired_unit):
    # All possible allowable combinations of units
    if unit == desired_unit:
        return conc
    elif desired_unit == 'mM' and unit == 'M':
        return conc*1000
    elif desired_unit == 'M' and unit == 'mM':
        return conc/1000
    elif desired_unit == 'mg/ml' and unit == 'w/v':
        return conc * 10
    elif desired_unit == 'w/v' and unit == 'mg/ml':
        return conc / 10
    elif desired_unit == 'w/v' and unit == 'v/v':
        return conc * density
    elif desired_unit == 'v/v' and unit == 'w/v':
        return conc / density
    elif desired_unit == 'mg/ml' and unit == 'v/v':
        return conc * density * 10
    elif desired_unit == 'v/v' and unit == 'mg/ml':
        return conc / (density * 10)
    else:
        return None

def choose_stocks_condition(possible_stocks):
    #print('\n\n',possible_stocks,'\n\n')
    # Sort possible stocks for each factor by concentration
    for factor_id in possible_stocks.keys():
        # Convert stock units to match first stock of the factor for sorting
        def converted_conc_key(stock_option): 
            new_conc = unit_conversion(stock_option[0]["stock"].factor.concentration, 
                                       stock_option[0]["stock"].factor.unit, 
                                       stock_option[0]["stock"].factor.chemical.density if stock_option[0]["stock"].factor.chemical.density else 1, 
                                       possible_stocks[factor_id][0][0]["stock"].factor.unit)
            # If conversion not possible, this is an error. Simply return 
            # concentration to not break the sorting operation
            if not new_conc:
                new_conc = stock_option[0]["stock"].factor.concentration
            return new_conc
        possible_stocks[factor_id] = sorted(possible_stocks[factor_id], key=converted_conc_key)

    # All possible combinations of possible stocks for the condition
    stock_choices = product(*possible_stocks.values())

    # Sort the combinations to first prioritise total number of available 
    # stocks, and then to prioritise more slightly higher concentration stocks 
    # than one much higher concentration stock. This makes lower concentration 
    # stocks always get used up first.
    max_stock_index = max([len(x) for x in possible_stocks.values()])-1
    possible_stock_keys = list(possible_stocks.keys())
    def sort_stock_choices_key(stock_choice_lists):
        # Sum of stocks in this choice that are not available
        not_available_penalty = 0
        for stocks in stock_choice_lists:
            not_available_penalty += sum([0 if s["stock"].available else 1 for s in stocks])
        # Counter for stock "step-ups" in concentration. Since possible stocks 
        # are sorted by concentration, each stock's index in the list of 
        # possible stocks for its factor says how many step-ups in 
        # concentration it has. By summing the number of single, double, etc. 
        # step-ups we can sort to always prioritise using more less 
        # concentrated stocks. Noting that below the order of 
        # possible_stocks.values() that produced the stock choices we are 
        # sorting is in the same order as possible_stocks.keys()
        c = Counter([possible_stocks[possible_stock_keys[i]].index(stocks) for i,stocks in enumerate(stock_choice_lists)])
        # Sort first by availability, then by least number of largest step ups 
        # in concentration
        return tuple([not_available_penalty]+[c[i] for i in range(max_stock_index, 0, -1)])
    stock_choices = sorted(stock_choices, key=sort_stock_choices_key)

    # For each choice, get the stocks and compute whether an overflow will occur
    found = False
    for choice in stock_choices:
        total_vol = 0
        all_stocks = []
        for stocks in choice:
            total_vol += sum([s["volume"] for s in stocks])
            all_stocks += stocks
        if total_vol <= 1:
            found = True
            break

    # If a valid combination of stocks is found, return stock list
    if found:
        return all_stocks
    # None if all stock combinations overflow
    else:
        return None

def stock_volume(stock_factor, desired_conc, desired_unit, total_volume):
    # In case of weight and volume conversions use the density if it's there
    chem_density = stock_factor.chemical.density
    if not chem_density:
        chem_density = 1
    # Convert factor concentration appropriately
    stock_volume = None
    converted_stock_factor_concentration = unit_conversion(stock_factor.concentration, stock_factor.unit, chem_density, desired_unit)
    if converted_stock_factor_concentration:
        stock_volume = (desired_conc / converted_stock_factor_concentration) * total_volume
    # None if units not compatible or if stock concentration overflows
    if stock_volume and stock_volume > total_volume:
        stock_volume = None
    return stock_volume

def henderson_hasselbalch(pka, low_ph, high_ph, desired_ph):
    exp_low = 10**(low_ph - pka)
    exp_high = 10**(high_ph - pka)
    exp_desired = 10**(desired_ph - pka)
    part_low1 = 1 / (1+exp_low)
    part_high1 = 1 / (1+exp_high)
    part_low2 = 1 / (1+1/exp_low)
    part_high2 = 1 / (1+1/exp_high)
    fraction_low = (exp_desired*part_high1 - part_high2) / (part_low2 - part_high2 - exp_desired*(part_low1 - part_high1))
    return fraction_low

def make_screen_recipe(screen_id: int):
    pass

# ============================================================================ #
# API operations
# ============================================================================ #

router = APIRouter(
    prefix="/screens",
    tags=["Screen Operations"]
)

@router.get("/names", 
            summary="Gets a list of all screen names",
            response_description="List of all screen names",
            response_model=list[db.ScreenReadLite])
async def get_screen_names(*, session: Session=Depends(db.get_readonly_session)):
    """
    Gets a list of all screen names
    """
    statement = select(db.Screen).order_by(db.Screen.name)
    screens = session.exec(statement).all()
    return screens

@router.get("/wellNames", 
            summary="Gets a list of well names given a screen id",
            response_description="List of well names in specified screen",
            response_model=list[db.WellReadLite])
async def get_screen_well_names(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    Gets a list of well names given a screen id
    """
    statement = select(db.Well).where(db.Well.screen_id == screen_id).order_by(db.Well.position_number)
    wells = session.exec(statement).all()
    return wells

@router.get("/all", 
            summary="Gets a list of all screens and the number of wells in each",
            response_description="List of all screens and the number of wells in each",
            response_model=list[tuple[db.ScreenRead, int]])
async def get_screens(*, session: Session=Depends(db.get_readonly_session)):
    """
    Gets a list of all screens and the number of wells in each
    """
    statement = select(db.Screen, func.count(db.Well.id)).join(db.Well).group_by(db.Screen).order_by(db.Screen.name)
    screens_counts = session.exec(statement).all()
    return screens_counts

@router.get("/subsets", 
            summary="Gets a list of screens and the number of wells in each that contain only conditions found in the specified screen",
            response_description="List of screens and the number of wells in each that contain only conditions found in the specified screen",
            response_model=list[tuple[db.ScreenRead, int]])
async def get_subset_screens(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    Gets a list of screens and the number of wells in each that contain only conditions found in the specified screen
    """
    # Wellcondition of specified screen
    screen_conditions = select(db.WellCondition.id).join(db.Well).join(db.Screen).where(db.Screen.id == screen_id)
    # Screens, and well counts, which only have wellconditions that are also found in the specified screen
    statement = select(db.Screen, func.count(db.Well.id)).join(db.Well).join(db.WellCondition)\
                .where(db.Screen.id != screen_id)\
                .group_by(db.Screen)\
                .having(func.count(db.WellCondition.id) == func.sum(case((col(db.WellCondition.id).in_(screen_conditions), 1), else_=0)))
    # Execute and return
    screens_counts = session.exec(statement).all()
    return screens_counts

@router.get("/wells", 
             summary="Gets list of wells given a screen id",
             response_description="List of wells in specified screen",
             response_model=list[db.WellRead])
async def get_screen_wells(*, session: Session=Depends(db.get_readonly_session), screen_id: int):
    """
    Gets list of wells given a screen id
    """
    screen = session.get(db.Screen, screen_id)
    return screen.wells

@router.post("/query", 
             summary="Gets a list of screens filtered by a query and the number of wells matching the query",
             response_description="List of screens filtered by provided query and the number of wells matching the query",
             response_model=list[tuple[db.ScreenRead, int]])
async def get_screens_query(*, session: Session=Depends(db.get_readonly_session), query: ScreenQuery):
    """
    Gets a list of screens filtered by a query and the number of wells matching the query
    """
    # Parse Query for screens
    statement = parseScreenQuery(query)
    screens_counts = session.exec(statement).all()
    return screens_counts

@router.post("/wellQuery", 
             summary="Gets list of wells given a screen id filtered by a query",
             response_description="List of wells in specified screen filtered by provided query",
             response_model=list[db.WellRead])
async def get_screen_wells_query(*, session: Session=Depends(db.get_readonly_session), screen_id: int, well_query: WellConditionClause):
    """
    Gets list of wells given a screen id filtered by a query
    """
    # Parse Query for well ids
    well_ids = parseWellQuery(well_query)
    # Filter screen wells for those in query
    statement = select(db.Well).where(db.Well.screen_id == screen_id, col(db.Well.id).in_(well_ids)).order_by(db.Well.position_number)
    wells = session.exec(statement).all()
    return wells

@router.get("/conditionRecipe", 
             summary="Creates a recipe for making a condition specified by id",
             response_description="Stocks and their volumes required to make the specified condition",
             response_model=Recipe)
async def get_screen_wells(*, session: Session=Depends(db.get_readonly_session), condition_id: int):
    """
    Creates a recipe for making a condition specified by id
    """
    # TEMP hijack
    # stmnt = select(db.WellCondition).order_by(db.WellCondition.id)
    # wellconditions = session.exec(stmnt).all()
    # total = 0
    # no_factor_stocks = 0
    # failed_factors = []
    # all_overflow = 0
    # for wc in wellconditions:
    #     r = make_condition_recipe(session, wc.id)
    #     total += 1
    #     if not r.success:
    #         if r.msg == 'Could not find any combination of stocks that did not overflow!':
    #             all_overflow += 1
    #         else:
    #             no_factor_stocks += 1
    #             failed_factors.append(int(r.msg))
    # print('\n\nTOTAL:', total)
    # print('NO STOCKS FOR A FACTOR:', no_factor_stocks)
    # print('ALL STOCKS OVERFLOW:', all_overflow, '\n\n')
    # print(failed_factors, '\n\n')

    return make_condition_recipe(session, condition_id)

# @router.get("/export", 
#             summary="Download a list of all screens",
#             response_description="File containing list of all screens")
# async def get_screens_export() -> str:
#     """
#     Produce and download an exported file of a list of all screens
#     """
#     return "Not yet implemented"

# @router.get("/recipe", 
#              summary="Download the recipes to make a screen",
#              response_description="File containing recipes for a screen")
# async def get_screen_recipes(*, session: Session=Depends(db.get_readonly_session), id: int):
#     """
#     Produce and download a file of recipes required to make all conditions in a screen given it's database id
#     """
#     return "Not yet implemented"

# @router.get("/report", 
#              summary="Download a report of requested conditions",
#              response_description="File containing details of requested conditions")
# async def get_conditions_report(*, session: Session=Depends(db.get_readonly_session), cond_id: list[int]):
#     """
#     Produce and download a file containing details of conditions given their database id's
#     """
#     return "Not yet implemented"

# @router.get("/generate", 
#              summary="Create a screen design based on chosen conditions",
#              response_description="Unsaved screen based on chosen conditions")
# async def generate_screen(*, session: Session=Depends(db.get_readonly_session), cond_id: list[int]):
#     """
#     Generate a new screen design around the supplied conditions without saving it to the database
#     """
#     return "Not yet implemented"