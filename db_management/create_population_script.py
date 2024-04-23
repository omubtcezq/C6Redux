
import xml.etree.ElementTree as et
import os

insert_sql = 'insert into Screens values\n'

for f in os.listdir('../c3_info/C3_screens'):
	if f.startswith('Design'):
		tree = et.parse('../c3_info/C3_screens/'+f)
		root = tree.getroot()
		rd = root[1]
		name = rd.attrib['name']
		username = rd.attrib['username']
		format_name = rd[0].attrib['name']
		format_rows = int(rd[0].attrib['rows'])
		format_cols = int(rd[0].attrib['cols'])
		format_subs = int(rd[0].attrib['subs'])
		comments = rd[1].text

		insert_sql += '("%s", "%s", "%s", %d, %d, %d, "%s"),\n' % (name, username, format_name, format_rows, format_cols, format_subs, comments)

insert_sql = insert_sql [:-2] + ';'

f = open('populate_all_tables.sql', 'w')
f.write(insert_sql)
f.close()