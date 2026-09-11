from datetime import datetime
from collections import OrderedDict, namedtuple
import xml.etree.ElementTree as et

from config import PH_NOT_SPECIFIED
from screen_utils import well_num_2_well_coord
from errlog import Log
from solutionsort import SolutionSort
from htmlout import HtmlOut



# Simple CsvWriter for writing to StringIO, not file
class CsvToStringWriter(object):
  def __init__(self):
    from StringIO import StringIO
    from csv import writer
    self.output = StringIO()
    self.writer = writer(self.output)

  def writerow(self, csv_row):
    self.writer.writerow(csv_row)

  def getvalue(self):
    res = self.output.getvalue()
    self.output.close()
    return res


class BinZipWriter(object):
  def __init__(self):
    from io import BytesIO
    from zipfile import ZipFile
    self.output = BytesIO()
    self.writer = ZipFile(self.output, 'w')

  def writerow(self, fname, row):
    self.writer.writestr(fname, row)

  def getvalue(self):
    # Close zipfile memory string object
    self.writer.close()

    res = self.output.getvalue()
    # Release object from memory
    self.output.close()
    return res


# Creates download link
def export_link(export_type, cond_name=None, cond_filter=None, screen_name=None, owner_name=None, screen_id=None, wells=None, display_name=None):
  from urllib import quote_plus

  asp = "/Export/MainFrame_export.asp"

  args = {'type':export_type}
  # Append non-null arguments
  arg_list = ['cond_name', 'cond_filter', 'screen_name', 'owner_name', 'screen_id', 'wells']
  for arg in arg_list:
    val = locals()[arg]
    if val:
      args[arg] = val

  display_str = "Download '%s' as %s" % (display_name, export_type) if display_name else export_type
  title = export_types()[export_type].descr

  return HtmlOut.c6_link(asp, args, display_str, title)


# Creates download links for all types
def export_links(cond_name=None, cond_filter=None, screen_name=None, owner_name=None, screen_id=None, wells=None, display_name=None, screen=None):
  if screen:
    screen_name = screen.screen_name
    owner_name = screen.owner_name
    screen_id = screen.screen_id

  link = ''
  for type in export_types().keys():
    if link:
      link += ' '
    link += export_link(type, cond_name, cond_filter, screen_name, owner_name, screen_id, wells, display_name)
  return link


# Supported export types
# Maps type to descr, func, etc
def export_types():
  types = OrderedDict()
  export = namedtuple('export', 'descr, func_cond, func_scr, fname, fext')

  types['CSV-ROW']  = export('CSV (row per condition)', csvROWOutputCond, csvROWOutputScr, 'condition_row', '.csv')
  types['CSV-CELL'] = export('CSV (cell per condition)', csvCELLOutputCond, csvCELLOutputScr, 'condition_cell', '.csv')
  types['TEXT']     = export('Text Description', textOutputCond, textOutputScr, 'condition', '.txt')
  types['XML']      = export('Rigaku Design', xmlOutputCond, xmlOutputScr, 'rigaku_conditions', '.xml')
  types['MMCIF']    = export('MMCIF Description', mmcifOutputCond, mmcifOutputScr, 'mmcif_conditions', '.cif')
  types['RECIPE']   = export('Rigaku Recipe', recipeOutputCond, recipeOutputScr, 'recipe','.xml')
  types['DRAGONFLY']= export('DragonFly Recipe', xmlDragonOutputCond, xmlDragonOutputScr, 'dragonfly_recipe', '.csv')
  return types



def export_factory(type_str, cond=False, full_name=False):
  # Returns function object depending on export type string
  # Also returns file extension (or full name) for given type (tuple)
  exp = export_types()[type_str]
  if cond:
    return exp.func_cond, (exp.name + exp.fext)
  else:
    return exp.func_scr, (exp.name + exp.fext) if full_name else exp.fext


#############################################################################################################################


