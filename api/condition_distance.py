# code based on https://github.com/gabi-a/Shotgun-II

import pandas as pd
import xml.etree.ElementTree as ET
import re
import api.units_and_buffers as unbs
from sqlmodel import Session, select, case, col, func, distinct, intersect
import api.db as db
import math
import time

# Input shape
# name
# percentage concentration
# ph
# ions
# buffer

def distance_between_conditions(session, cond1_db, cond2_db):

    cond1 = make_dataframe(cond1_db)
    cond2 = make_dataframe(cond2_db)

    return C6_score(session, cond1, cond2)

def distance_inside_screen(session, screen: db.Screen):
    start_time = time.perf_counter()

    conditions = []
    for well in screen.wells:
        conditions.append(make_dataframe(well.wellcondition))
    
    # collect_concentration(session, conditions)

    n = len(conditions)
    total = sum(
        C6_score(session, conditions[i], conditions[j])
        for i in range(n)
        for j in range(i + 1, n)
    )
    pairs = n * (n - 1) // 2

    end_time = time.perf_counter()

    print(f"Executed in {end_time - start_time:0.4f} seconds")
    return total / pairs 

def distance_between_screens(session, screen1: db.Screen, screen2: db.Screen):

    conditions1 = []
    conditions2 = []
    for well in screen1.wells:
        conditions1.append(make_dataframe(well.wellcondition))

    for well in screen2.wells:
        conditions2.append(make_dataframe(well.wellcondition))

    total = sum(
        C6_score(session, conditions1[i], conditions2[j])
        for i in range(len(conditions1))
        for j in range(len(conditions2))
    )

    return total / (len(conditions1) * len(conditions2))

def make_dataframe(cond_db):
    cond = []
    for factor in cond_db.factors:
        cond.append({
            "name" : factor.chemical.name,
            "percentage concentration": unbs.unit_conversion(factor.concentration,
                    factor.unit,
                    factor.chemical.density,
                    factor.chemical.molecular_weight,
                    "w/v") ,
            "ph": factor.ph,
            "ions": factor.chemical.ions,
            "buffer": add_buffer_class(factor.ph,
                    factor.chemical.pka1,
                    factor.chemical.pka2,
                    factor.chemical.pka3)
        })
    return pd.DataFrame(cond)

def get_ions(chems):
    cumulative_ions = {}
    for _, chem in chems.iterrows():
        cumulative_ions.update(amount_ions(chem["ions"], chem['percentage concentration']))
    return cumulative_ions

def add_buffer_class(ph, pka1, pka2, pka3):
    if ph == None:
        return "NotBuffer"
    for pka in [pka1, pka2, pka3]:
        if pka is not None:
            if abs(pka-ph) < 1:
                return "Buffer"
    return "NotBuffer"

ph_const_cached = None
def ph_const(session):
    global ph_const_cached
    if ph_const_cached is not None:
        return ph_const_cached
    else:
        ph_const_cached = ph_const_helper(session)
        return ph_const_cached

def ph_const_helper(session):
    # max ph should be < 14 (I do not know why it was in the original c6score code)
    statement = select(func.max(db.Factor.ph)).where(db.Factor.ph < 14)
    max_ph = session.exec(statement).one()
    statement = select(func.min(db.Factor.ph))
    min_ph = session.exec(statement).one()
    return max_ph - min_ph

# def collect_concentration(session, conditions):
#     names = []
#     for condition in conditions:
#         names.append(condition.at[0, "name"])

#     statement = select(db.Factor).join(db.Chemical).where(db.Chemical.name.in_(names)).distinct()
#     factors = session.exec(statement).all()
#     print(len(names), "\n\n\n")

