"""
Create db population sql from exported C3 files
"""
import xml.etree.ElementTree as et
import openpyxl as px
import os
import sys

# Consider the above api folder for importing sqlmodel classes
sys.path.append(sys.path[0]+'\\..')

from sqlmodel import Session, select
import api.db as db

# Relevant filepaths
CHEMICALS_FPATH = 'c3_data/chemicals_16022021.xml'
CHEMICALS_SQL_FPATH = 'c3_data/CHEMICALS_202405021237.sql'
STOCKS_FPATH = 'c3_data/stocks.xlsx'
SCREEN_FOLDER_PATHS = ['c3_data/c3_screens', 'c3_data/commercial_screens', 'c3_data/other_screens']

#==============================================================================#
# HELPERS
#==============================================================================#

# Convert input values (sometimes strings) to right types
def type_or_none(val, type):
    if val == '' or val == None:
        return None
    else:
        if type==int:
            return int(val)
        elif type==float:
            return float(val)
        elif type==str:
            return val
        else:
            return None

#==============================================================================#
# CHEMICALS
#==============================================================================#

def insert_chemicals():
    # Get session
    with Session(db.engine) as session:

        # Parse file
        tree = et.parse(CHEMICALS_FPATH)
        root = tree.getroot()

        # Loop chemicals
        for chem_xml in root[0]:
            c_name = type_or_none(chem_xml.attrib['name'], str)
            c_unit = type_or_none(chem_xml.attrib['units'], str)
            c_formula = type_or_none(chem_xml.attrib['formula'], str)
            c_density = type_or_none(chem_xml.attrib['density'], float)
            c_solubility = type_or_none(chem_xml.attrib['solubility'], float)
            c_pka1 = type_or_none(chem_xml.attrib['pka1'], float)
            c_pka2 = type_or_none(chem_xml.attrib['pka2'], float)
            c_pka3 = type_or_none(chem_xml.attrib['pka3'], float)
            c_molec_weight = type_or_none(chem_xml.attrib['mw'], float)
            c_ions = type_or_none(chem_xml.attrib['ions'], str)
            c_cas = type_or_none(chem_xml.attrib['CAS'], str)
            c_cmc = type_or_none(chem_xml.attrib['CMC'], float)
            c_smiles = type_or_none(chem_xml.attrib['SMILES'], str)
            fs_concentration = type_or_none(chem_xml.attrib['def_stock_conc'], float)
            fs_unit = type_or_none(chem_xml.attrib['def_stock_units'], str)
            fs_prepip_conc = type_or_none(chem_xml.attrib['max_stock_conc'], float)
            # Add chemical
            chem = db.Chemical(name=c_name, 
                                unit=c_unit, 
                                formula=c_formula, 
                                density=c_density, 
                                solubility=c_solubility, 
                                pka1=c_pka1, 
                                pka2=c_pka2, 
                                pka3=c_pka3, 
                                molecular_weight=c_molec_weight, 
                                ions=c_ions, 
                                chemical_abstracts_db_id=c_cas, 
                                critical_micelle_concentration=c_cmc, 
                                smiles=c_smiles)
            session.add(chem)
            # Get chemical id
            session.commit()
            session.refresh(chem)

            # Add frequent stock
            freq_stock = db.FrequentStock(chemical_id=chem.id, 
                                        concentration=fs_concentration, 
                                        unit=fs_unit, 
                                        precipitation_concentration=fs_prepip_conc)
            session.add(freq_stock)

            # Parse aliases and classes
            for child in chem_xml:
                if child.tag == 'alias':
                    a_name = type_or_none(child.text, str)
                    # Add alias
                    alias = db.Alias(name=a_name, 
                                    chemical_id=chem.id)
                    session.add(alias)

                elif child.tag == 'class':
                    cl_name = type_or_none(child.text, str)

                    # Add class if not already seen
                    class_search = session.exec(select(db.Class).where(db.Class.name == cl_name)).all()
                    if len(class_search) == 0:
                        cls = db.Class(name=cl_name)
                        session.add(cls)
                        # Get new class id
                        session.commit()
                        session.refresh(cls)
                    else:
                        cls = class_search[0]

                    # Add chemical class link entry
                    chem_cls_link = db.Chemical_Class_Link(chemical_id=chem.id, 
                                                        class_id=cls.id)
                    session.add(chem_cls_link)
        
        # Commit left over adds
        session.commit()

#==============================================================================#
# Stocks
#==============================================================================#