# Make a zip file of export files
def make_export(cond_name, cond_filter, export_type, UserName=None, isadmin=None, Session=None, db=None):
  if Session and not UserName:
    UserName = Session('UserName')

  if db == None:
    db = localdb.localdb()

  from screen_select import ScreenList
  from screen_object import ScreenObject
  from screen_utils import make_int_wellids
  from datafetch import DatabaseScreenIterObj
  zipfile_obj = BinZipWriter()

  # Get scrObj based on cond_name, cond_filter
  # Note: Always pass isadmin=True, but then call anonymise_screen()
  screen_list = ScreenList(cond_name, cond_filter, UserName, name=True, owner=True, isadmin=True, db=db) 
  
  if not screen_list:
    return None, None

  func, file_ext = export_factory(export_type, full_name=False)

  for screen in screen_list:

    scr = ScreenObject(screen_name=screen.screen_name, screen_id=screen.screen_id, UserName=UserName, isadmin=isadmin, Session=Session, db=db)
    int_wellids = make_int_wellids(scr.screen_obj.screen_data.keys())

    output_str = func(scr, int_wellids)
        
    if len(output_str):
      # Make a clean filename from screen name and owner name
      file_name = "".join(x for x in scr.screen_obj.screen_name + '_' + scr.screen_obj.owner_name if x.isalnum() or x=='_')
      # NOTO BENE: writestr() will not tolerate unicode strings
      #try:
      zipfile_obj.writerow(file_name + file_ext, str(output_str))
      #except MemoryError:
      #  break

  # Create file name
  if cond_name=='PRIVATE' and UserName:
    filename = UserName
  elif cond_name=='CUSTOM_SET':
    filename = 'CUSTOM'
  else:
    if cond_filter=='ALL':
      cond_filter = cond_name + '_' + cond_filter
    filename = cond_filter
  
  from file import File
  filename += '_' + export_type
  filename = File.cleanFileName(filename, justname=True)
 
  return zipfile_obj.getvalue(), filename

#############################################################################################################################

#
# Convinces python that this string is in utf-8 unicode
#
def utf8(str):
  return unicode(str,encoding='utf-8',errors='ignore')



# Writes out a line of xml
# Assumes that 'name' does not need to be encoded into unicode
#
def writeXmlLine(fp, num_spaces, elem_name, pair_list, use_trailing_slash=False, use_close_elem=True):
  from win32timezone import TimeZoneInfo
  from types import NoneType
  from xml.sax.saxutils import quoteattr

  for sp in range(num_spaces):
    fp.write(' ')
  fp.write('<'+elem_name)
  for name, var in pair_list:
    if isinstance(var, NoneType):
      fp.write(' '+name+'=""')
    elif isinstance(var, datetime):
      # convert datetimes to UTC
      local_tz = TimeZoneInfo.local()
      utc_var = datetime(year=var.year, month=var.month, day=var.day, hour=var.hour, minute=var.minute,
                                   second=var.second, tzinfo=local_tz)
      local_var = utc_var.astimezone(TimeZoneInfo.utc())
      # non-standard iso format ?
      if elem_name!='create_job':
        fp.write(' '+name+'="'+local_var.strftime("%Y-%m-%d %H:%M:%SZ")+'"')
      else:
        fp.write(' '+name+'="'+utc_var.strftime("%Y-%m-%dT%H:%M:%S")+'"')
    elif isinstance(var, int):
      fp.write(' %s="%d"'%(name, var))
    elif isinstance(var, float):
      flt_str = ("%f"%var).rstrip('0')
      if flt_str[-1]=='.':
        flt_str = flt_str.rstrip('.')
      fp.write(' %s="%s"'%(name, flt_str))
    elif isinstance(var, unicode):
      var = quoteattr(var)
      fp.write(' '+name+'='+var)
    elif isinstance(var, str):
      var = quoteattr(var)
      u = utf8(' '+name+'='+var)
      fp.write(u)
    else:
      print "Unknown type!!", repr(var)
  if use_trailing_slash:
    fp.write('/')
  fp.write('>')
  if not use_trailing_slash and use_close_elem:
    fp.write('</'+elem_name+'>')
  fp.write('\n')


