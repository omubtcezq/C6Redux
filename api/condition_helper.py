import api.db as db
import api.units_and_buffers as unbs

# Check if two conditions are the same
def condition_equality(condition1: db.WellConditionRead, condition2: db.WellConditionRead):
    # If the two conditions are allready the same then we can just return True
    if (condition1.id == condition2.id):
        return True
    # the allowable difference for factor a ph differences (just a very small number in case of floating point issues)
    epsilon = 1.01
    if len(condition1.factors) != len(condition2.factors):
        return False
    for factor1 in condition1.factors:
        conc1 = unbs.unit_conversion(factor1.concentration, factor1.unit, factor1.chemical.density, factor1.chemical.molecular_weight, "M")
        any_equal = False
        for factor2 in condition2.factors:
            if factor1.chemical_id != factor2.chemical_id:
                continue
            # if both have ph or both are none then its allowed
            if (factor1.ph is None) ^ (factor2.ph is None):
                continue
            # we must first make sure the ph exists
            if factor1.ph and factor2.ph and factor1.ph * epsilon < factor2.ph and factor1.ph / epsilon > factor2.ph:
                continue
            conc2 = unbs.unit_conversion(factor2.concentration, factor2.unit, factor2.chemical.density, factor2.chemical.molecular_weight, "M")         
            # make sure the concentration was properly converted first
            if conc1 is None or conc2 is None or conc1 * epsilon < conc2 or conc1 / epsilon > conc2 :
                continue
            any_equal = True
        if not any_equal:
            return False
            
    return True