def insert_stocks():
    # Get session
    with Session(db.engine) as session:

        # Parse file
        wb = px.load_workbook(STOCKS_FPATH)
        l2n = lambda x: px.utils.cell.column_index_from_string(x)-1

        # Loop stocks
        for row in wb['STOCKS_300'].iter_rows(min_row=2, max_row=498):
            s_name = type_or_none(row[l2n('B')].value, str)
            f_concentration = type_or_none(row[l2n('G')].value, float)
            f_unit = type_or_none(row[l2n('H')].value, str)
            f_ph = type_or_none(row[l2n('I')].value, float)
            s_polar = type_or_none(1 if row[l2n('D')]=='Y' else 0, int)
            s_viscosity = type_or_none(row[l2n('J')].value, int)
            s_volatility = type_or_none(row[l2n('K')].value, int)
            s_density = type_or_none(row[l2n('U')].value, float)
            s_available = type_or_none(1 if row[l2n('M')].value==0 else 0, int)
            s_creator = type_or_none('c3', str)
            s_location = type_or_none(row[l2n('R')].value, str)
            s_comments = type_or_none(row[l2n('N')].value, str)
            s_hazard1 = type_or_none(row[l2n('S')].value, str)
            s_hazard2 = type_or_none(row[l2n('T')].value, str)

            # Stock file does not have a chemical name, find it from old id and sql file
            c3_chem_id = row[l2n('E')].value
            chem_found = False
            with open(CHEMICALS_SQL_FPATH, 'r') as chem_f:
                for l in chem_f.readlines():
                    l = l.strip()
                    if len(l)>2 and l[0] == '(' and l[1:].startswith(str(c3_chem_id)):
                        c_name = type_or_none(l[l.index(",'")+2:l.index("',")].strip("'"), str)
                        chem_found = True
                        break
            # Check if chemical was found
            if not chem_found:
                print('Error!: C3 Chemical ID', c3_chem_id, 'not in exported sql file')
                continue
            # Check if found chemical matches seen chemicals or chemical aliases
            chem_search = session.exec(select(db.Chemical).where(db.Chemical.name == c_name)).all()
            if len(chem_search) == 0:
                alias_search = session.exec(select(db.Alias).where(db.Alias.name == c_name)).all()
                # If can't find the chemical, ignore the stock
                if len(chem_search) == 0:
                    print('Error!: Chemical', c_name, 'not in chemical table')
                    continue
                else:
                    alias = alias_search[0]
                    chem = alias.chemical
            else:
                chem = chem_search[0]

            # Add factor if not already seen
            factor_search = session.exec(select(db.Factor).where(db.Factor.chemical_id == chem.id, 
                                                                 db.Factor.concentration == f_concentration,
                                                                 db.Factor.unit == f_unit,
                                                                 db.Factor.ph == f_ph)).all()
            if len(factor_search) == 0:
                factor = db.Factor(chemical_id=chem.id,
                                   concentration=f_concentration,
                                   unit=f_unit,
                                   ph=f_ph)
                session.add(factor)
                # Get new factor id
                session.commit()
                session.refresh(factor)
            else:
                factor = factor_search[0]
            
            # Add stock
            stock = db.Stock(factor_id=factor.id,
                             name=s_name,
                             polar=s_polar,
                             viscosity=s_viscosity,
                             volatility=s_volatility,
                             density=s_density,
                             available=s_available,
                             creator=s_creator,
                             location=s_location,
                             comments=s_comments)
            session.add(stock)
            # Get new stock id
            session.commit()
            session.refresh(stock)
            
            # Add hazards if not already seen or if not null
            for h_name in [s_hazard1, s_hazard2]:
                if h_name:
                    hazard_search = session.exec(select(db.Hazard).where(db.Hazard.name == h_name)).all()
                    if len(hazard_search) == 0:
                        hazard = db.Hazard(name=h_name)
                        session.add(hazard)
                        # Get new hazard id
                        session.commit()
                        session.refresh(hazard)
                    else:
                        hazard = hazard_search[0]

                    stock_hazard_link = db.Stock_Hazard_Link(stock_id=stock.id,
                                                             hazard_id=hazard.id)
                    session.add(stock_hazard_link)
            
            # Commit left over adds
            session.commit()

#==============================================================================#
# Screens
#==============================================================================#

def insert_screens():
    # Get session
    session = db.get_session()

    # Parse file
    for folder in SCREEN_FOLDER_PATHS:
        for subdir, dirs, files in os.walk(folder):

            # Make slashes consistent in case windows is being used
            subdir = subdir.replace('\\', '/')

            # Loop screens
            for file in files:
                fpath = subdir+'/'+file
                # Handle screen individually in case single screens want to be added later
                insert_screen(fpath)

