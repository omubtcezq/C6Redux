"""
Create db population sql from exported C3 files
"""
import xml.etree.ElementTree as et
import openpyxl as px
import os

# Relevant filepaths
OUTPUT_FPATH = 'db_initialisation/populate_tables.sql'
CHEMICALS_FPATH = 'c3_data/chemicals_16022021.xml'
STOCKS_FPATH = 'c3_data/stocks.xlsx'
SCREEN_FOLDER_PATHS = ['c3_data/c3_screens', 'c3_data/commercial_screens']

# Insert values to be converted to sql
value_strs = {'chem': [],
              'frequentstock': [],
              'alias': [],
              'class': [],
              'chem_class_link': [],
              'factor': [],
              'stock': [],
              'hazard': [],
              'stock_hazard_link': [],
              'screen': [],
              'frequentblock': [], # Don't need rest?
              'wellcondition': [],
              'well': [],
              'wellcondition_factor_link': []}

# Keeping track of insertions to avoid duplicates
seen_insertions = {'class': [],
                   'factor': [],
                   'hazard': [],
                   'wellcondition': [],
                   'chemical_alias_dict': {}}

# Sql to execute
sql_statements = {'chem': None,
                  'frequentstock': None,
                  'alias': None,
                  'class': None,
                  'chem_class_link': None,
                  'factor': None,
                  'stock': None,
                  'hazard': None,
                  'stock_hazard_link': None,
                  'screen': None,
                  'frequentblock': None,
                  'well_tables' : []}

#==============================================================================#
# HELPERS
#==============================================================================#

# Convert input values (sometimes strings) to sql values (NULL, num or quoted string)
def input_str_to_sql_str(val, type):
    if val == '' or val == None:
        return 'NULL'
    else:
        if type==int:
            return str(int(val))
        elif type==float:
            return str(float(val))
        elif type==str:
            return '"' + val.replace('"', '\'') + '"'
        else:
            return 'NULL'

# Complete sql statement from insert command and values list
def create_sql_query(insert_str, value_strs):
    out_str = ''
    num_inserts_at_once = 10
    for i in range(0, len(value_strs), num_inserts_at_once):
        out_str += insert_str + '\n' + ',\n'.join(value_strs[i:i+num_inserts_at_once]) + ';\n'
    return out_str

# Write sql to output
def write_to_output(sql, append=False):
    with open(OUTPUT_FPATH, 'a' if append else 'w') as fout:
        fout.write(sql)
    return

#==============================================================================#
# CHEMICALS
#==============================================================================#

# Parse file
tree = et.parse(CHEMICALS_FPATH)
root = tree.getroot()
for chem in root[0]:
    c_name = input_str_to_sql_str(chem.attrib['name'], str)
    c_unit = input_str_to_sql_str(chem.attrib['units'], str)
    c_formula = input_str_to_sql_str(chem.attrib['formula'], str)
    c_density = input_str_to_sql_str(chem.attrib['density'], float)
    c_solubility = input_str_to_sql_str(chem.attrib['solubility'], float)
    c_pka1 = input_str_to_sql_str(chem.attrib['pka1'], float)
    c_pka2 = input_str_to_sql_str(chem.attrib['pka2'], float)
    c_pka3 = input_str_to_sql_str(chem.attrib['pka3'], float)
    c_molec_weight = input_str_to_sql_str(chem.attrib['mw'], float)
    c_ions = input_str_to_sql_str(chem.attrib['ions'], str)
    c_cas = input_str_to_sql_str(chem.attrib['CAS'], str)
    c_cmc = input_str_to_sql_str(chem.attrib['CMC'], float)
    c_smiles = input_str_to_sql_str(chem.attrib['SMILES'], str)
    fs_concentration = input_str_to_sql_str(chem.attrib['def_stock_conc'], float)
    fs_unit = input_str_to_sql_str(chem.attrib['def_stock_units'], str)
    fs_prepip_conc = input_str_to_sql_str(chem.attrib['max_stock_conc'], float)

    # Insertion value for chemical table
    value_str = '(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' %\
        (c_name, c_unit, c_formula, c_density, c_solubility, c_pka1, c_pka2, c_pka3, c_molec_weight, c_ions, c_cas, c_cmc, c_smiles)
    value_strs['chem'].append(value_str)
    seen_insertions['chemical_alias_dict'][c_name] = []

    # Insertion value for frequentstock table
    if fs_concentration != 'NULL' or fs_unit != 'NULL' or fs_prepip_conc != 'NULL':
        value_str = '((SELECT id FROM chemical WHERE name = %s), %s, %s, %s)' % (c_name, fs_concentration, fs_unit, fs_prepip_conc)
        value_strs['frequentstock'].append(value_str)

    for child in chem:
        if child.tag == 'alias':
            a_name = input_str_to_sql_str(child.text, str)

            # Insertion value for alias table
            value_str = '(%s, (SELECT id FROM chemical WHERE name = %s))' %\
                            (a_name, c_name)
            value_strs['alias'].append(value_str)
            seen_insertions['chemical_alias_dict'][c_name].append(a_name)

        elif child.tag == 'class':
            cl_name = input_str_to_sql_str(child.text, str)

            # Insertion value for class table if class not already seen
            if cl_name not in seen_insertions['class']:
                value_str = '(%s)' % (cl_name)
                value_strs['class'].append(value_str)
                seen_insertions['class'].append(cl_name)
            
            # Insertion value for chemical class link table
            value_str = '((SELECT id FROM chemical WHERE name = %s), (SELECT id FROM class WHERE name = %s))' %\
                            (c_name, cl_name)
            value_strs['chem_class_link'].append(value_str)

