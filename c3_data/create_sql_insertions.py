"""
Create db population sql from exported C3 files
"""
import xml.etree.ElementTree as et
import openpyxl as px
import os

# Relevant filepaths
output_fpath = 'db_initialisation/populate_tables.sql'
chemicals_fpath = 'c3_data/chemicals_16022021.xml'
stocks_fpath = 'c3_data/stocks.xlsx'
screen_folder_fpaths = ['c3_data/c3_screens', 'c3_data/commercial_screens']

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
            return '"' + val + '"'
        else:
            return 'NULL'

# Complete sql statement from insert command and values list
def create_sql_query(insert_str, value_strs):
    return insert_str + '\n' + ',\n'.join(value_strs) + ';\n\n'

#==============================================================================#
# CHEMICALS
#==============================================================================#

def create_sql_from_chemicals(chemicals_fpath, output_fpath, append=False):

    # Value strings in sql statements
    chem_value_strs = []
    freq_stock_value_strs = []
    alias_value_strs = []
    chem_class_link_value_strs = []
    class_value_strs = []

    # Keeping track of seen elements in many-many relations
    seen_classes = []

    # Parse file
    tree = et.parse(chemicals_fpath)
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
        chem_value_strs.append(value_str)

        # Insertion value for frequentstock table
        value_str = '(SELECT id FROM chemical WHERE name = %s, %s, %s, %s)' % (c_name, fs_concentration, fs_unit, fs_prepip_conc)
        freq_stock_value_strs.append(value_str)

        for child in chem:
            if child.tag == 'alias':
                a_name = input_str_to_sql_str(child.text, str)

                # Insertion value for alias table
                value_str = '(%s, SELECT id FROM chemical WHERE name = %s)' %\
                                (a_name, c_name)
                alias_value_strs.append(value_str)

            elif child.tag == 'class':
                cl_name = input_str_to_sql_str(child.text, str)

                # Insertion value for class table if class not already seen
                if cl_name not in seen_classes:
                    value_str = '(%s)' % (cl_name)
                    class_value_strs.append(value_str)
                    seen_classes.append(cl_name)
                
                # Insertion value for chemical class link table
                value_str = '(SELECT id FROM chemical WHERE name = %s, SELECT id FROM class WHERE name = %s)' %\
                                (c_name, cl_name)
                chem_class_link_value_strs.append(value_str)
    
    # Creation of full sql statements from value lists
    chem_sql = create_sql_query('INSERT INTO chemical (name, unit, formula, density, solubility, pka1, pka2, pka3, molecular_weight, ions, chemical_abstracts_db_id, critical_micelle_concentration, smiles) VALUES', chem_value_strs)
    freq_stock_sql = create_sql_query('INSERT INTO frequentstock (chemical_id, concentration, unit, precipitation_concentration)', freq_stock_value_strs)
    alias_sql = create_sql_query('INSERT INTO alias (name, chemical_id) VALUES', alias_value_strs)
    class_sql = create_sql_query('INSERT INTO class (name) VALUES', class_value_strs)
    chem_class_link_sql = create_sql_query('INSERT INTO chemical_class_link (chemical_id, class_id) VALUES', chem_class_link_value_strs)

    # Write sql statements to output file
    with open(output_fpath, 'a' if append else 'w') as fout:
        fout.write(chem_sql)
        fout.write(freq_stock_sql)
        fout.write(alias_sql)
        fout.write(class_sql)
        fout.write(chem_class_link_sql)
    
    return

#==============================================================================#
# Screens
#==============================================================================#

def create_sql_from_screens(screen_folder_fpaths, output_fpath, append=False):

    # Value strings in sql statements
    screen_value_strs = []
    frequentblock_value_strs = []
    wellcondition_value_strs = []
    wellcondition_factor_link_value_strs = []
    factor_value_strs = []

    # Keeping track of seen elements in many-many relations
    seen_factors = []

    # Parse file
    for folder in screen_folder_fpaths:
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
                s_creation_date = input_str_to_sql_str(screen.attrib['design_date'], str) # TODO check this
                s_format_name = input_str_to_sql_str(screen[0].attrib['name'], str)
                s_format_rows = input_str_to_sql_str(screen[0].attrib['rows'], int)
                s_format_cols = input_str_to_sql_str(screen[0].attrib['rows'], int)
                s_comments = input_str_to_sql_str(screen[1].text, str)
                fb_reservoir_volume = input_str_to_sql_str(screen.attrib['max_res_vol'], float)
                fb_solution_volume = input_str_to_sql_str(screen.attrib['def_res_vol'], float)

                # Insertion value for screen table
                value_str = '(%s, %s, %s, %s, %s, %s, %s)' %\
                                (s_name, s_creator, s_creation_date, s_format_name, s_format_rows, s_format_cols, s_comments)
                screen_value_strs.append(value_str)

                if fb_reservoir_volume != 'NULL' and fb_solution_volume != 'NULL':
                    # Insertion value for frequentblock table
                    value_str = '(%s, %s)' % (fb_reservoir_volume, fb_solution_volume)
                    frequentblock_value_strs.append(value_str)

                for wellcondition in screen[3:]:
                    wc_position_number = input_str_to_sql_str(wellcondition.attrib['number'], str)
                    wc_label = input_str_to_sql_str(wellcondition.attrib['label'], str)

                    # Insertion value for wellcondition table


                    for factor in wellcondition:
                        c_name = input_str_to_sql_str(factor.attrib['name'], str)
                        f_concentration = input_str_to_sql_str(factor.attrib['conc'], str)
                        f_unit = input_str_to_sql_str(factor.attrib['units'], str)
                        f_ph = input_str_to_sql_str(factor.attrib['ph'], str)
                        wcf_class = input_str_to_sql_str(factor.attrib['class'], str) # TODO existing classes needed globally

                    

                    # Insertion value for factor table

                    # Insertion value for wellcondition factor link table


#==============================================================================#
# Stocks
#==============================================================================#

def create_sql_from_stocks(stocks_fpath, output_fpath, append=False):

    # Value strings in sql statements
    # stock_value_strs = []
    # factor_value_strs = []
    # stock_hazard_link_value_strs = []
    hazard_value_strs = []

    # Keeping track of seen elements in many-many relations
    # seen_factors = []
    seen_hazards = []

    # Parse file
    wb = px.load_workbook(stocks_fpath)
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
            if hazard != 'NULL' and hazard not in seen_hazards:

                # Insertion value for hazard table
                value_str = '(%s)' % hazard
                hazard_value_strs.append(value_str)
                seen_hazards.append(hazard)
    
    # Creation of full sql statements from value lists
    hazard_sql = create_sql_query('INSERT INTO hazard (name) VALUES', hazard_value_strs)

    # Write sql statements to output file
    with open(output_fpath, 'a' if append else 'w') as fout:
        fout.write(hazard_sql)
    
    return

#==============================================================================#
# Main
#==============================================================================#

# Execute on file run
def main():
    #create_sql_from_chemicals(chemicals_fpath, output_fpath, False)
    #create_sql_from_stocks(stocks_fpath, output_fpath, False)
    create_sql_from_screens(screen_folder_fpaths, output_fpath, False)

if __name__=='__main__':
    main()