#
# Writes out the DAS archive xml file to specified location and copy image directories
# Returns True if successful, else False
#
def xmlOutputScr(screen, int_wellids):
  # Sample:
  #	<reservoir_design name="CS_CS2_Com1_C3" username="c3@csiro.au" design_date="2007-07-22 00:00:00" res_vol="0">
    #	<format name="Generic 96 Well" rows="8" cols="12" subs="1" max_res_vol="1" def_res_vol="1" max_drop_vol="1" def_drop_vol="1"/>
    #	<comments>Based on Hampton HT (Crystal Screen and Crystal Screen II), made up in C3.  We use Jeffamine that has been pH'd to pH 7 when we make this screen.</comments>
    #	<well number="1" label="A1">
    #		<item name="2-methyl-2,4-pentanediol" class="Precipitant" conc="30" units="v/v" ph=""/>
    #		<item name="calcium chloride" class="Salt" conc="0.02" units="M" ph=""/>
    #		<item name="sodium acetate-acetic acid" class="Buffer" conc="0.1" units="M" ph="4.6"/>
    #	</well>
  #
  try:
    from StringIO import StringIO 
    fp = StringIO()
    fp.write('<crystaltrak datatype="design" version="2.3.43">\n')
    writeXmlLine(fp, 2, 'reservoir_design', [['name', screen.screen_name], ['username', screen.owner_name], ['design_date', datetime.now()], ['res_vol', 0]], use_close_elem=False)
    writeXmlLine(fp, 4, 'format', [['name', 'Generic 96 Well'], ['rows', '8'], ['cols', '12'], ['subs', '1'], ['max_res_vol', '1'], ['def_res_vol', '1'], ['max_drop_vol', '1'], ['def_drop_vol', '1']], use_trailing_slash=True)
    fp.write("    <comments>CrystalTrak xml screen design file created by C6 (c6.csiro.au).</comments>\n")
    
    # WellInfo instance
    for wi in screen.sorted_well_list:
      well_id = wi.wellid
        
      # check the list of desired wells     
      if not int(well_id) in int_wellids:
        continue
    
      num_cols, solns = SolutionSort.extractSolns(screen.display_well_list, wi)
      
      writeXmlLine(fp, 4, 'well', [['number', well_id], ['label', well_num_2_well_coord(int(well_id), num_cols)]], use_close_elem=False)
      done_buffer=False
      
      # for each normalised solution in a well
      for display_soln in solns:
        # display conc
        # if really small conc, don't restrict number of decimal places
        if display_soln[1]<0.001:
          conc_str="%8f  "%float(display_soln[1])
        else:
          conc_str="%8.3f  "%float(display_soln[1])
          
        # display pH, if any
        # class assignment is rudimentary at best: chems are either precipitants or buffers and only 1 buffer per well
        if display_soln[3] > PH_NOT_SPECIFIED:
          ph_str="%s"%display_soln[3]
          if not done_buffer:
            class_str="Buffer"
            done_buffer=True
          else:
            class_str="Precipitant"
        else:
          ph_str=""
          class_str="Precipitant"
          
        writeXmlLine(fp, 6, 'item', [['name', display_soln[0]], ['class', class_str], ['conc', conc_str], ['units', display_soln[2]], ['ph', ph_str]], use_trailing_slash=True)
      
      fp.write("    </well>\n")
    fp.write("  </reservoir_design>\n")
    fp.write("</crystaltrak>\n")
    out_str = fp.getvalue()
    fp.close()
  except Exception as ex:
    Log.logException(ex)
    out_str = str(ex)
  return out_str

            
