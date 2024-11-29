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

class CustomStocks(BaseModel):
    factors: list[db.FactorCreate]

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

def make_condition_recipe(session: Session, condition_id: int):
    well_condition = session.get(db.WellCondition, condition_id)
    return make_recipe_for_factors(session, well_condition.factors, None)

def custom_condition_factor_list(session: Session, custom_condition: CustomCondition):
    # Custom condition factors
    condition_factors = []
    # Looped the passed factors
    for f in custom_condition.factors:
        # Create temporary fator (no need to add to session)
        factor = db.Factor(chemical_id = f.chemical_id, 
                            chemical = session.get(db.Chemical, f.chemical_id),
                            concentration = f.concentration,
                            unit = f.unit,
                            ph = f.ph)

        condition_factors.append(factor)
    return condition_factors

def custom_stocks_stock_list(session: Session, custom_stocks: CustomStocks):
    # Custom stocks
    stocks = []
    # Looped the passed stock factors
    for f in custom_stocks.factors:
        # Create temporary factor (no need to add to session)
        factor = db.Factor(chemical_id = f.chemical_id, 
                        chemical = session.get(db.Chemical, f.chemical_id),
                        concentration = f.concentration,
                        unit = f.unit,
                        ph = f.ph)

        # Create a custom stock from the factor
        stock_name = "[Custom Stock] %s %s%s%s" % (factor.chemical.name, str(factor.concentration), factor.unit, '' if not factor.ph else ' pH%s' % str(factor.ph))
        stock = db.Stock(name=stock_name,
                         factor=factor,
                         available=1)
        stocks.append(stock)
    return stocks

def make_custom_condition_recipe(session: Session, custom_condition: CustomCondition):
    # Get factor list for custom condition
    condition_factors = custom_condition_factor_list(session, custom_condition)
    # Make recipe for factor list
    return make_recipe_for_factors(session, condition_factors, None)

def make_custom_condition_custom_stocks_recipe(session: Session, custom_condition: CustomCondition, custom_stocks: CustomStocks):
    # Get factor list for custom condition
    condition_factors = custom_condition_factor_list(session, custom_condition)
    # Get stock list for custom stocks
    stocks = custom_stocks_stock_list(session, custom_stocks)
    # Make recipe for factor list with custom stocks
    return make_recipe_for_factors(session, condition_factors, stocks)

def get_stocks_of_chemical_from_db_or_list(session: Session, chemical_id: int, custom_stocks: list[db.Stock] | None):
    if custom_stocks == None:
        stocks_stmnt = select(db.Stock).join(db.Factor).where(db.Factor.chemical_id == chemical_id).options(subqueryload(db.Stock.factor).subqueryload(db.Factor.chemical).subqueryload(db.Chemical.aliases))
        stocks = session.exec(stocks_stmnt).all()
    else:
        stocks = []
        for s in custom_stocks:
            if s.factor.chemical_id == chemical_id:
                stocks.append(s)
    return stocks

