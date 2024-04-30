
import xml.etree.ElementTree as et
import os


def str_to_sql(val, type):
    if val == '':
        return 'NULL'
    else:
        if type==int:
            return str(int(val))
        elif type==float:
            return str(float(val))
        elif type==str:
            return '"' + val + '"'

chemicals_fpath = 'c3_info/Chemicals_16-2-21.xml'
output_sql_fpath = 'c3_info/out.sql'


chem_value_strs = []
freq_stock_value_strs = []
alias_value_strs = []
chem_class_link_value_strs = []
class_value_strs = []
seen_classes = []

tree = et.parse(chemicals_fpath)
root = tree.getroot()
chems = root[0]
for chem in chems:
    c_name = str_to_sql(chem.attrib['name'], str)
    c_unit = str_to_sql(chem.attrib['units'], str)
    c_formula = str_to_sql(chem.attrib['formula'], str)
    c_density = str_to_sql(chem.attrib['density'], float)
    c_solubility = str_to_sql(chem.attrib['solubility'], float)
    c_pka1 = str_to_sql(chem.attrib['pka1'], float)
    c_pka2 = str_to_sql(chem.attrib['pka2'], float)
    c_pka3 = str_to_sql(chem.attrib['pka3'], float)
    c_molec_weight = str_to_sql(chem.attrib['mw'], float)
    c_ions = str_to_sql(chem.attrib['ions'], str)
    c_cas = str_to_sql(chem.attrib['CAS'], str)
    c_cmc = str_to_sql(chem.attrib['CMC'], float)
    c_smiles = str_to_sql(chem.attrib['SMILES'], str)
    fs_concentration = str_to_sql(chem.attrib['def_stock_conc'], float)
    fs_unit = str_to_sql(chem.attrib['def_stock_units'], str)
    fs_prepip_conc = str_to_sql(chem.attrib['max_stock_conc'], float)
    value_str = '(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' %\
        (c_name, c_unit, c_formula, c_density, c_solubility, c_pka1, c_pka2, c_pka3, c_molec_weight, c_ions, c_cas, c_cmc, c_smiles)
    chem_value_strs.append(value_str)
    value_str = '(SELECT id FROM chemical WHERE name = %s, %s, %s, %s)' % (c_name, fs_concentration, fs_unit, fs_prepip_conc)
    freq_stock_value_strs.append(value_str)
    for child in chem:
        if child.tag == 'alias':
            a_name = str_to_sql(child.text, str)
            value_str = '(%s, SELECT id FROM chemical WHERE name = %s)' %\
                            (a_name, c_name)
            alias_value_strs.append(value_str)
        elif child.tag == 'class':
            cl_name = str_to_sql(child.text, str)
            if cl_name not in seen_classes:
                value_str = '(%s)' % (cl_name)
                class_value_strs.append(value_str)
                seen_classes.append(cl_name)
            value_str = '(SELECT id FROM chemical WHERE name = %s, SELECT id FROM class WHERE name = %s)' %\
                            (c_name, cl_name)
            chem_class_link_value_strs.append(value_str)
    
chem_sql = 'INSERT INTO chemical (name, unit, formula, density, solubility, pka1, pka2, pka3, molecular_weight, ions, chemical_abstracts_db_id, critical_micelle_concentration, smiles) VALUES\n'
chem_sql = chem_sql + ',\n'.join(chem_value_strs) + ';\n\n'

freq_stock_sql = 'INSERT INTO frequentstock (chemical_id, concentration, unit, precipitation_concentration)\n'
freq_stock_sql = freq_stock_sql + ',\n'.join(freq_stock_value_strs) + ';\n\n'

alias_sql = 'INSERT INTO alias (name, chemical_id) VALUES\n'
alias_sql = alias_sql + ',\n'.join(alias_value_strs) + ';\n\n'

class_sql = 'INSERT INTO class (name) VALUES\n'
class_sql = class_sql + ',\n'.join(class_value_strs) + ';\n\n'

chem_class_link_sql = 'INSERT INTO chemical_class_link (chemical_id, class_id) VALUES\n'
chem_class_link_sql = chem_class_link_sql + ',\n'.join(chem_class_link_value_strs) + ';\n\n'

# with open(output_sql_fpath, 'a') as fout:
#     fout.write(chem_sql)
#    fout.write(freq_stock_sql)
#     fout.write(alias_sql)
#     fout.write(class_sql)
#     fout.write(chem_class_link_sql)
    






# insert_sql = 'insert into Screens values\n'

# for f in os.listdir('../c3_info/C3_screens'):
    # if f.startswith('Design'):
    #     tree = et.parse('../c3_info/C3_screens/'+f)
    #     root = tree.getroot()
    #     rd = root[1]
    #     name = rd.attrib['name']
    #     username = rd.attrib['username']
    #     format_name = rd[0].attrib['name']
    #     format_rows = int(rd[0].attrib['rows'])
    #     format_cols = int(rd[0].attrib['cols'])
    #     format_subs = int(rd[0].attrib['subs'])
    #     comments = rd[1].text

    #     insert_sql += '("%s", "%s", "%s", %d, %d, %d, "%s"),\n' % (name, username, format_name, format_rows, format_cols, format_subs, comments)

# insert_sql = insert_sql [:-2] + ';'

# f = open('populate_all_tables.sql', 'w')
# f.write(insert_sql)
# f.close()