def xmlOutputCond(cond_list):    
  # Sample:
  #	<reservoir_design name="CS_CS2_Com1_C3" username="c3@csiro.au" design_date="2007-07-22 00:00:00" res_vol="0">
    #	<format name="Generic 96 Well" rows="8" cols="12" subs="1" max_res_vol="1" def_res_vol="1" max_drop_vol="1" def_drop_vol="1"/>
    #	<comments>Based on Hampton HT (Crystal Screen and Crystal Screen II), made up in C3.  We use Jeffamine that has been pH'd to pH 7 when we make this screen.</comments>
    #	<well number="1" label="A1">
    #		<item name="2-methyl-2,4-pentanediol" class="Precipitant" conc="30" units="v/v" ph=""/>
    #		<item name="calcium chloride" class="Salt" conc="0.02" units="M" ph=""/>
    #		<item name="sodium acetate-acetic acid" class="Buffer" conc="0.1" units="M" ph="4.6"/>
    #	</well>
  #
  try:
    from StringIO import StringIO 
    fp = StringIO()
    fp.write('<crystaltrak datatype="design" version="2.3.43">\n')
    writeXmlLine(fp, 2, 'reservoir_design', [['name', "custom"], ['username', Session("UserName")], ['design_date', datetime.now()], ['res_vol', 0]], use_close_elem=False)
    writeXmlLine(fp, 4, 'format', [['name', 'Generic 96 Well'], ['rows', '8'], ['cols', '12'], ['subs', '1'], ['max_res_vol', '1'], ['def_res_vol', '1'], ['max_drop_vol', '1'], ['def_drop_vol', '1']], use_trailing_slash=True)
    fp.write("    <comments>CrystalTrak xml screen design file created by C6 (c6.csiro.au).</comments>\n")  
      
    if cond_list!=None and cond_list!="":
      writeXmlLine(fp, 4, 'well', [['number', '1'], ['label', 'A1']], use_close_elem=False)
      done_buffer=False
      for display_soln in cond_list:
      
        # display pH, if any
        # class assignment is rudimentary at best: chems are either precipitants or buffers and only 1 buffer per well
        if display_soln[3] > PH_NOT_SPECIFIED:
          ph_str+="%s"%display_soln[3]
          if not done_buffer:
            class_str="Buffer"
            done_buffer=True
          else:
            class_str="Precipitant"
        else:
          ph_str=""
          class_str="Precipitant"
          
        # display conc
        # if really small conc, don't restrict number of decimal places
        if display_soln[1]<0.001:
          conc_str="%8f  "%float(display_soln[1])
        else:
          conc_str="%8.3f  "%float(display_soln[1])
          
        writeXmlLine(fp, 6, 'item', [['name', display_soln[0]], ['class', class_str], ['conc', conc_str], ['units', display_soln[2]], ['ph', ph_str]], use_trailing_slash=True)
    
      fp.write("    </well>\n")
    fp.write("  </reservoir_design>\n")
    fp.write("</crystaltrak>\n")
    out_str = fp.getvalue()
    fp.close()
  except Exception as ex:
    Log.logException(ex)
    out_str = str(ex)
  return out_str


# Generate csv report - one ROW per condition
def csvROWOutputScr(screen, int_wellids):
    writer = CsvToStringWriter()

    #if screen.isadmin or screen.UserName == screen.owner_name:
    writer.writerow(['Name: %s' % screen.screen_name])
    writer.writerow(["Owner: %s" % screen.owner_name])

    writer.writerow(["Number of wells: %d" % screen.screen_size])
    writer.writerow(["Setup Date: %s" % screen.screen_obj.setup_date])
    writer.writerow([' '])
    writer.writerow(['Well','pH','Buffer','','','','Chem 1','','','','Chem 2','','','','Chem 3','','','','Chem 4'])
                
    # WellInfo instance
    for wi in screen.sorted_well_list:
      well_id = wi.wellid
      num_cols, solns = screen.ss.extractSolns(screen.display_well_list, wi)
      
      csv_row = [well_num_2_well_coord(int(well_id), num_cols),"","","","",""]
    
      # for each normalised solution in a well
      for display_soln in solns: 

        csv_cell = ["%s " % HtmlOut.try_float(display_soln.conc)]
    
        # chem and units
        csv_cell.append("%s " % display_soln.units)
        csv_cell.append("%s " % display_soln.chem)  
    
        # pH, if any
        if display_soln.ph > PH_NOT_SPECIFIED:
          csv_cell.append('pH %s ' % display_soln.ph)
        else:
          csv_cell.append('')
    
        # if buffer put in third column, else append to end
        if screen.ss.is_buffer(display_soln.chem) and display_soln.ph > PH_NOT_SPECIFIED and csv_row[2]=="":
          csv_row[2:6] = csv_cell
        else: 
          csv_row += csv_cell
    
      # ph is second column
      if screen.ph_dict:
        csv_row[1] = str(screen.ph_dict.get(well_id,' '))
    
      writer.writerow(csv_row)

    return writer.getvalue()  