#     print(len(factors), "\n\n\n")
#     for factor in factors:
#         conc = unbs.unit_conversion(factor.concentration, 
#                                     factor.unit, 
#                                     factor.chemical.density, 
#                                     factor.chemical.molecular_weight, 
#                                     "w/v")
#         max_conc_dict.setdefault(factor.chemical.name, 0)
#         if conc is None:
#             continue
#         if max_conc_dict[factor.chemical.name] < conc:
#             max_conc_dict[factor.chemical.name] = conc
#     print(len(max_conc_dict), "\n\n\n")


    
max_conc_dict = {}
def max_concentration(session, name):
    if name in max_conc_dict:
        # print("Concentration Cached")
        return max_conc_dict[name]
    else:
        print("\nConcentration Uncached")
        ammt = max_concentration_helper(session, name)
        max_conc_dict[name] = ammt
        return max_conc_dict[name]

def max_concentration_helper(session, name):
    statement = select(db.Factor).join(db.Chemical).where(db.Chemical.name == name).options().distinct()
    factors = session.exec(statement).all()
    max_concentration = 0
    for factor in factors:
        conc = unbs.unit_conversion(factor.concentration, 
                                    factor.unit, 
                                    factor.chemical.density, 
                                    factor.chemical.molecular_weight, 
                                    "w/v")
        if conc is None:
            continue
        if max_concentration < conc:
            max_concentration = conc
    return max_concentration

def estimate_ph(condition):
    phs = []
    for _, chem in condition.iterrows():
        if chem["buffer"] == "Buffer":
            phs.append(chem["ph"])
    if len(phs) == 0:
        return None
    return sum(phs) / len(phs)

max_ion_dict = {}
def ion_max(session, ion):
    if ion in max_ion_dict:
        # print("Ion Cached")
        return max_ion_dict[ion]
    else:
        print("\nIon Uncached")
        ammt = ion_max_helper(session, ion)
        max_ion_dict[ion] = ammt
    return max_ion_dict[ion]

def ion_max_helper(session, ion):
    statement = select(db.Factor).join(db.Chemical).where(db.Chemical.ions.ilike(f"%{ion}%")).distinct()
    factors = session.exec(statement).all()
    max_concentration = 0
    
    for factor in factors:
        factor_conc = unbs.unit_conversion(factor.concentration, 
                                    factor.unit, 
                                    factor.chemical.density, 
                                    factor.chemical.molecular_weight, 
                                    "w/v")
        if factor_conc is None:
            continue
        conc_dict = amount_ions(factor.chemical.ions, factor_conc, desired_ion=ion)
        if ion not in conc_dict:
            continue
        # conc < 2 is in the original code, I don't know why it's neccesary
        if factor_conc < 2 and conc_dict[ion] > max_concentration:
            max_concentration = conc_dict[ion]
    return max_concentration

def amount_ions(string, percentage_concentration, desired_ion = None):
    if not isinstance(string, str) or len(string) == 0:
        return {}
    cumulative_ions = {}
    for ion in re.split(r',|;| ', string):
        if len(ion) == 0:
            continue
        # grab the stoichiometry number from formula ex (3O2 -> 3, O2)
        groups = re.findall(r"^([0-9]*)(.+)$", ion)
        stochiometry = groups[0][0]
        formula = groups[0][1]

        if desired_ion != formula and desired_ion is not None:
            continue

        if len(stochiometry) == 0:
            stochiometry = 1
        else:
            stochiometry = int(stochiometry)
        cumulative_ions[formula] = cumulative_ions.setdefault(formula, 0) + stochiometry * percentage_concentration
    return cumulative_ions