#==============================================================================#
# Stocks
#==============================================================================#

# Parse file
wb = px.load_workbook(STOCKS_FPATH)
l2n = lambda x: px.utils.cell.column_index_from_string(x)-1
for row in wb['STOCKS_300'].iter_rows(min_row=2, max_row=498):

    # Resolve stock issue first - unknown chemical ids
    # s_name = input_str_to_sql_str(row[1].value, str)
    # c_name = None
    # f_conc = None
    # f_unit = None
    # f_ph = None
    # s_polar = input_str_to_sql_str(1 if row[3]=='Y' else 0, int)
    # s_viscosity = input_str_to_sql_str(row[9].value, int)
    # s_volatility = input_str_to_sql_str(row[10].value, int)
    # s_density = input_str_to_sql_str(row[20].value, float)
    # s_available = input_str_to_sql_str(1 if row[12].value==0 else 0, int)
    # s_creator = input_str_to_sql_str('', str)
    # ...

    s_hazard1 = input_str_to_sql_str(row[l2n('S')].value, str)
    s_hazard2 = input_str_to_sql_str(row[l2n('T')].value, str)
    for hazard in [s_hazard1, s_hazard2]:
        if hazard != 'NULL' and hazard not in seen_insertions['hazard']:

            # Insertion value for hazard table
            value_str = '(%s)' % hazard
            value_strs['hazard'].append(value_str)
            seen_insertions['hazard'].append(hazard)

#==============================================================================#
# Screens
#==============================================================================#

