"""

"""

BUFFER_CONSIDER_SAME = 0.2
BUFFER_PH_HH_BOUNDS = 1 + BUFFER_CONSIDER_SAME
MIN_DISTANCE_BETWEEN_PKAS_FOR_USING_HH = 2

# ============================================================================ #
# Unit helpers
# ============================================================================ #

def unit_conversion(conc, unit, density, molecular_weight, desired_unit):
    # Already the right units
    if unit == desired_unit:
        return conc
    # Convert from M
    elif unit == 'M' and desired_unit == 'mM':
        return conc*1000
    elif unit == 'M' and desired_unit == 'mg/ml':
        if not molecular_weight:
            return None
        return conc * molecular_weight
    elif unit == 'M' and desired_unit == 'w/v':
        if not molecular_weight:
            return None
        return (conc * molecular_weight) / 10
    elif unit == 'M' and desired_unit == 'v/v':
        if not molecular_weight or not density:
            return None
        return (conc * molecular_weight) / (10 * density)
    # Convert from mM
    elif unit == 'mM'and desired_unit == 'M':
        return conc/1000
    elif unit == 'mM' and desired_unit == 'mg/ml':
        if not molecular_weight:
            return None
        return (conc * molecular_weight) / 1000
    elif unit == 'mM' and desired_unit == 'w/v':
        if not molecular_weight:
            return None
        return (conc * molecular_weight) / 10000
    elif unit == 'mM' and desired_unit == 'v/v':
        if not molecular_weight or not density:
            return None
        return (conc * molecular_weight) / (10000 * density)
    # Convert from mg/ml
    elif unit == 'mg/ml'and desired_unit == 'M':
        if not molecular_weight:
            return None
        return conc / molecular_weight
    elif unit == 'mg/ml' and desired_unit == 'mM':
        if not molecular_weight:
            return None
        return (1000 * conc) / molecular_weight
    elif unit == 'mg/ml' and desired_unit == 'w/v':
        return conc / 10
    elif unit == 'mg/ml' and desired_unit == 'v/v':
        if not density:
            return None
        return conc / (density * 10)
    # Convert from w/v
    elif unit == 'w/v'and desired_unit == 'M':
        if not molecular_weight:
            return None
        return (10 * conc) / molecular_weight
    elif unit == 'w/v' and desired_unit == 'mM':
        if not molecular_weight:
            return None
        return (10000 * conc) / molecular_weight
    elif unit == 'w/v' and desired_unit == 'mg/ml':
        return conc * 10
    elif unit == 'w/v' and desired_unit == 'v/v':
        if not density:
            return None
        return conc / density
    # Convert from v/v
    elif unit == 'v/v'and desired_unit == 'M':
        if not molecular_weight or not density:
            return None
        return (10 * conc * density) / molecular_weight
    elif unit == 'v/v' and desired_unit == 'mM':
        if not molecular_weight or not density:
            return None
        return (10000 * conc * density) / molecular_weight
    elif unit == 'v/v' and desired_unit == 'mg/ml':
        if not density:
            return None
        return conc * density * 10
    elif unit == 'v/v' and desired_unit == 'w/v':
        if not density:
            return None
        return conc * density
    # Wrong units
    else:
        return None

def factor_with_max_concentration_with_fallback(factors):
    # None if no factors given
    if len(factors) == 0:
        return None

    # Convert to w/v and take max
    max_conc = 0
    max_conc_factor = None
    for f in factors:
        # Only compare succesfully converted factors
        conc = unit_conversion(f.concentration, f.unit, f.chemical.density, f.chemical.molecular_weight, 'w/v')
        if conc and conc > max_conc:
            max_conc = conc
            max_conc_factor = f
    
    # If all conversions failed, to a fallback meaningless comparison of cocentration number
    if not max_conc_factor:
        max_conc = 0
        max_conc_factor = None
        for f in factors:
            if f.concentration > max_conc:
                max_conc = f.concentration
                max_conc_factor = f
    return max_conc_factor

# ============================================================================ #
# pH helpers
# ============================================================================ #

def is_buffer(f):
    curves = get_phcurves_relevant_to_buffer(f)
    if len(curves) > 0:
        return True
    hh = get_henderson_hasselbalch_pka_relevant_to_buffer(f)
    if hh:
        return True
    
    # No matching curves or suitable pkas
    return False

def get_phcurves_relevant_to_buffer(f):
    curves = []

    # No curves if there is no ph
    if not f.ph:
        return []
    
    # Search for curves that surround the pH confirming it as a buffer
    for phcurve in f.chemical.phcurves:
        if f.ph >= phcurve.low_range and f.ph <= phcurve.high_range:
            curves.append(phcurve)
    return curves

def get_henderson_hasselbalch_pka_relevant_to_buffer(f):
    # No relevant pka if there is no ph
    if not f.ph:
        return None
    
    # Search for pka's close to the ph but not close to other pkas
    for i,pka in enumerate([f.chemical.pka1, f.chemical.pka2, f.chemical.pka3]):
        if pka and abs(pka - f.ph) <= BUFFER_PH_HH_BOUNDS:
            # Check there are no pkas too close to this one
            close_pka = False
            for j,cmp_pka in enumerate([f.chemical.pka1, f.chemical.pka2, f.chemical.pka3]):
                if i == j:
                    continue
                else:
                    if cmp_pka != None and abs(pka - cmp_pka) <= MIN_DISTANCE_BETWEEN_PKAS_FOR_USING_HH:
                        close_pka = True
                        break
            if not close_pka:
                return pka
    
    # No suitable pkas found
    return None