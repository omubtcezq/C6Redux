"""

"""

from sqlmodel import Session, select
from sqlalchemy.orm import subqueryload
from pydantic import BaseModel
from itertools import product
from collections import Counter

import api.db as db

# ============================================================================ #
# Recipe generation type model
# ============================================================================ #

class CustomCondition(BaseModel):
    factors: list[db.FactorCreate]

class StockVolume(BaseModel):
    stock: db.StockReadRecipe
    volume: float

class Recipe(BaseModel):
    success: bool
    msg: str
    stocks: list[StockVolume] | None
    water: float | None

# ============================================================================ #
# Recipe generation
# ============================================================================ #

def make_custom_condition_recipe(session: Session, custom_condition: CustomCondition):
    # Find new stock factor
    condition_factors = []

    for f in custom_condition.factors:
        factor_search_stmnt = select(db.Factor).where(db.Factor.chemical_id == f.chemical_id, 
                                                    db.Factor.concentration == f.concentration,
                                                    db.Factor.unit == f.unit,
                                                    db.Factor.ph == f.ph)
        factor = session.exec(factor_search_stmnt).first()
        # If cannot be found, create a new factor for stock
        if not factor:
            factor = db.Factor(chemical_id = f.chemical_id, 
                               chemical = session.get(db.Chemical, f.chemical_id),
                               concentration = f.concentration,
                               unit = f.unit,
                               ph = f.ph)
            # No need to add factor to the session since we are only interested in it temporarily
        condition_factors.append(factor)
    
    return make_recipe_for_factors(session, condition_factors)

def make_condition_recipe(session: Session, condition_id: int):
    well_condition = session.get(db.WellCondition, condition_id)
    return make_recipe_for_factors(session, well_condition.factors)

def make_recipe_for_factors(session: Session, factors: list[db.Factor]):
    possible_stocks = {}
    for f in factors:
        possible_stocks[f.id] = []

        # Search for stocks of the factor chemical
        stocks_for_factor_stmnt = select(db.Stock).join(db.Factor).where(db.Factor.chemical_id == f.chemical_id).options(subqueryload(db.Stock.factor).subqueryload(db.Factor.chemical).subqueryload(db.Chemical.aliases))
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
                    stocks_for_low_chemical_stmnt = select(db.Stock).join(db.Factor).where(db.Factor.chemical_id == phcurve.low_chemical.id).options(subqueryload(db.Stock.factor).subqueryload(db.Factor.chemical).subqueryload(db.Chemical.aliases))
                    stocks_for_low_chemical = session.exec(stocks_for_low_chemical_stmnt).all()
                    stocks_for_high_chemical_stmnt = select(db.Stock).join(db.Factor).where(db.Factor.chemical_id == phcurve.high_chemical.id).options(subqueryload(db.Stock.factor).subqueryload(db.Factor.chemical).subqueryload(db.Chemical.aliases))
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