peg_mw_re = re.compile(r'\d+(?:\.\d+)?')
def C6_score(session, chems_1, chems_2,debug=False):

    T = 0
    D = 0
    
    pegs_1 = chems_1[chems_1['name'].str.contains("polyethylene glycol")]
    pegs_2 = chems_2[chems_2['name'].str.contains("polyethylene glycol")]

    ions_1 = get_ions(chems_1)
    ions_2 = get_ions(chems_2)

    for _, chem_1 in chems_1.iterrows():
        for _, chem_2 in chems_2.iterrows():
            if chem_1['name'] == chem_2['name'] and max_concentration(session, chem_1['name']) != 0 and max_concentration(session, chem_2['name']) != 0:
                T += 1
                D += abs(chem_1['percentage concentration'] - chem_2['percentage concentration']) / max_concentration(session, chem_1['name'])

                if debug:
                    print(f"\nchem: {chem_1['name']}")
                    print(f"\tT += 1 -> T = {T}")
                    print(f"\tD += abs({chem_1['percentage concentration']} - {chem_2['percentage concentration']}) / {max_concentration(session, chem_1['name'])}")
                    print(f"\t   = {abs(chem_1['percentage concentration'] - chem_2['percentage concentration']) / max_concentration(session, chem_1['name']):.3f} -> D = {D:.3f}")

    for idx_1, peg_1 in pegs_1.iterrows():
        for idx_2, peg_2 in pegs_2.iterrows():
            if (peg_1['name'] != peg_2['name']) and (0.5 <= float(peg_mw_re.findall(peg_1['name'])[0]) / float(peg_mw_re.findall(peg_2['name'])[0]) <= 2):
                T += 1
                D += min(1, 0.2 + 0.5 * abs(peg_1['percentage concentration'] - peg_2['percentage concentration']) / (max_concentration(session, peg_1['name']) + max_concentration(session, peg_2['name'])))

                if debug:
                    print(f"\nPEG: {peg_1['name']}, {peg_2['name']}")
                    print(f"\tT += 1 -> T = {T}")
                    print(f"\tD += min(1, 0.2 + 0.5 * abs({peg_1['percentage concentration']} - {peg_2['percentage concentration']}) / ({max_concentration(session, peg_1['name'])} + {max_concentration(session, peg_2['name'])}))")
                    print(f"\t   = {min(1, 0.2 + 0.5 * abs(peg_1['percentage concentration'] - peg_2['percentage concentration']) / (max_concentration(session, peg_1['name']) + max_concentration(session, peg_2['name']))):.3f} -> D = {D:.3f}")

    e1 = estimate_ph(chems_1)
    e2 = estimate_ph(chems_2)
    if e1 != None and e2 != None:
        T += 1
        D += abs(e1 - e2) / ph_const(session)
        
        if debug:
            print(f"\npH estimates")
            print(f"\tT += 1 -> T = {T}")
            print(f"\tD += abs({e1} - {e2}) / ({ph_const})")
            print(f"\t   = {abs(e1 - e2) / ph_const:.3f} -> D = {D:.3f}")
    for k1 in ions_1:
        for k2 in ions_2:
            if k1 == k2:
                if abs(ions_1[k1] - ions_2[k2]) < 1e-6:
                    if debug:
                        print(f"\nion: {k1}")
                        print("Identical concentrations")
                T += 1
                D += min(1, 0.3 + 0.5 * abs(ions_1[k1] - ions_2[k2]) / (ion_max(session, k1) + ion_max(session, k2)))
                
                if debug:
                    print(f"\nion: {k1}")
                    print(f"\tT += 1 -> T = {T}")
                    print(f"\tD += min(1, 0.3 + 0.5 * abs({ions_1[k1]} - {ions_2[k2]}) / ({ion_max(session, k1)} + {ion_max(session, k2)}))")
                    print(f"\t   = {min(1, 0.3 + 0.5 * abs(ions_1[k1] - ions_2[k2]) / (ion_max(session, k1) + ion_max(session, k2))):.3f} -> D = {D:.3f}")
    
    distinct = set(chems_1["name"])
    distinct.update(set(chems_2["name"]))
    shared = set(chems_1["name"]).intersection(set(chems_2["name"]))
    not_shared_count = len(distinct) - len(shared)
    T += not_shared_count
    D += not_shared_count
    if debug:
        print("\nDistinct / Shared:")
        print(f"\t{distinct} / {shared}")
        print("Not shared:")
        print(f"\tT += {not_shared_count} -> T = {T}")
        print(f"\tD += {not_shared_count} -> D = {D:.3f}")

    if T == 0: return 1
    return D / T