# Generate csv report - one CELL per condition
def csvCELLOutputScr(screen, int_wellids):
    writer = CsvToStringWriter()

    if screen.isadmin or screen.UserName == screen.owner_name:
      writer.writerow(['Name: %s' % screen.screen_name])
      writer.writerow(["Owner: %s" % screen.owner_name])
  
    writer.writerow(["Number of wells: %d" % screen.screen_size])
    writer.writerow(["Setup Date: %s" % screen.screen_obj.setup_date])
     
    writer.writerow([' '])
        
    row_id = " "
    csv_row = []
  
    # WellInfo instance
    for wi in screen.sorted_well_list:
      well_id = wi.wellid
      num_cols, solns = screen.ss.extractSolns(screen.display_well_list, wi)
  
      csv_cell = well_num_2_well_coord(int(well_id), num_cols)+"\n"
  
      if row_id != " ":
        if row_id != csv_cell[0]:
          writer.writerow(csv_row)
          csv_row = []
          row_id = csv_cell[0]
      else:
        row_id = csv_cell[0]
  
      for display_soln in solns: 
        csv_cell += "%s " % HtmlOut.try_float(display_soln.conc)
  
        # display chem and units
        csv_cell += "%s " % display_soln.units
        csv_cell += "%s " % display_soln.chem     
  
        # display pH, if any
        if display_soln.ph > PH_NOT_SPECIFIED:
          csv_cell+='pH %s ' % display_soln.ph
        csv_cell+='\n'       
  
      if screen.ph_dict:
        csv_cell += "Final pH: "+ str(screen.ph_dict.get(well_id,' '))
      csv_cell+='\n'       
 
      csv_row.append(csv_cell)
  
    writer.writerow(csv_row)

    return writer.getvalue()  

def csvROWOutputCond(cond_list):
  return 'Not Implemented' # TEMP
def csvCELLOutputCond(cond_list):
  return 'Not Implemented' # TEMP


def textOutputScr(screen, int_wellids):
  try:
    out_str="Screen name: %s\r\n"%(screen.screen_name)
    out_str+="Screen owner: %s\r\n\r\n"%(screen.owner_name)
    
    # WellInfo instance
    for wi in screen.sorted_well_list:
      well_id = wi.wellid
    
      # check the list of desired wells 
      if not int(well_id) in int_wellids:
        continue
    
      num_cols, solns = SolutionSort.extractSolns(screen.display_well_list, wi)
    
      out_str += well_num_2_well_coord(int(well_id), num_cols) + " "
    
      # for each normalised solution in a well
      for display_soln in solns:
        out_str += textFormatSoln(display_soln)
    
      if screen.ph_dict and screen.ph_dict.has_key(well_id):
        out_str+='ph='+ str(screen.ph_dict[well_id])
          
      out_str+="\r\n"

  except Exception as ex:
    Log.logException(ex)
    out_str = str(ex)
  return out_str


# Outputs one condition, used for custom made conditions
def textOutputCond(cond_list):
  out_str=""
  for soln in cond_list:
    out_str += textFormatSoln(soln)
  out_str+="\r\n"
  return out_str


# This prints out one solution, without an end of line        
def textFormatSoln(soln):
  # if really small conc, don't restrict number of decimal places
  if soln.conc < 0.001:
    out_str = "%f " % float(soln.conc)
  else:
    out_str = "%.3f " % float(soln.conc)
  # display chem and units
  out_str += "%s %s" % (soln.units, soln.chem)
  # display pH, if any
  if soln.ph > PH_NOT_SPECIFIED:
    out_str += ', pH=%s' % soln.ph
  out_str += '; '
  return out_str
      