def insert_screen(fpath):
    # Get session
    with Session(db.engine) as session:
        tree = et.parse(fpath)
        root = tree.getroot()
        screen_xml = root[1]
        s_name = type_or_none(screen_xml.attrib['name'], str)
        s_owned_by = type_or_none(screen_xml.attrib['username'], str)
        s_creation_date = type_or_none(screen_xml.attrib['design_date'], str) # xml correctly formats
        s_format_name = type_or_none(screen_xml[0].attrib['name'], str)
        s_format_rows = type_or_none(screen_xml[0].attrib['rows'], int)
        s_format_cols = type_or_none(screen_xml[0].attrib['cols'], int)
        fb_reservoir_volume = type_or_none(screen_xml[0].attrib['max_res_vol'], float)
        fb_solution_volume = type_or_none(screen_xml[0].attrib['def_res_vol'], float)
        s_comments = type_or_none(screen_xml[1].text, str)

        # Add screen
        screen = db.Screen(name=s_name,
                           owned_by=s_owned_by,
                           creation_date=s_creation_date,
                           format_name=s_format_name,
                           format_rows=s_format_rows,
                           format_cols=s_format_cols,
                           comments=s_comments)
        session.add(screen)
        # Get new screen id
        session.commit()
        session.refresh(screen)

        # Add frequent block
        if fb_reservoir_volume or fb_solution_volume:
            freq_block = db.FrequentBlock(screen_id=screen.id,
                                          reservoir_volume=fb_reservoir_volume,
                                          solution_volume=fb_solution_volume)
            session.add(freq_block)

        # Loop wellconditions
        for wellcondition_xml in screen_xml[2:]:
            wc_position_number = type_or_none(wellcondition_xml.attrib['number'], int)
            wc_label = type_or_none(wellcondition_xml.attrib['label'], str)

            # Add well condition if not already seen
            # Sql and insertion value for wellcondition table. Again need id for following insertions
            sql = create_sql_query('INSERT INTO wellcondition (computed_similarities) VALUES', ['(0)'])
            sql_statements['well_tables'].append(sql)
            sql_statements['well_tables'].append('SET @last_wellcondition_id = LAST_INSERT_ID();\n')

            # Sql and insertion values for well table using saved id
            value_str = '((SELECT id FROM screen WHERE name = %s), @last_wellcondition_id, %s, %s)' %\
                        (s_name, wc_position_number, wc_label)
            sql = create_sql_query('INSERT INTO well (screen_id, wellcondition_id, position_number, label) VALUES', [value_str])
            sql_statements['well_tables'].append(sql)

            # Loop factors
            parsed_factors = []
            for factor_xml in wellcondition_xml:
                c_name = type_or_none(factor_xml.attrib['name'], str)
                f_concentration = type_or_none(factor_xml.attrib['conc'], float)
                f_unit = type_or_none(factor_xml.attrib['units'], str)
                f_ph = type_or_none(factor_xml.attrib['ph'], float)
                wcf_class = type_or_none(factor_xml.attrib['class'], str)

                parsed_factors.append({})

                # Check if chemical name matches seen chemicals or chemical aliases
                if c_name not in seen_insertions['chemical_alias_dict'].keys():
                    found = False
                    for chem, aliases in seen_insertions['chemical_alias_dict'].items():
                        if c_name.lower() == chem.lower():
                            c_name = chem
                            found = True
                            break
                        elif c_name.lower() in [x.lower() for x in aliases]:
                            c_name = chem
                            found = True
                            break
                    if not found:
                        print('Error!: Chemical', c_name, 'not in chemical table')
                        continue

                # Insertion value for class table if class not null and not already seen
                if wcf_class != 'NULL' and wcf_class not in seen_insertions['class']:
                    value_str = '(%s)' % (wcf_class)
                    value_strs['class'].append(value_str)
                    seen_insertions['class'].append(wcf_class)

                # Insertion value for factor table if factor not already seen
                if (c_name, f_concentration, f_unit, f_ph) not in seen_insertions['factor']:
                    value_str = '((SELECT id FROM chemical WHERE name = %s), %s, %s, %s)' %\
                                (c_name, f_concentration, f_unit, f_ph)
                    value_strs['factor'].append(value_str)
                    seen_insertions['factor'].append((c_name, f_concentration, f_unit, f_ph))

                # Sql and insertion values for wellcondition factor link table using saved id
                value_str = ('(@last_wellcondition_id, (SELECT factor.id FROM factor INNER JOIN chemical ON factor.chemical_id = chemical.id WHERE chemical.name=%s AND ((factor.concentration is null AND %s is null) OR factor.concentration=%s) AND ((factor.unit is null AND %s is null) OR factor.unit=%s) AND ((factor.ph is null AND %s is null) OR factor.ph=%s)), (SELECT id FROM class WHERE name = %s))') %\
                            (c_name, f_concentration, f_concentration, f_unit, f_unit, f_ph, f_ph, wcf_class)
                sql = create_sql_query('INSERT INTO wellcondition_factor_link (wellcondition_id, factor_id, class_id) VALUES', [value_str])
                sql_statements['well_tables'].append(sql)

#==============================================================================#
# Main
#==============================================================================#

# insert_chemicals()
insert_stocks()