# Parse file
for folder in SCREEN_FOLDER_PATHS:
    for subdir, dirs, files in os.walk(folder):
        # Make slashes consistent in case windows is being used
        subdir = subdir.replace('\\', '/')
        for file in files:
            fpath = subdir+'/'+file
            tree = et.parse(fpath)
            root = tree.getroot()
            screen = root[1]
            s_name = input_str_to_sql_str(screen.attrib['name'], str)
            s_creator = input_str_to_sql_str(screen.attrib['username'], str)
            s_creation_date = input_str_to_sql_str(screen.attrib['design_date'], str) # xml correctly formats
            s_format_name = input_str_to_sql_str(screen[0].attrib['name'], str)
            s_format_rows = input_str_to_sql_str(screen[0].attrib['rows'], int)
            s_format_cols = input_str_to_sql_str(screen[0].attrib['rows'], int)
            fb_reservoir_volume = input_str_to_sql_str(screen[0].attrib['max_res_vol'], float)
            fb_solution_volume = input_str_to_sql_str(screen[0].attrib['def_res_vol'], float)
            s_comments = input_str_to_sql_str(screen[1].text, str)

            # Insertion value for screen table
            value_str = '(%s, %s, %s, %s, %s, %s, %s)' %\
                            (s_name, s_creator, s_creation_date, s_format_name, s_format_rows, s_format_cols, s_comments)
            value_strs['screen'].append(value_str)

            if fb_reservoir_volume != 'NULL' or fb_solution_volume != 'NULL':
                # Insertion value for frequentblock table
                value_str = '(%s, %s)' % (fb_reservoir_volume, fb_solution_volume)
                value_strs['frequentblock'].append(value_str)

            for wellcondition in screen[3:]:
                wc_position_number = input_str_to_sql_str(wellcondition.attrib['number'], str)
                wc_label = input_str_to_sql_str(wellcondition.attrib['label'], str)

                # Insertion value for wellcondition table
                value_str = '(0)'
                value_strs['wellcondition'].append(value_str)
                sql = create_sql_query('INSERT INTO wellcondition (computed_similarities) VALUES', ['(0)'])
                sql_statements['well_tables'].append(sql)
                sql_statements['well_tables'].append('SET @last_wellcondition_id = LAST_INSERT_ID();\n')

                # Insertion value for well table
                value_str = '((SELECT id FROM screen WHERE name = %s), @last_wellcondition_id, %s, %s)' %\
                            (s_name, wc_position_number, wc_label)
                sql = create_sql_query('INSERT INTO well (screen_id, wellcondition_id, position_number, label) VALUES', [value_str])
                sql_statements['well_tables'].append(sql)

                for factor in wellcondition:
                    c_name = input_str_to_sql_str(factor.attrib['name'], str)
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

                    f_concentration = input_str_to_sql_str(factor.attrib['conc'], str)
                    f_unit = input_str_to_sql_str(factor.attrib['units'], str)
                    f_ph = input_str_to_sql_str(factor.attrib['ph'], str)
                    wcf_class = input_str_to_sql_str(factor.attrib['class'], str)

                    if wcf_class != 'NULL' and wcf_class not in seen_insertions['class']:
                        # Insertion value for class table
                        value_str = '(%s)' % (wcf_class)
                        value_strs['class'].append(value_str)
                        seen_insertions['class'].append(wcf_class)

                    if (c_name, f_concentration, f_unit, f_ph) not in seen_insertions['factor']:
                        # Insertion value for factor table
                        value_str = '((SELECT id FROM chemical WHERE name = %s), %s, %s, %s)' %\
                                    (c_name, f_concentration, f_unit, f_ph)
                        value_strs['factor'].append(value_str)
                        seen_insertions['factor'].append((c_name, f_concentration, f_unit, f_ph))

                    # Insertion value for wellcondition factor link table
                    value_str = ('(@last_wellcondition_id, (SELECT factor.id FROM factor INNER JOIN chemical ON factor.chemical_id = chemical.id WHERE (chemical.name, factor.concentration, factor.unit, factor.ph) = (%s, %s, %s, %s)), (SELECT id FROM class WHERE name = %s))') %\
                                (c_name, f_concentration, f_unit, f_ph, wcf_class)
                    sql = create_sql_query('INSERT INTO wellcondition_factor_link (wellcondition_id, factor_id, class_id) VALUES', [value_str])
                    sql_statements['well_tables'].append(sql)


# Creation of full sql statements from value lists
sql_statements['chem'] = create_sql_query('INSERT INTO chemical (name, unit, formula, density, solubility, pka1, pka2, pka3, molecular_weight, ions, chemical_abstracts_db_id, critical_micelle_concentration, smiles) VALUES', value_strs['chem'])
sql_statements['frequentstock'] = create_sql_query('INSERT INTO frequentstock (chemical_id, concentration, unit, precipitation_concentration) VALUES', value_strs['frequentstock'])
sql_statements['alias'] = create_sql_query('INSERT INTO alias (name, chemical_id) VALUES', value_strs['alias'])
sql_statements['class'] = create_sql_query('INSERT INTO class (name) VALUES', value_strs['class'])
sql_statements['chem_class_link'] = create_sql_query('INSERT INTO chemical_class_link (chemical_id, class_id) VALUES', value_strs['chem_class_link'])
sql_statements['factor'] = create_sql_query('INSERT INTO factor (chemical_id, concentration, unit, ph) VALUES', value_strs['factor'])

sql_statements['hazard'] = create_sql_query('INSERT INTO hazard (name) VALUES', value_strs['hazard'])

sql_statements['screen'] = create_sql_query('INSERT INTO screen (name, creator, creation_date, format_name, format_rows, format_cols, comments) VALUES', value_strs['screen'])
sql_statements['frequentblock'] = create_sql_query('INSERT INTO frequentblock (screen_id, reservoir_volume, solution_volume) VALUES', value_strs['frequentblock'])


# Write sql statements to output file (order important)
# write_to_output(sql_statements['chem'], append=False)
# write_to_output(sql_statements['frequentstock'], append=True)
# write_to_output(sql_statements['alias'], append=True)
# write_to_output(sql_statements['class'], append=True)
# write_to_output(sql_statements['chem_class_link'], append=True)

# write_to_output(sql_statements['hazard'], append=True)

# #write_to_output(sql_statements['screen'], append=True)
# #write_to_output(sql_statements['frequentblock'], append=True)
for sql in sql_statements['well_tables'][0:100]:
    write_to_output(sql, append=True)