"""
# EXAMPLE MMCIF FILE: (NB: OLD FORMAT)

    loop_
    _exptl_crystal_grow_comp.crystal_id
    _exptl_crystal_grow_comp.id
    _exptl_crystal_grow_comp.sol_id
    _exptl_crystal_grow_comp.name
    _exptl_crystal_grow_comp.volume
    _exptl_crystal_grow_comp.conc
    _exptl_crystal_grow_comp.details
     1 1  1  'HIV-1 protease'  '0.002 ml'  '6 mg/ml'
    ; The protein solution was in a buffer containing 25 mM NaCl,
      100 mM NaMES/ MES buffer, pH 7.5, 3 mM NaAzide
    ;
     1 2 2 'NaCl'         '0.200 ml'  '4    M' 'in 3 mM NaAzide'
     1 3 2 'Acetic Acid'  '0.047 ml'  '100 mM' 'in 3 mM NaAzide'
     1 4 2 'Na Acetate'   '0.053 ml'  '100 mM'
    ; in 3 mM NaAzide. Buffer components were mixed to produce a
      pH of 4.7 according to a ratio calculated from the pKa. The
      actual pH of solution 2 was not measured.
    ;
     1 5 2 'water'        '0.700 ml'   'neat'  'in 3 mM NaAzide'

# Specification on use of '?' and '.':  (http://www.iucr.org/resources/cif/spec/version1.1/semantics)

21. The unquoted character literals ? (query mark) and . (full point) are special and are valid expressions for any data type.
22. The value ? means that the actual value of a requested data item is unknown.
23. The value . means that the actual value of a requested data item is inapplicable. This is most commonly used in a looped list where a data value is required for syntactic integrity.

# Solution id ids always 2: (http://www.mx.iucr.org/iucr-top/cif/mmcif/ndb/dictionary/html-dic/Categories/exptl_crystal_grow_comp.html)

               In general, solution 1 is the solution that contains the
               molecule to be crystallized and solution 2 is the solution
               that contains the precipitant. However, the number of solutions
               required to describe the crystallization protocol is not limited
               to 2.

NEW FORMAT, courtesy of Janet Newman and Nathaniel Echols:

loop_
_exptl_crystal_grow_comp.screen_name
_exptl_crystal_grow_comp.well_id
_exptl_crystal_grow_comp.sol_id
_exptl_crystal_grow_comp.name
_exptl_crystal_grow_comp.conc
_exptl_crystal_grow_comp.unit
_exptl_crystal_grow_comp.ph
     'JCSG+' A1 2    '            polyethylene glycol 400'    50.000   v/v   .
     'JCSG+' A1 2    '         sodium acetate-acetic acid'    0.100     M    4.5
     'JCSG+' A1 2    '                    lithium sulfate'    0.200     M    .
     
"""

def mmcifOutputScr(screen, int_wellids):
  try:
    out_str="# Screen name: %s\r\n"%(screen.screen_name)
    out_str+="# Screen owner: %s\r\n"%(screen.owner_name)
    
    single_header_mode=False
    if len(int_wellids)>23:
      single_header_mode=True
      
    done_header=False
    
    sol_id=2
     
    # WellInfo instance
    for wi in screen.sorted_well_list:
      well_id = wi.wellid
         
      # check the list of desired wells     
      if not int(well_id) in int_wellids:
        continue
    
      num_cols, solns = SolutionSort.extractSolns(screen.display_well_list, wi)
      
      out_str+="\r\n\r\n# Well: %s\r\n\r\n"%(well_num_2_well_coord(int(well_id), num_cols))
      
      if not single_header_mode or not done_header:
        out_str += mmcifOutputHeader()
        done_header=True
    
      # for each normalised solution in a well
      for display_soln in solns:
        out_str += mmcifFormatSoln(screen.screen_name, well_num_2_well_coord(int(well_id), num_cols), sol_id, display_soln)

  except Exception as ex:
    Log.logException(ex)
    out_str = str(ex)
    
  return out_str

      
def mmcifOutputCond(cond_list):
  out_str=mmcifOutputHeader()
  id=1
  if cond_list!=None and cond_list!="":
    for soln in cond_list:
      out_str += mmcifFormatSoln('?', 'A1', 2, soln)
      id+=1
  return out_str