def make_recipe_for_factors(session: Session, factors: list[db.Factor], custom_stocks: list[db.Stock] | None):
    # Return object
    recipe = Recipe(success=False, msg="", stocks=None, water=None)

    # Cannot make recipe when condition contains same chemical at different concentrations
    duplicates = set()
    for i,f1 in enumerate(factors):
        for j,f2 in enumerate(factors):
            if i == j:
                continue
            if f1.chemical_id == f2.chemical_id and f1.ph == f2.ph:
                duplicates.add('%s%s' % (f1.chemical.name, '' if not f1.ph else ' pH %s' % str(f1.ph)))
                break
    if len(duplicates) > 0:
        recipe.success = False
        recipe.msg = 'The following chemical%s been repeated in the condition (only a single concentration is possible):' % (' has' if len(duplicates) == 1 else 's have')
        for f_string in duplicates:
            recipe.msg += '\n%s' % f_string
        return recipe

    # Search for stocks
    possible_stocks = {}
    for f in factors:
        factor_hash_string = '%s %s%s%s' % (f.chemical.name, str(f.concentration), f.unit, '' if not f.ph else ' pH %s' % str(f.ph))
        possible_stocks[factor_hash_string] = []

        # Search for stocks of the factor chemical
        stocks_for_factor = get_stocks_of_chemical_from_db_or_list(session, f.chemical_id, custom_stocks)
        #print('\n\n', stocks_for_factor, '\n\n')
        for s in stocks_for_factor:

            # Same chemical and ph (ph may be none)
            if s.factor.ph == f.ph:
                # Match units and concentration
                stock_vol = stock_volume(s.factor, f.concentration, f.unit, 1)
                if stock_vol:
                    possible_stocks[factor_hash_string].append([{"stock": s, "volume": stock_vol}])
                # Fails if overflow or incompatible units
                else:
                    continue

            # Same chemical and ph within 0.2 units
            elif f.ph and s.factor.ph:
                if abs(f.ph - s.factor.ph) <= 0.2:
                    stock_vol = stock_volume(s.factor, f.concentration, f.unit, 1)
                    if stock_vol:
                        possible_stocks[factor_hash_string].append([{"stock": s, "volume": stock_vol}])
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
                    stocks_for_low_chemical = get_stocks_of_chemical_from_db_or_list(session, phcurve.low_chemical.id, custom_stocks)
                    stocks_for_high_chemical = get_stocks_of_chemical_from_db_or_list(session, phcurve.high_chemical.id, custom_stocks)
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
                                        possible_stocks[factor_hash_string].append(stocks)

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
                                    possible_stocks[factor_hash_string].append(stocks)
            
            # If no suitable curve found and no suitable HH interpretation, assume salt with specified ph
            if not suitable_curve and not hh_pka:
                # Take stock with no ph or ph close to neutral (7)
                for s in stocks_for_factor:
                    if s.factor.ph == None or abs(s.factor.ph - 7) <= 0.2:
                        stock_vol = stock_volume(s.factor, f.concentration, f.unit, 1)
                        if stock_vol:
                            possible_stocks[factor_hash_string].append([{"stock": s, "volume": stock_vol}])
                        # Fails if overflow or incompatible units
                        else:
                            continue
    
    # print('\n\n', possible_stocks, '\n\n')

    # Check if factors had no possible stocks
    empty_factors = []
    for factor_hash_string in possible_stocks:
        if len(possible_stocks[factor_hash_string]) == 0:
            empty_factors.append(factor_hash_string)
    if len(empty_factors) > 0:
        recipe.success = False
        recipe.msg = 'Could not find any valid stocks for the following condition factor%s:' % ('' if len(empty_factors) == 1 else 's')
        for factor_hash_string in empty_factors:
            recipe.msg += '\n%s' % factor_hash_string
        return recipe
    # Check if all possible recipes overflowed
    final_stocks = choose_stocks_condition(possible_stocks)
    if not final_stocks:
        recipe.success = False
        recipe.msg = 'Could not find any combination of stocks that did not overflow!'
    # Return stocks and remaining water volume
    else:
        recipe.success = True
        recipe.msg = ''
        recipe.stocks = [StockVolume(stock=sv["stock"], volume=round(sv["volume"], 3)) for sv in final_stocks]
        # Water volume computed from rounded volumes to avoid rounding overflow
        recipe.water = round(1-sum(round(sv["volume"], 3) for sv in final_stocks), 3)
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
    for f in possible_stocks.keys():
        # Convert stock units to match first stock of the factor for sorting
        def converted_conc_key(stock_option): 
            new_conc = unit_conversion(stock_option[0]["stock"].factor.concentration, 
                                       stock_option[0]["stock"].factor.unit, 
                                       stock_option[0]["stock"].factor.chemical.density if stock_option[0]["stock"].factor.chemical.density else 1, 
                                       possible_stocks[f][0][0]["stock"].factor.unit)
            # If conversion not possible, this is an error. Simply return 
            # concentration to not break the sorting operation
            if not new_conc:
                new_conc = stock_option[0]["stock"].factor.concentration
            return new_conc
        possible_stocks[f] = sorted(possible_stocks[f], key=converted_conc_key)

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
        # In case any stock is repeated, combine them here
        final_stocks = []
        for s in all_stocks:
            merged = False
            for final_s in final_stocks:
                # Check if stocks are the same by checking their factors (since custom temporary stocks will have null ids)
                if s["stock"].factor.chemical_id == final_s["stock"].factor.chemical_id and \
                    s["stock"].factor.concentration == final_s["stock"].factor.concentration and \
                    s["stock"].factor.unit == final_s["stock"].factor.unit and \
                    s["stock"].factor.ph == final_s["stock"].factor.ph:
                    final_s["volume"] += s["volume"]
                    merged = True
                    break
            if not merged:
                final_stocks.append(s)
        return final_stocks
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