def mmcifFormatSoln(screen_name, well_id, sol_id, soln):
  # display screen_name, well_id, sol_id, chem name
  out_str="    '%35s' %2s %2d    '%35s'   "%(screen_name, well_id, sol_id, soln[0])

  # display conc
  # if really small conc, don't restrict number of decimal places
  if soln[1]<0.001:
    out_str+="%8f  "%float(soln[1])
  else:
    out_str+="%8.3f  "%float(soln[1])
        
  # display units        
  out_str+="%5s  "%soln[2]
             
  # display pH, if any, (when there is no pH, it is presumed to be 'Inapplicable' - marked with '.')
  if soln[3] > PH_NOT_SPECIFIED:
    out_str+="%s"%soln[3]
  else:
    out_str+="."
  out_str+="\r\n"
  return out_str

def mmcifOutputHeader():
  return """loop_\r
_exptl_crystal_grow_comp.screen_name\r
_exptl_crystal_grow_comp.well_id\r
_exptl_crystal_grow_comp.sol_id\r
_exptl_crystal_grow_comp.name\r
_exptl_crystal_grow_comp.conc\r
_exptl_crystal_grow_comp.unit\r
_exptl_crystal_grow_comp.ph\r
"""


def recipeOutputScr(screen, int_wellids):
  if screen.recipes:
    rec = screen.recipes
    if rec.full_recipe():
      # Return the full recipe as xml
      return rec.get_recipe_xml()
    else:
      # Errors exist so construct xml that details them
      errors = rec.get_design_errors()
      # There is errors so return them instead
      root = et.Element("errors")
      for well in errors:
        well_el = et.SubElement(root, "well")
        well_el.set("name", well)
        for error in errors[well]:
          err_el = et.SubElement(well_el, "error")
          err_el.text = error


      # Pretty print the xml
      from xml.dom import minidom
      rough_string = et.tostring(root, 'utf-8')
      reparsed = minidom.parseString(rough_string)
      return reparsed.toprettyxml(indent="    ")

  else:
    # The screen object was created without the recipe flag
    return "<error>No recipe has been generated for this screen</error>"

def recipeOutputCond(cond_list):
  return "<error>Recipe cannot be produced for a condition</error>"
  
def xmlDragonOutputScr(screen, int_wellids):
    if screen.recipes:
        if screen.recipes.full_recipe():
            stocks = screen.recipes.get_stocks()
            
            #sets up the correct size matrix for 24 and 96 well plates, 48 well will have to wait until i know which orientation they are in
            parsed_recipe = screen.recipes.get_parsed_recipes()

            num_rows = 0
            num_cols = 0
            
            for key in parsed_recipe:
                if int(key[1:]) > num_cols:
                        num_cols = int(key[1:])
                if (ord(key[0]) - 64) > num_rows:
                        num_rows = (ord(key[0]) - 64)

            recipe_output_string_list = ['version ,\'1.1\n']

            for chem in stocks:
                matrix = [[0.0 for _ in range(num_cols)] for _ in range(num_rows)] 
                for wells in stocks[chem]['wells']:
                    well_volume = stocks[chem]['wells'][wells] / 1000
                    well_row_number = ord(wells[0]) - 65
                    well_col_number = int(wells[1:]) - 1
                    matrix[well_row_number][well_col_number] = well_volume

            
                # Convert the matrix to a string
                matrix_str = ''
                for row in matrix:
                    matrix_str += ','.join(["%9.6f" % cell for cell in row]) + '\n'
            
                recipe_output_string_list.append("\"" + chem.strip("TEMP ").replace("\"","'") + "\"")
                recipe_output_string_list.append(matrix_str)

            recipe_out = '\n'.join(recipe_output_string_list)

            return recipe_out
        else:
            return "Recipe cannot be produced for a screen that we do not have all stocks for"  
    else:
        # The screen object was created without the recipe flag
        return "No recipe has been generated for this screen"

def xmlDragonOutputCond(cond_list):
    return "<error>Recipe cannot be produced for a condition</error>"

