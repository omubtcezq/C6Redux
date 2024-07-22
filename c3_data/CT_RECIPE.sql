CREATE OR REPLACE PACKAGE CRYSTAL.CT_RECIPE AS

TYPE ITEM_TYPE is RECORD 
(     STOCK_ID  STOCKS.STOCK_ID%type,
      STOCK_NAME  STOCKS.STOCK_NAME%type,
      SOURCE_NAME CHEMICALS.NAME%type,
      STOCK_CONC  STOCKS.STOCK_CONC%type,
      STOCK_UNITS STOCKS.STOCK_UNITS%type,
      STOCK_PH   STOCKS.STOCK_PH%type,
      STOCK_VISCOSITY STOCKS.STOCK_VISCOSITY%type,
      STOCK_VOLATILITY STOCKS.STOCK_VOLATILITY%type,
      STOCK_BARCODE STOCKS.STOCK_BARCODE%type,
      STOCK_COMMENTS STOCKS.STOCK_COMMENTS%type,
      
      -- Additional info for HH pair
      ITEM_TYPE  INTEGER, /* 0 = normal, 1 = HHPair, 2 = complexbufferpair */
      HH_STOCK_ID  STOCKS.STOCK_ID%type,
      HH_STOCK_NAME STOCKS.STOCK_NAME%type,
      HH_DESIRED_PH STOCKS.STOCK_PH%type,
      HH_STOCK_PH STOCKS.STOCK_PH%type,
      HH_PKA  CHEMICALS.PKA1%type,
      HH_STOCK_CONC STOCKS.STOCK_CONC%type,
      HH_STOCK_UNITS STOCKS.STOCK_UNITS%type,
      
      TARGET_CONC STOCKS.STOCK_CONC%type,
      TARGET_UNITS STOCKS.STOCK_UNITS%type,
      TARGET_PH  STOCKS.STOCK_PH%type,
      TARGET_NAME CHEMICALS.NAME%type,
      TARGET_TYPE CHEMICALS.NAME%type,
      
      DICT_PROPERTIES  VARCHAR2(128 BYTE),
      EST_COST        NUMBER(10,4),
      VOLUME_PCT      NUMBER(5,2),
      EST_COUNT       INTEGER,
      ERROR_NOTE       VARCHAR2(128 BYTE),
      HH_VOLUME_PCT     NUMBER(5,2),
      HH_HIGH_PH_PCT   NUMBER(5,2)
);

TYPE RECIPE_TYPE IS RECORD 
(
            item_id VARCHAR2(128),
            src_item_id NUMBER(38),
            well_number INTEGER,
            volume_pct NUMBER(5,2),
            volume_used VARCHAR2(16),
            volume_used_vol NUMBER(10,3),
            volume_used_units VARCHAR2(16 BYTE),
            item_conc STOCKS.STOCK_CONC%type,
            item_units STOCKS.STOCK_UNITS%type,
            item_ph STOCKS.STOCK_PH%type,
            item_name VARCHAR2(4000),
            target_conc STOCKS.STOCK_CONC%type, --NUMERIC,
            target_units STOCKS.STOCK_UNITS%type,
            target_ph STOCKS.STOCK_PH%type,
            target_name CHEMICALS.NAME%type,
            target_type CHEMICALS.NAME%type,
            
            stock_id STOCKS.STOCK_ID%type, -- INTEGER,
            stock_conc STOCKS.STOCK_CONC%type, -- NUMERIC,
            stock_units STOCKS.STOCK_UNITS%type,
            stock_ph STOCKS.STOCK_PH%type, 
            stock_viscosity STOCKS.STOCK_VISCOSITY%type,
            stock_volatility STOCKS.STOCK_VOLATILITY%type,
            stock_name STOCKS.STOCK_NAME%type,
            stock_source CHEMICALS.NAME%type,
            stock_barcode STOCKS.STOCK_BARCODE%type,
            stock_comments STOCKS.STOCK_COMMENTS%type,
            item_added INTEGER,
            item_type INTEGER,
            hh_stock_id INTEGER,
            solution_id INTEGER,
            chemical_id INTEGER,
            chem_class CHEM_GROUPS.NAME%type,
            failed_reason VARCHAR2(256),
            overflow_flag BOOLEAN
);

TYPE STOCK_TYPE is RECORD(STOCK_ID STOCKS.STOCK_ID%type,
      STOCK_NAME  STOCKS.STOCK_NAME%type,
      STOCK_CONC  STOCKS.STOCK_CONC%type,
      STOCK_UNITS STOCKS.STOCK_UNITS%type,
      STOCK_PH   STOCKS.STOCK_PH%type,
      STOCK_VISCOSITY STOCKS.STOCK_VISCOSITY%type,
      STOCK_VOLATILITY STOCKS.STOCK_VOLATILITY%type,
      STOCK_BARCODE STOCKS.STOCK_BARCODE%type,
      STOCK_STATE  STOCKS.STOCK_STATE%type,
      STOCK_COMMENTS STOCKS.STOCK_COMMENTS%type,
      STOCK_CHEMICAL_ID CHEMICALS.CHEMICAL_ID%type,
      CHEM_SOLUBILITY  CHEMICALS.SOLUBILITY%type,
      CHEM_PKA1        CHEMICALS.PKA1%type,
      CHEM_PKA2        CHEMICALS.PKA2%type,
      CHEM_PKA3        CHEMICALS.PKA3%type,
      CHEM_SOURCE CHEMICALS.NAME%type,
      NEAR_PH     STOCKS.STOCK_PH%type,
      VOLUME_PCT  NUMBER(5,2));
      
TYPE STOCK_SOLUTION_TYPE is RECORD(STOCK_NAME PH_CURVE.LOW_STOCK_NAME%TYPE,
      SOURCE_ID PH_CURVE.LOW_SOURCE_ID%TYPE,
      SOURCE_NAME PH_CURVE.LOW_SOURCE_NAME%TYPE,
      SOURCE_TYPE  PH_CURVE.LOW_SOURCE_TYPE%TYPE,
      STOCK_PH   PH_CURVE.LOW_PH%TYPE,
      STOCK_CONC  PH_CURVE.LOW_CONC%TYPE,
      STOCK_UNITS PH_CURVE.LOW_UNITS%TYPE,
      CHEM_CLASS  PH_CURVE.LOW_CLASS%TYPE
      );
      
      
      


TYPE item_coll IS TABLE OF ITEM_TYPE;
TYPE item_coll_list IS TABLE OF item_coll;
TYPE recipe_coll IS TABLE OF RECIPE_TYPE;


      

      
TYPE refCursor IS REF CURSOR;

PROCEDURE AddPair(pType IN INTEGER, pItemId IN VARCHAR, pSrcItemId IN VARCHAR, pItem IN INTEGER,
                        pItemColl IN OUT item_coll, pRecipeColl IN OUT recipe_coll, pRecipeCnt IN INTEGER);

PROCEDURE CopyItemToRecipe(pItem IN ITEM_TYPE, pRecipe IN OUT RECIPE_TYPE);

PROCEDURE CopyHHItemToRecipe(pItem IN ITEM_TYPE, pRecipe IN OUT RECIPE_TYPE);

FUNCTION GetpHCurveIDByChemicalID(pChemicalId IN ph_curve.fk_chemical_id%TYPE) RETURN ph_curve.pk_pH_Curve_id%TYPE;

FUNCTION GetpHCurveByID(pCurveId IN ph_curve.pk_ph_curve_id%TYPE, pName IN OUT ph_curve.name%TYPE, pLowStock IN OUT STOCK_SOLUTION_TYPE, pHighStock IN OUT STOCK_SOLUTION_TYPE) RETURN BOOLEAN;

FUNCTION GetpHCurveHighPercent(pCurveID IN ph_curve.pk_ph_curve_id%TYPE, pTargetpH IN stocks.STOCK_PH%TYPE, pErrMsg IN OUT VARCHAR2) RETURN pH_Point.HIGH_PH_FRACTION_X%TYPE;

FUNCTION GetSolutionGroupID(pSolutionId IN solutions.solution_id%TYPE) RETURN solutions.group_id%TYPE;

PROCEDURE GetDesignRecipeData(pDesignId IN reservoir_designs.reservoir_design_id%TYPE, pFlatten IN BOOLEAN, pDesignCur OUT refCursor);

PROCEDURE GetDesignRecipeForScreen(pDesignId IN reservoir_designs.reservoir_design_id%TYPE, pDesignCur OUT refCursor);

PROCEDURE GetWaterItem(pRecipeItem IN OUT ITEM_TYPE, pWaterChemId OUT chemicals.chemical_id%TYPE);

PROCEDURE CopyStockToItem(pStock IN STOCK_TYPE, pRecipeItem IN OUT ITEM_TYPE);

PROCEDURE GetRecipeForScreen(pDesignId IN reservoir_designs.reservoir_design_id%TYPE, 
                             pRecipe IN OUT VARCHAR2, 
                             pErrors IN OUT VARCHAR2, 
                             pErrCnt IN OUT INTEGER
                             --,recipe_array OUT well_recipe_array
                             );

FUNCTION GenerateItemRecipe(pRecipeColl IN OUT recipe_coll,
                                pItemNum IN INTEGER,
                                pWaterRecipeItem IN ITEM_TYPE,
                                pWaterChemId IN chemicals.chemical_id%TYPE,
                                pFundMixGroupId IN chem_groups.group_id%TYPE,
                                pBufferGroupId IN chem_groups.group_id%TYPE)
                               RETURN CONTAINERS.VOL%TYPE;


FUNCTION fHHLowPHPct(pStock1pH IN STOCKS.STOCK_PH%TYPE,
                     pStock2pH IN STOCKS.STOCK_PH%TYPE,
                     pDesiredPH IN STOCKS.STOCK_PH%TYPE,
                     pChemPKA IN chemicals.pka1%TYPE) RETURN PH_POINT.HIGH_PH_FRACTION_X%TYPE;

  PROCEDURE GetStockVolume(
      pTargetConc    IN    STOCKS.STOCK_CONC%TYPE,
      pTargetUnits   IN    VARCHAR,
      pStockConc     IN    STOCKS.STOCK_CONC%TYPE,
      pStockUnits    IN    VARCHAR,
      pStockVolume   IN OUT   CONTAINERS.VOL%TYPE
   );

  PROCEDURE GetChemStocksNew(
      pChemicalId   IN   INTEGER,
      pTargetUnits  IN   VARCHAR2,
      pCurStocks    OUT  refCursor
  );
  
  PROCEDURE GetChemStocks_Ph(
      pChemicalId   IN   INTEGER,
      pTargetPH       IN   STOCKS.STOCK_PH%TYPE,
      pTargetTol    IN   STOCKS.STOCK_PH%TYPE,
      pCurStocks    OUT  refCursor
  );
  
  PROCEDURE GetHHPair(
      pChemicalId   IN CHEMICALS.CHEMICAL_ID%TYPE,
      pTargetPH     IN STOCKS.STOCK_PH%TYPE,
      pTargetTol    IN STOCKS.STOCK_PH%TYPE,
      pCurStocks    OUT  refCursor
  );
  
  PROCEDURE AddStocksForChemical(
      pItemColl      IN OUT item_coll,
      pFailReason    OUT VARCHAR2,
      pFailCode      OUT INTEGER,
      pChemicalId    IN INTEGER,
      pItemConc      IN STOCKS.STOCK_CONC%TYPE,
      pItemUnits     IN VARCHAR2,
      pItemPH        IN STOCKS.STOCK_PH%TYPE,
      pTargetName    IN VARCHAR2,
      pTargetType    IN VARCHAR2,
      pAllowHH       IN BOOLEAN
    );
  
  PROCEDURE AddStocksForComplexBuffer(
      pItemColl IN OUT item_coll,
      pFailReason    OUT VARCHAR2,
      pFailCode      OUT INTEGER,
      pChemicalId    IN INTEGER,
      pItemConc      IN STOCKS.STOCK_CONC%TYPE,
      pItemUnits     IN VARCHAR2,
      pItemPH        IN STOCKS.STOCK_PH%TYPE,
      pTargetName    IN VARCHAR2,
      pTargetType    IN VARCHAR2
  );
  
  PROCEDURE GetRecipeForWell(pRowCol IN containers.name%type, pRowColSub containers.name%type, pBarcode IN plates.barcode%TYPE, pReport IN OUT VARCHAR2);
  
END CT_RECIPE;

CREATE OR REPLACE PACKAGE BODY CRYSTAL.CT_RECIPE AS
  
c_FAILED_ITEM_VOLUME CONSTANT VARCHAR2(80) := 'Concentration too high. '; --'* Need more concentrated stock'
c_FAILED_ITEM_PH CONSTANT VARCHAR2(80) := 'Need stock with matching pH. ';
c_FAILED_ITEM_CONC CONSTANT VARCHAR2(80) := 'Need stock with matching concentration. ';
c_FAILED_NO_CHEMICAL CONSTANT VARCHAR2(80) := 'No matching chemical found for high or low stock. ';
c_FAILED_NO_STOCK CONSTANT VARCHAR2(80) := 'No valid stock defined (or available). ';
c_FAILED_OVERFLOW CONSTANT VARCHAR2(80) := 'Drop or well overflow. ';
c_FAILED_ITEM_pHCURVE_NO_STOCK CONSTANT VARCHAR2(80) := 'pHCurve requires exact endpoint stocks. ';
c_FAILED_ITEM_pH_OUT_OF_RANGE CONSTANT VARCHAR2(80) := 'The requested pH is out of range of the pH curve. ';
c_FAILED_STOCK_pH_OUT_OF_RANGE CONSTANT VARCHAR2(80) := 'The stock''s pH is out of range of the pH curve. ';

c_FAILCODE_ITEM_NO_STOCK CONSTANT INTEGER := 1;
c_FAILCODE_ITEM_PH CONSTANT INTEGER := 2;
c_FAILCODE_ITEM_VOL CONSTANT INTEGER := 4;
c_FAILCODE_ITEM_OVERFLOW CONSTANT INTEGER := 8;

c_MATCH_PH CONSTANT NUMERIC(5,2) := 0.1;
c_HH_PKA_RANGE CONSTANT NUMERIC(5,2) := 2; /* allowed distance from pKa for HH to work */

c_LOCAL_WATER_STOCK_ID CONSTANT INTEGER := -1;

c_ITEM_TYPE_NORMAL CONSTANT INTEGER := 0;
c_ITEM_TYPE_HH_PAIR CONSTANT INTEGER := 1;
c_ITEM_TYPE_COMPLEX_BUFF CONSTANT INTEGER := 2;

c_WELL_OVERFLOW_CUTOFF CONSTANT NUMERIC(7,2) := 100.01;
c_COMPLEX_BUFFER_PH_TOLERANCE  CONSTANT NUMERIC(5,2) := 0.2;


PROCEDURE AddPair(pType IN INTEGER, pItemId IN VARCHAR, pSrcItemId IN VARCHAR, pItem IN INTEGER,
                        pItemColl IN OUT item_coll, pRecipeColl IN OUT recipe_coll, pRecipeCnt IN INTEGER)
IS
 vItem ITEM_TYPE;
 vStock1Pct PH_POINT.HIGH_PH_FRACTION_X%TYPE;
 vStock2Pct PH_POINT.HIGH_PH_FRACTION_X%TYPE;
 vHHLowFraction PH_POINT.HIGH_PH_FRACTION_X%TYPE;
BEGIN
  IF pItemColl.COUNT > 0 THEN
    vItem := pItemColl(pItemColl.LAST);
    IF pType = c_ITEM_TYPE_COMPLEX_BUFF THEN
      vStock1Pct := (1 - vItem.HH_HIGH_PH_PCT / 100) * vItem.VOLUME_PCT;
      vStock2Pct := (vItem.HH_HIGH_PH_PCT / 100) * vItem.HH_VOLUME_PCT;
    ELSIF pType = c_ITEM_TYPE_HH_PAIR THEN
    
      -- Use HH technique to compute the volume pct of the low pH stock of HH pair
      -- Returns the fraction of the low pH stock to use
      vHHLowFraction := fHHLowPHPct(vItem.STOCK_PH, vItem.HH_STOCK_PH, vItem.HH_DESIRED_PH, vItem.HH_PKA);
      
      -- This next check handles the fact that the stocks may occur in different high/low pH order -ccb
      -- Note that the oStock.VolumePct is used to account for the concentration difference
      -- between source stock and desired conc of target solution
      IF vItem.STOCK_PH < vItem.HH_STOCK_PH THEN
        vStock1Pct := vItem.VOLUME_PCT * vHHLowFraction;
        vStock2Pct := vItem.VOLUME_PCT - vStock1Pct;
      ELSE
        vStock1Pct := vItem.VOLUME_PCT * (1 - vHHLowFraction);
        vStock2Pct := vItem.VOLUME_PCT - vStock1Pct;
      END IF;
    END IF;
    
    pRecipeColl(pRecipeCnt).volume_pct := vStock1Pct;
        
    IF vStock2Pct > 0 THEN
      -- If volume of stock1 > 0 and volume of stock2 > 0 then make a new recipe record and populate 
      IF vStock1Pct > 0 THEN
        pRecipeColl.EXTEND;
        pRecipeColl(pRecipeColl.LAST).item_added := 1;
        pRecipeColl(pRecipeColl.LAST).item_id := pItemId;
        pRecipeColl(pRecipeColl.LAST).src_item_id := pSrcItemId;
        pRecipeColl(pRecipeColl.LAST).well_number := pItem;
        pRecipeColl(pRecipeColl.LAST).chemical_id := pRecipeColl(pRecipeCnt).chemical_id;
        pRecipeColl(pRecipeColl.LAST).volume_pct := vStock2Pct;
        pRecipeColl(pRecipeColl.LAST).item_conc := vItem.TARGET_CONC;
        pRecipeColl(pRecipeColl.LAST).item_units := vItem.TARGET_UNITS;
        pRecipeColl(pRecipeColl.LAST).item_ph := vItem.TARGET_PH;
        pRecipeColl(pRecipeColl.LAST).item_name := vItem.TARGET_NAME;
        pRecipeColl(pRecipeColl.LAST).target_conc := null;
        pRecipeColl(pRecipeColl.LAST).target_units := null;
        pRecipeColl(pRecipeColl.LAST).target_pH := null;
        pRecipeColl(pRecipeColl.LAST).target_name := vItem.TARGET_NAME;
        pRecipeColl(pRecipeColl.LAST).target_type := vItem.TARGET_TYPE;
        pRecipeColl(pRecipeColl.LAST).solution_id  := 0;
        CopyHHItemToRecipe(vItem, pRecipeColl(pRecipeColl.LAST));
      ELSE
        -- If volume of stock1 = 0, and volume of stock2 > 0 then replace stock1 with stock2
        pRecipeColl(pRecipeCnt).volume_pct := vStock2Pct;
        CopyHHItemToRecipe(vItem, pRecipeColl(pRecipeCnt));
      END IF;
    END IF;

  END IF;
  
END AddPair;

PROCEDURE CopyItemToRecipe(pItem IN ITEM_TYPE, pRecipe IN OUT RECIPE_TYPE)
IS
BEGIN
  pRecipe.volume_pct := pItem.VOLUME_PCT;
  pRecipe.stock_id :=  pItem.STOCK_ID;
  pRecipe.stock_name := pItem.STOCK_NAME;
  pRecipe.stock_source := pItem.SOURCE_NAME;
  pRecipe.stock_conc := pItem.STOCK_CONC;
  pRecipe.stock_units := pItem.STOCK_UNITS;
  pRecipe.stock_ph := pItem.STOCK_PH;
  pRecipe.stock_viscosity := pItem.STOCK_VISCOSITY;
  pRecipe.stock_volatility := pItem.STOCK_VOLATILITY;
  pRecipe.stock_barcode := pItem.STOCK_BARCODE;
  pRecipe.stock_comments := pItem.STOCK_COMMENTS;
  pRecipe.item_type := pItem.ITEM_TYPE;
  pRecipe.hh_stock_id := pItem.HH_STOCK_ID;
END CopyItemToRecipe;

PROCEDURE CopyHHItemToRecipe(pItem IN ITEM_TYPE, pRecipe IN OUT RECIPE_TYPE)
IS
BEGIN
  pRecipe.stock_id := pItem.HH_STOCK_ID; -- this set the new record's ID to the HH stock
  pRecipe.stock_name := pItem.HH_STOCK_NAME; -- this fixes the stock name in the grid -ccb
  pRecipe.stock_source := pItem.TARGET_NAME;
  pRecipe.stock_conc := pItem.HH_STOCK_CONC;
  pRecipe.stock_units := pItem.HH_STOCK_UNITS;
  pRecipe.stock_ph := pItem.HH_STOCK_PH;
  pRecipe.stock_viscosity := pItem.STOCK_VISCOSITY;
  pRecipe.stock_volatility := pItem.STOCK_VOLATILITY;
  pRecipe.stock_barcode := pItem.STOCK_BARCODE;
  pRecipe.stock_comments := pItem.STOCK_COMMENTS;
  pRecipe.Item_type := c_ITEM_TYPE_NORMAL;
  pRecipe.hh_stock_id := 0;

END CopyHHItemToRecipe;

FUNCTION GetpHCurveIDByChemicalID(pChemicalId IN ph_curve.fk_chemical_id%TYPE) RETURN ph_curve.pk_pH_Curve_id%TYPE
IS
  vCurveId ph_curve.pk_pH_Curve_id%TYPE;
BEGIN
  SELECT pk_pH_Curve_id INTO vCurveId FROM pH_Curve WHERE fk_chemical_id = pChemicalId;
  RETURN vCurveId;
EXCEPTION
   WHEN NO_DATA_FOUND THEN
   RETURN 0;
END GetpHCurveIDByChemicalID;

FUNCTION GetpHCurveByID(pCurveId IN ph_curve.pk_ph_curve_id%TYPE, pName IN OUT ph_curve.name%TYPE, pLowStock IN OUT STOCK_SOLUTION_TYPE, pHighStock IN OUT STOCK_SOLUTION_TYPE) RETURN BOOLEAN
IS
 vCurveCur refCursor;
 vName PH_CURVE.NAME%TYPE;
 vLowStockName PH_CURVE.LOW_STOCK_NAME%TYPE;
 vHighStockName PH_CURVE.HIGH_STOCK_NAME%TYPE;
 vLowSourceName PH_CURVE.LOW_SOURCE_NAME%TYPE;
 vHighSourceName PH_CURVE.HIGH_SOURCE_NAME%TYPE;
 vLowSourceType PH_CURVE.LOW_SOURCE_TYPE%TYPE;
 vHighSourceType PH_CURVE.HIGH_SOURCE_TYPE%TYPE;
 vLowSourceId PH_CURVE.LOW_SOURCE_ID%TYPE;
 vHighSourceId PH_CURVE.HIGH_SOURCE_ID%TYPE;
 vLowPh PH_CURVE.LOW_PH%TYPE;
 vHighPh PH_CURVE.HIGH_PH%TYPE;
 vLowConc PH_CURVE.LOW_CONC%TYPE;
 vHighConc PH_CURVE.HIGH_CONC%TYPE;
 vLowUnits PH_CURVE.LOW_UNITS%TYPE;
 vHighUnits PH_CURVE.HIGH_UNITS%TYPE;
 vLowClass PH_CURVE.LOW_CLASS%TYPE;
 vHighClass PH_CURVE.HIGH_CLASS%TYPE;
BEGIN
  OPEN vCurveCur FOR
  SELECT name, low_stock_name, low_source_name, low_source_type, low_source_id, low_ph, low_conc, low_units, low_class,
  high_stock_name, high_source_name, high_source_type, high_source_id, high_ph, high_conc, high_units, high_class
  FROM pH_Curve WHERE pk_pH_Curve_id = pCurveId;
  --FETCH pCurveCur INTO vName, vLowStockName, vLowSourceName, vLowSourceType, vLowSourceId, vLowPh, vLowConc, vLowUnits, vLowClass,
  --                          vHighStockName, vHighSourceName, vHighSourceType, vHighSourceId, vHighPh, vHighConc, vHighUnits, vHighClass; 
  FETCH vCurveCur INTO pName, pLowStock.STOCK_NAME,  pLowStock.SOURCE_NAME, pLowStock.SOURCE_TYPE, pLowStock.SOURCE_ID, pLowStock.STOCK_PH, pLowStock.STOCK_CONC, pLowStock.STOCK_UNITS, pLowStock.CHEM_CLASS,
                            pHighStock.STOCK_NAME,  pHighStock.SOURCE_NAME, pHighStock.SOURCE_TYPE, pHighStock.SOURCE_ID, pHighStock.STOCK_PH, pHighStock.STOCK_CONC, pHighStock.STOCK_UNITS, pHighStock.CHEM_CLASS;
  RETURN vCurveCur%FOUND;
END GetpHCurveByID;




FUNCTION GetpHCurveHighPercent(pCurveID IN ph_curve.pk_ph_curve_id%TYPE, pTargetpH IN stocks.STOCK_PH%TYPE, pErrMsg IN OUT VARCHAR2) RETURN pH_Point.HIGH_PH_FRACTION_X%TYPE
IS

    vLowpH STOCKS.STOCK_PH%TYPE;
    vHighpH STOCKS.STOCK_PH%TYPE; 
    vLowPct pH_Point.HIGH_PH_FRACTION_X%TYPE;
    vHighPct pH_Point.HIGH_PH_FRACTION_X%TYPE;
    vResult pH_Point.HIGH_PH_FRACTION_X%TYPE;
    r1 pH_Point.HIGH_PH_FRACTION_X%TYPE;
    r2 pH_Point.HIGH_PH_FRACTION_X%TYPE;
    vCurveCur refCursor;
    vNearest STOCKS.STOCK_PH%TYPE;
BEGIN
    OPEN vCurveCur FOR SELECT ph_point.HIGH_PH_FRACTION_X, ph_point.RESULT_PH_Y, (pTargetpH-result_ph_y) as nearest
    FROM pH_Curve, pH_Point
    WHERE pk_pH_Curve_id = pCurveID
    AND pH_Point.FK_PH_CURVE_ID = pH_Curve.PK_PH_CURVE_ID
    AND pH_Point.RESULT_PH_Y > 0
    AND pH_Point.RESULT_PH_Y IS NOT NULL
    AND pTargetpH >= result_ph_y
    ORDER by nearest ASC;
    
    FETCH vCurveCur INTO vLowPct, vLowpH, vNearest;
    IF vCurveCur%NOTFOUND THEN
      pErrMsg := ' Cannot find a point in curve with pH value greater than or equal to ' || to_char(pTargetpH,'99.99');
      RETURN -1;
    END IF;
    CLOSE vCurveCur;
    
    OPEN vCurveCur FOR SELECT pH_Point.HIGH_PH_FRACTION_X, ph_point.RESULT_PH_Y, (result_ph_y -pTargetpH) as nearest
    FROM pH_Curve, pH_Point
    WHERE pk_pH_Curve_id = pCurveID
    AND pH_Point.FK_PH_CURVE_ID = pH_Curve.PK_PH_CURVE_ID
    AND pH_Point.RESULT_PH_Y > 0
    AND pH_Point.RESULT_PH_Y IS NOT NULL
    AND pTargetpH <= result_ph_y
    ORDER by nearest ASC;
    
    FETCH vCurveCur INTO vHighPct, vHighpH, vNearest;
    IF vCurveCur%NOTFOUND THEN
      pErrMsg := ' Cannot find a point in curve with pH value less than or equal to ' || to_char(pTargetpH,'99.99');
      RETURN -1;
    END IF;
    CLOSE vCurveCur;

    -- Now do interpolation
    IF vHighpH - vLowpH > 0.000001 THEN
      r1 := (pTargetpH - vLowpH) / (vHighpH - vLowpH);
    ELSE
      r1 := (pTargetpH - vLowpH) / 0.000001;
    END IF;
    r2 := vHighPct - vLowPct;
    RETURN (r1 * r2) + vLowPct;
END GetpHCurveHighPercent;




FUNCTION GetSolutionGroupID(pSolutionId IN solutions.solution_id%TYPE) RETURN solutions.group_id%TYPE
IS
  vGroupId solutions.group_id%TYPE;
BEGIN
  SELECT group_id INTO vGroupId FROM solutions WHERE solution_id = pSolutionId;
  RETURN vGroupId;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
  RETURN 0;
END GetSolutionGroupID;


PROCEDURE GetDesignRecipeData(pDesignId IN reservoir_designs.reservoir_design_id%TYPE, pFlatten IN BOOLEAN, pDesignCur OUT refCursor)
IS
BEGIN
  IF pFlatten = False THEN
    OPEN pDesignCur FOR
    SELECT s.group_name, s.concentration, s.units, s.ph, NVL(c.name,s.name) AS chemical_name,
              well_number, drop_number, item_id, solution_id,
              s.name, s.base_conc, s.base_units, s.chemical_id,
              DECODE(units_type,'v/v','v/v',def_stock_units) as def_stock_units,
              DECODE(def_stock_units,'v/v',NVL(def_stock_conc,100),def_stock_conc) as def_stock_conc,
                (def_stock_conc || ' ' || def_stock_units) AS def_stock,
                max_stock_conc, volume, stock_id, lot_id, base_cont_type,
                s.base_src_id
            FROM nested_solutions s 
                LEFT JOIN chemicals c ON s.chemical_id=c.chemical_id
            WHERE coll_id = pDesignId
            ORDER BY well_number, drop_number;
  ELSE
    OPEN pDesignCur FOR 
      SELECT s.group_name, s.concentration, s.units, s.ph, NVL(c.name,s.name) AS chemical_name,
              well_number, drop_number, item_id, solution_id,
              s.name, s.base_conc, s.base_units, s.chemical_id,
              DECODE(units_type,'v/v','v/v',def_stock_units) as def_stock_units,
              DECODE(def_stock_units,'v/v',NVL(def_stock_conc,100),def_stock_conc) as def_stock_conc,
                (def_stock_conc || ' ' || def_stock_units) AS def_stock,
                max_stock_conc, volume, stock_id, lot_id, base_cont_type,
                s.container_id 
            FROM flat_solutions s 
                LEFT JOIN chemicals c ON s.chemical_id=c.chemical_id
            WHERE coll_id = pDesignId
            ORDER BY well_number, drop_number;
  END IF;
END GetDesignRecipeData;
  


PROCEDURE GetDesignRecipeForScreen(pDesignId IN reservoir_designs.reservoir_design_id%TYPE, pDesignCur OUT refCursor)
IS
BEGIN
  OPEN pDesignCur FOR
  SELECT DISTINCT null as group_name, 100 as concentration, 'v/v' as units, null as ph, s.BASE_CONT_NAME AS chemical_name,
            well_number, drop_number, item_id, null as solution_id, s.BASE_CONT_NAME as name, 100 as base_conc,  'v/v' as base_units,
            null as chemical_id,
            null as def_stock_units,
            null as def_stock_conc,
            ' ' AS def_stock,
            null as max_stock_conc, null as volume, null as stock_id, null as lot_id, base_cont_type,
            s.container_id
            FROM nested_solutions s
            LEFT JOIN chemicals c ON s.chemical_id=c.chemical_id
            WHERE coll_id = pDesignId
            ORDER BY well_number, drop_number;
END GetDesignRecipeForScreen;

PROCEDURE GetWaterItem(pRecipeItem IN OUT ITEM_TYPE, pWaterChemId OUT chemicals.chemical_id%TYPE)
IS
  vStockCur refCursor;
  vStock STOCK_TYPE;
BEGIN
  pWaterChemId := GETCHEMICALID('water');
  GetChemStocksNew(pWaterChemId, null, vStockCur);
  FETCH vStockCur INTO vStock;
  IF vStockCur%NOTFOUND = False THEN
    CopyStockToItem(vStock, pRecipeItem);
  ELSE
    pRecipeItem.STOCK_ID := c_LOCAL_WATER_STOCK_ID;
    pRecipeItem.STOCK_NAME := 'water';
    pRecipeItem.SOURCE_NAME := 'water';
    pRecipeItem.STOCK_CONC := 100;
    pRecipeItem.STOCK_UNITS := 'v/v';
    pRecipeItem.STOCK_BARCODE := null;
    pRecipeItem.STOCK_COMMENTS := null; 
  END IF;
END GetWaterItem;

PROCEDURE CopyStockToItem(pStock IN STOCK_TYPE, pRecipeItem IN OUT ITEM_TYPE)
IS
BEGIN
  pRecipeItem.STOCK_ID := pStock.STOCK_ID;
  pRecipeItem.STOCK_NAME := pStock.STOCK_NAME;
  pRecipeItem.SOURCE_NAME := pStock.CHEM_SOURCE;
  IF pStock.STOCK_CONC is not null THEN  
    pRecipeItem.STOCK_CONC := pStock.STOCK_CONC;
  ELSE
    pRecipeItem.STOCK_CONC := 0;
  END IF;
  pRecipeItem.STOCK_UNITS := pStock.STOCK_UNITS;
  pRecipeItem.STOCK_PH := pStock.STOCK_PH;
  pRecipeItem.STOCK_VISCOSITY := pStock.STOCK_VISCOSITY;
  pRecipeItem.STOCK_VOLATILITY := pStock.STOCK_VOLATILITY;
  pRecipeItem.STOCK_BARCODE := pStock.STOCK_BARCODE;
  pRecipeItem.STOCK_COMMENTS := pStock.STOCK_COMMENTS;
END CopyStockToItem;

/* This is the Henderson-Hasselbach Equation for combining different buffer concentrations to achieve a desired pH */
/* The result is the fraction of the low pH stock to use */
FUNCTION fHHLowPHPct(pStock1pH IN STOCKS.STOCK_PH%TYPE,
                     pStock2pH IN STOCKS.STOCK_PH%TYPE,
                     pDesiredPH IN STOCKS.STOCK_PH%TYPE,
                     pChemPKA IN chemicals.pka1%TYPE) RETURN PH_POINT.HIGH_PH_FRACTION_X%TYPE
IS
    a1 NUMERIC(10,5);
    a2 NUMERIC(10,5);
    b1 NUMERIC(10,5);
    b2 NUMERIC(10,5);
    r1 NUMERIC(10,5);
    r2 NUMERIC(10,5);
    r3 NUMERIC(10,5);
BEGIN
    r1 := POWER(10,least(pStock1pH, pStock2pH) - pChemPKA);
    r2 := POWER(10,greatest(pStock1pH, pStock2pH) - pChemPKA);
    r3 := POWER(10,(pDesiredPH - pChemPKA));
    a1 := 1 / (1 + r1);
    a2 := 1 / (1 + r2);
    b1 := 1 / (1 + (1 / r1));
    b2 := 1 / (1 + (1 / r2));
    RETURN ((r3 * a2) - b2) / (b1 - b2 - (r3 * (a1 - a2)));
END fHHLowPHPct;

  PROCEDURE GetStockVolume(
      pTargetConc    IN    STOCKS.STOCK_CONC%TYPE,
      pTargetUnits   IN    VARCHAR,
      pStockConc     IN    STOCKS.STOCK_CONC%TYPE,
      pStockUnits    IN    VARCHAR,
      pStockVolume   IN OUT  CONTAINERS.VOL%TYPE
   ) IS
  BEGIN
    CASE
      WHEN pTargetUnits in ('v/v') THEN
        IF pStockConc = 0 OR pStockConc = 100 THEN
          pStockVolume := pTargetConc;
        ELSIF pTargetConc < pStockConc THEN
          pStockVolume := (pTargetConc * 100)/pStockConc;
        ELSIF pTargetConc = pStockConc THEN
          pStockVolume := 100;
        ELSE
          pStockVolume := 999;
        END IF;
      WHEN pTargetUnits in ('w/v', 'M', 'mg/ml') THEN
        IF pStockUnits = 'mM' THEN
          IF pStockConc > 0 THEN
             pStockVolume := (pTargetConc / (pStockConc / 1000)) * 100;
          ELSE
             pStockVolume := 100;
          END IF;
        ELSE
          IF pStockConc > 0 THEN
            pStockVolume := (pTargetConc / pStockConc) * 100;
          ELSE
            pStockVolume := 100;
          END IF;
        END IF;
    END CASE;
    --dbms_output.put_line('GetStockVolume(): return '||pStockVolume);
  END GetStockVolume;
  
  
 PROCEDURE GetChemStocks_Ph(
      pChemicalId   IN   INTEGER,
      pTargetPH       IN   STOCKS.STOCK_PH%TYPE,
      pTargetTol    IN   STOCKS.STOCK_PH%TYPE,
      pCurStocks    OUT  refCursor
  ) 
  IS
  BEGIN
    OPEN pCurStocks FOR
      SELECT stock_id, stock_name, stock_conc, stock_units, stock_ph,
                stock_viscosity, stock_volatility,
                stock_barcode, stock_state, stock_comments,
                s.chemical_id, solubility, pka1, pka2, pka3, c.name as stock_source,
                ABS(stock_ph - pTargetPH) as NearpH, 0 as volume_pct 
            FROM stocks s, chemicals c
            WHERE (s.chemical_id= pChemicalId OR s.chemical_id IN (SELECT sub_chemical_id FROM CHEMICAL_SUBSTITUTES WHERE chemical_id = pChemicalId))
                AND s.chemical_id=c.chemical_id
              AND stock_state<>0
                AND ABS(stock_ph - pTargetPH ) <= pTargetTol
            ORDER BY CASE WHEN s.CHEMICAL_ID = pChemicalId THEN 1 ELSE 0 END, stock_conc DESC, ABS(stock_ph - pTargetPH) DESC;
  END GetChemStocks_Ph;
  
  PROCEDURE GetChemStocksNew(
      pChemicalId   IN   INTEGER,
      pTargetUnits  IN   VARCHAR2,
      pCurStocks    OUT  refCursor
  ) IS
  BEGIN        
        OPEN pCurStocks FOR
        SELECT stock_id, stock_name, stock_conc, stock_units, stock_ph,
                stock_viscosity, stock_volatility,
                stock_barcode, stock_state, stock_comments,
                s.chemical_id, solubility, pka1, pka2, pka3, c.name as stock_source,
                stock_ph as NearpH, 0 as vol_pct
            FROM stocks s, chemicals c
            WHERE (s.chemical_id= pChemicalId OR s.chemical_id IN (SELECT sub_chemical_id FROM CHEMICAL_SUBSTITUTES WHERE chemical_id = pChemicalId))
                AND s.chemical_id=c.chemical_id
                AND stock_state<>0
                AND stock_ph is null
                AND ct_misc.GetBaseUnits(DECODE(pTargetUnits,null,c.units_type,pTargetUnits)) = GetBaseUnits(stock_units)
            ORDER BY CASE WHEN s.CHEMICAL_ID = pChemicalId THEN 1 ELSE 0 END, stock_conc DESC, stock_ph DESC;

  END GetChemStocksNew;
  
  
  PROCEDURE GetHHPair(
      pChemicalId   IN CHEMICALS.CHEMICAL_ID%TYPE,
      pTargetPH     IN STOCKS.STOCK_PH%TYPE,
      pTargetTol    IN STOCKS.STOCK_PH%TYPE,
      pCurStocks    OUT  refCursor
  ) IS
  BEGIN
    OPEN pCurStocks FOR
      SELECT ch.pka,
        sa.chemical_id as chem_id, sa.stock_name as NameA,
        sb.stock_name as NameB, sa.stock_id as ID_A, sb.stock_id as ID_B,
        sa.stock_conc as conc_a, sa.stock_units as units_a,
        sb.stock_conc as conc_b, sa.stock_units as units_b,
        to_char(sa.stock_conc) || sa.stock_units as ConcA,
        to_char(sb.stock_conc) || sb.stock_units as ConcB,
        sa.stock_ph as pHA, sb.stock_ph as pHB,
        case when ch.pka IS NOT NULL then (abs(ch.pka - sa.stock_ph) + abs(ch.pka - sb.stock_ph))/2 ELSE null end as avg_dist,
        sa.stock_viscosity, sa.stock_volatility, sa.stock_barcode, sa.stock_comments,
        (select name from chemicals c where c.chemical_id = sa.chemical_id and rownum = 1) as stock_source
        FROM stocks sa
        FULL OUTER JOIN 
        (SELECT chemical_id, pka1 as pka from chemicals where pka1 is not null UNION
        SELECT chemical_id, pka2 as pka from chemicals where pka2 is not null UNION
        SELECT chemical_id, pka3 as pka from chemicals where pka3 is not null
        ORDER BY chemical_id)
        ch ON ch.chemical_id = sa.chemical_id
        FULL OUTER JOIN stocks sb ON sa.chemical_id = sb.chemical_id and (sa.stock_pH <> sb.stock_pH)
        WHERE (sa.chemical_id= pChemicalId OR sa.chemical_id IN (SELECT sub_chemical_id FROM CHEMICAL_SUBSTITUTES WHERE chemical_id = pChemicalId))
        AND (sa.stock_pH Is Not Null AND sb.stock_pH Is Not Null)
        AND sa.stock_ph < sb.stock_ph
        AND sa.stock_conc = sb.stock_conc
        AND sa.stock_units = sb.stock_units
        AND (sa.stock_state<>0 and sb.stock_state<>0)
        AND abs(ch.pka - sa.stock_ph) <= pTargetTol and abs(ch.pka - sb.stock_ph) <= pTargetTol
        AND (sa.stock_ph <= pTargetPH and sb.stock_ph >= pTargetPH)
        ORDER BY CASE WHEN sa.CHEMICAL_ID = pChemicalId THEN 1 ELSE 0 END, avg_dist DESC, concA DESC;
  END GetHHPair;
  
  PROCEDURE AddStocksForComplexBuffer(
      pItemColl IN OUT item_coll,
      pFailReason    OUT VARCHAR2,
      pFailCode      OUT INTEGER,
      pChemicalId    IN INTEGER,
      pItemConc      IN STOCKS.STOCK_CONC%TYPE,
      pItemUnits     IN VARCHAR2,
      pItemPH        IN STOCKS.STOCK_PH%TYPE,
      pTargetName    IN VARCHAR2,
      pTargetType    IN VARCHAR2
  ) IS
    vPhCurveId ph_curve.pk_pH_Curve_id%TYPE;
    vHighSol STOCK_SOLUTION_TYPE;
    vLowSol STOCK_SOLUTION_TYPE;
    vName ph_curve.name%TYPE;
    vStockCur refCursor;
    vStock      STOCK_TYPE;
    vFoundStock  BOOLEAN;
    vTempStock STOCK_TYPE;
    vItem ITEM_TYPE;
    vCurvePct ph_point.HIGH_PH_FRACTION_X%TYPE;
    vErrMsg VARCHAR2(4096);
    
  BEGIN
    pFailCode := 0;
    pFailReason := null;
    vPhCurveId := GetpHCurveIDByChemicalID(pChemicalId);
    IF (vPhCurveId > 0) THEN
      IF GetpHCurveByID(vPhCurveId, vName, vLowSol, vHighSol) = True THEN
        -- Now, check for each stock referenced by the pHCurve
        -- if the stocks both exist, then [compute relative proportions]<- do this later
        --  add both to one stock object using HH fields
        vLowSol.SOURCE_ID := GetChemicalId(vLowSol.SOURCE_NAME);
        IF vLowSol.SOURCE_ID is null THEN
          pFailReason := c_failed_no_chemical || ' Cannot find chemical id for ' || vLowSol.SOURCE_NAME;
          RETURN;
        END IF;
        GetChemStocks_Ph(vLowSol.SOURCE_ID, vLowSol.STOCK_PH, 999, vStockCur);
        vFoundStock := false;
        -- Fetch the LAST stock in the list that matches our criteria
        LOOP
          FETCH vStockCur INTO vTempStock;
          IF vTempStock.STOCK_CONC = vLowSol.STOCK_CONC AND vTempStock.STOCK_UNITS = vLowSol.STOCK_UNITS THEN
            vFoundStock := true;
            vStock := vTempStock;
          END IF;
          EXIT WHEN vStockCur%NOTFOUND;
        END LOOP;
        CLOSE vStockCur;
        -- Biz rule: there must be matching low and high ph stocks to use the ph curve interpolation
        -- 'matching' is defined as having the same conc and pH as called out in the imported pH Curve XML file,
        -- +- .2 of the pH value
        IF vFoundStock = false THEN
          pFailReason := c_FAILED_NO_STOCK || ' Cannot find a stock for ' || vLowSol.SOURCE_NAME || ' with ANY pH value';
          RETURN;
        END IF;
        IF pItemPH < (vLowSol.STOCK_PH - c_COMPLEX_BUFFER_PH_TOLERANCE) OR pItemPH > (vHighSol.STOCK_PH + c_COMPLEX_BUFFER_PH_TOLERANCE) THEN
          pFailReason := c_failed_item_phcurve_no_stock || ' pH of ' || GetChemName(pChemicalId) || ' must be between ' || to_char(vLowSol.STOCK_PH, '99.99') || ' and ' || to_char(vHighSol.STOCK_PH,'99.99');
          RETURN;
        END IF;
      ELSE
        pFailReason := c_failed_item_phcurve_no_stock || ' No pH curve data exists for ' || GetChemName(pChemicalId);
        RETURN;
      END IF;
      GetStockVolume(pItemConc, pItemUnits, vLowSol.STOCK_CONC, vLowSol.STOCK_UNITS, vItem.VOLUME_PCT);
      vErrMsg := null;
      vCurvePct := GetpHCurveHighPercent(vPhCurveId, pItemPH, vErrMsg);
      IF vCurvePct < 0 THEN
        pFailReason := c_FAILED_ITEM_pH_OUT_OF_RANGE || GetChemName(pChemicalId) ||': ' ||  vErrmsg;
        RETURN;
      END IF;
      IF vItem.VOLUME_PCT <= 100 THEN
        CopyStockToItem(vStock, vItem);
        
        vHighSol.SOURCE_ID := GetChemicalId(vHighSol.SOURCE_NAME);
        IF vHighSol.SOURCE_ID is null THEN
          pFailReason := c_failed_no_chemical || ' Cannot find chemical id for ' || vHighSol.SOURCE_NAME;
          RETURN;
        END IF;
        
        GetChemStocks_Ph(vHighSol.SOURCE_ID, vHighSol.STOCK_PH, 999, vStockCur);
        vFoundStock := false;
        -- Fetch the LAST stock in the list that matches our criteria
        LOOP
          FETCH vStockCur INTO vTempStock;
          IF vTempStock.STOCK_CONC = vHighSol.STOCK_CONC AND vTempStock.STOCK_UNITS = vHighSol.STOCK_UNITS THEN
            vFoundStock := true;
            vStock := vTempStock;
          END IF;
          EXIT WHEN vStockCur%NOTFOUND;
        END LOOP;
        CLOSE vStockCur;
        
        IF vFoundStock = false THEN
          pFailReason := c_FAILED_NO_STOCK || ' Cannot find a stock for ' || vHighSol.SOURCE_NAME || ' with ANY pH value';
          RETURN;
        END IF;
                
        GetStockVolume(pItemConc, pItemUnits, vHighSol.STOCK_CONC, vHighSol.STOCK_UNITS, vItem.HH_VOLUME_PCT);
        vItem.HH_HIGH_PH_PCT := vCurvePct; -- this will store the HighStockPercent for Complex Buffer
                            
        -- now add high stock to HH section of stock object
        vItem.ITEM_TYPE := c_ITEM_TYPE_COMPLEX_BUFF;
        vItem.HH_STOCK_ID := vStock.STOCK_ID;
        vItem.HH_STOCK_NAME := vStock.STOCK_NAME;
        vItem.HH_STOCK_PH := vStock.STOCK_PH;
        vItem.HH_DESIRED_PH := pItemPh;
        vItem.HH_STOCK_CONC := vStock.STOCK_CONC;
        vItem.HH_STOCK_UNITS := vStock.STOCK_UNITS;
            
        -- this next part just duplicates the target information for this item
        vItem.TARGET_CONC := pItemConc;
        vItem.TARGET_UNITS := pItemUnits;
        vItem.TARGET_PH := pItemPh;
        vItem.TARGET_NAME := pTargetName;
        vItem.TARGET_TYPE := pTargetType;
        
        pItemColl.EXTEND;
        pItemColl(pItemColl.LAST) := vItem;
      ELSE
        pFailReason := c_failed_item_volume || ' Cannot make a solution of ' || to_char(pItemConc,'999.99') || ' ' || pItemUnits || ' ' || GetChemName(pChemicalId) || ' using a stock of ' || to_char(vLowSol.STOCK_CONC,'999.99') || ' ' || vLowSol.STOCK_UNITS;
      END IF;
    ELSE
      pFailReason := c_failed_item_phcurve_no_stock || ' No pH curve exists for ' || GetChemName(pChemicalId);
    END IF;
  END AddStocksForComplexBuffer;
  
  
  PROCEDURE AddStocksForChemical(
      pItemColl IN OUT item_coll,
      pFailReason    OUT VARCHAR2,
      pFailCode      OUT INTEGER,
      pChemicalId    IN INTEGER,
      pItemConc      IN STOCKS.STOCK_CONC%TYPE,
      pItemUnits     IN VARCHAR2,
      pItemPH        IN STOCKS.STOCK_PH%TYPE,
      pTargetName    IN VARCHAR2,
      pTargetType    IN VARCHAR2,
      pAllowHH       IN BOOLEAN
    ) IS

      vStock      STOCK_TYPE;
      vStockCur   refCursor;
      vRowCnt     INTEGER;
      
      /* Used for HH */
      vPka        chemicals.pka1%TYPE;
      vChemId     chemicals.chemical_id%TYPE;
      vNameA      stocks.stock_name%TYPE;
      vNameB      stocks.stock_name%TYPE;
      vIdA        stocks.stock_id%TYPE;
      vIdB        stocks.stock_id%TYPE;
      vConcA      stocks.stock_conc%TYPE;
      vUnitsA     stocks.stock_units%TYPE;
      vConcB      stocks.stock_conc%TYPE;
      vUnitsB     stocks.stock_units%TYPE;
      vConcUnitsA varchar2(40);
      vConcUnitsB varchar2(40);
      vPhA        stocks.stock_ph%TYPE;
      vPhB        stocks.stock_ph%TYPE;
      vAvgDist    stocks.stock_ph%TYPE;
      vStockViscosity stocks.stock_viscosity%TYPE;
      vStockVolatility stocks.stock_volatility%TYPE;
      vStockBarcode stocks.stock_barcode%TYPE;
      vStockComments stocks.stock_comments%TYPE;
      vStockSource chemicals.name%TYPE;      
      vStockFound  BOOLEAN;
      vVolumePct   NUMERIC;
      vStockConcX   stocks.stock_conc%TYPE;
      vLoop INTEGER;
      
      start_time pls_integer;

    BEGIN
      vStockFound := False;
      pFailCode := 0;
      pFailReason := null;
      /*dbms_output.put_line('pItemPH='||pItemPH);*/
      FOR vLoop in 0..1
      LOOP
        IF vStockFound = False and (vLoop=0 or pItemPH is not null) THEN
          IF pItemPH is null THEN /* target has no pH */
            GetChemStocksNew(pChemicalId,pItemUnits,vStockCur);
          ELSE
            IF vLoop = 0 THEN
              GetChemStocks_pH(pChemicalID, pItemPH, 0 ,vStockCur);
            ELSE
              GetChemStocks_pH(pChemicalID, pItemPH, c_MATCH_PH,vStockCur);
            END IF;
          END IF;
          vRowCnt := 0;
          
          LOOP
            start_time := dbms_utility.get_time;

            FETCH vStockCur INTO vStock;
            EXIT WHEN vStockCur%NOTFOUND;
            
            dbms_output.put_line('A: ' || (dbms_utility.get_time - start_time) || ' cs'); --/100

            IF vStock.STOCK_CONC is NULL THEN
              vStockConcX := 0;
            ELSE
              vStockConcX := vStock.STOCK_CONC;
            END IF;
            
            IF pItemUnits = 'v/v' OR (vStockConcX > 0 and vStock.STOCK_UNITS is not null) THEN 
              GetStockVolume(pItemConc, pItemUnits,  vStockConcX, vStock.STOCK_UNITS, vStock.VOLUME_PCT);
              IF vStock.VOLUME_PCT <= 100 THEN
                vStockFound := True;
                pFailReason := '';
                pItemColl.EXTEND;
                pItemColl(pItemColl.LAST).VOLUME_PCT := vStock.VOLUME_PCT;
                CopyStockToItem(vStock, pItemColl(pItemColl.LAST));
              ELSE
                pFailReason := 'Single stock well overflow. Correct by lowering concentration of ' || to_char(pItemConc,'999.99') || ' ' || pItemUnits || ' ' || GetChemName(pChemicalId);
                pFailCode := c_FAILCODE_ITEM_VOL; 
              END IF;
            ELSE  
              pFailReason := c_FAILED_ITEM_VOLUME || ' Cannot find a stock for ' || GetChemName(pChemicalId) || ' ' || to_char(pItemConc,'999.99') || ' ' || pItemUnits;
              pFailCode := c_FAILCODE_ITEM_VOL; 
            END IF;
            /*DBMS_OUTPUT.PUT_LINE(vStock.STOCK_NAME || vStock.STOCK_CONC || vStock.STOCK_UNITS || vStock.STOCK_PH);*/
            vRowCnt := vRowCnt+1;
          END LOOP;
          IF vRowCnt = 0 THEN
            IF pItemPH is null THEN
              pFailReason := c_FAILED_NO_STOCK || ' Cannot find a stock for ' || GetChemName(pChemicalId);
            ELSE
              pFailReason := c_FAILED_ITEM_PH  || ' Cannot find a stock for ' || GetChemName(pChemicalId) || ' at pH ' || pItemPH;
            END IF;
            pFailCode :=  c_FAILCODE_ITEM_NO_STOCK;
          END IF;
        END IF;
      END LOOP;
      
      IF vStockFound = False and pItemPH is not null THEN
        GetHHPair(pChemicalId, pItemPH, c_HH_PKA_RANGE, vStockCur);
        LOOP
          FETCH vStockCur INTO vPka, vChemId, vNameA, vNameB, vIdA, vIdB, vConcA, vUnitsA,  vConcB, vUnitsB, vConcUnitsA, vConcUnitsB, 
                   vPhA, vPhB, vAvgDist, vStockViscosity, vStockVolatility, vStockBarcode, vStockComments, vStockSource;
          EXIT WHEN vStockCur%NOTFOUND;
          IF vConcA is NULL THEN
            vStockConcX := 0;
          ELSE
            vStockConcX := vConcA;
          END IF;
          vStock.STOCK_ID := vIdA;
          vStock.STOCK_NAME := vNameA;
          vStock.STOCK_CONC := vConcA;
          vStock.STOCK_UNITS := vUnitsA;
          vStock.STOCK_PH := vPhA;
          vStock.STOCK_VISCOSITY := vStockViscosity;
          vStock.STOCK_VOLATILITY := vStockVolatility;
          vStock.STOCK_BARCODE := vStockBarcode;
          vStock.STOCK_COMMENTS := vStockComments;
          GetStockVolume(pItemConc, pItemUnits,  vStockConcX, vStock.STOCK_UNITS, vStock.VOLUME_PCT);
          IF vStock.VOLUME_PCT <= 100 THEN
                vStockFound := True;
                pFailReason := null;
                pFailCode := 0;
                pItemColl.EXTEND;
                pItemColl(pItemColl.LAST).VOLUME_PCT := vStock.VOLUME_PCT;
                CopyStockToItem(vStock, pItemColl(pItemColl.LAST));
                  
                pItemColl(pItemColl.LAST).ITEM_TYPE := c_ITEM_TYPE_HH_PAIR;
                pItemColl(pItemColl.LAST).HH_STOCK_ID := vIdB;
                pItemColl(pItemColl.LAST).HH_STOCK_NAME := vNameB;
                pItemColl(pItemColl.LAST).HH_STOCK_PH := vPhB;
                pItemColl(pItemColl.LAST).HH_PKA := vPka;
                pItemColl(pItemColl.LAST).HH_DESIRED_PH := pItemPH;
                pItemColl(pItemColl.LAST).HH_STOCK_CONC := vStockConcX;
                pItemColl(pItemColl.LAST).HH_STOCK_UNITS := vUnitsA;
                         
                pItemColl(pItemColl.LAST).TARGET_CONC := pItemConc;
                pItemColl(pItemColl.LAST).TARGET_UNITS := pItemUnits;
                pItemColl(pItemColl.LAST).TARGET_PH := pItemPH;
                pItemColl(pItemColl.LAST).TARGET_NAME := pTargetName;
                pItemColl(pItemColl.LAST).TARGET_TYPE := pTargetType;
                  
          END IF;
        END LOOP;
      END IF;
    END AddStocksForChemical;
    
    FUNCTION GenerateItemRecipe(pRecipeColl IN OUT recipe_coll,
                                pItemNum IN INTEGER,
                                pWaterRecipeItem IN ITEM_TYPE,
                                pWaterChemId IN chemicals.chemical_id%TYPE,
                                pFundMixGroupId IN chem_groups.group_id%TYPE,
                                pBufferGroupId IN chem_groups.group_id%TYPE)
                               RETURN CONTAINERS.VOL%TYPE
    IS
      vItemCollList item_coll_list;
      vItemColl item_coll;
      vItem ITEM_TYPE;
      vRecipeCnt INTEGER;
      vSizeBookMark INTEGER;
      vItemCollCnt INTEGER;
      vUsePhCurve BOOLEAN;
      vLoopCnt INTEGER;
      vChemGroupId solutions.group_id%TYPE;
      vCurveId ph_curve.pk_pH_Curve_id%TYPE;
      vChemicalId chemicals.chemical_id%TYPE;
      vSolutionId solutions.solution_id%TYPE;
      vItemConc STOCKS.STOCK_CONC%type;
      vItemUnits VARCHAR2(16 BYTE);
      vFailReason VARCHAR2(256);
      vFailCode INTEGER;
      vStockCur refCursor;
      
      vMatchCost NUMBER(10,4);
      vMatchIndex INTEGER;
      vCost NUMBER(10,4);
      vUsedVol NUMBER(10,3);
      vInvalid BOOLEAN;
      
      vItemId VARCHAR2(128);
      vSrcItemId NUMBER(38);
      
      vFailed BOOLEAN;
    BEGIN
      vFailReason := null;
      vItemCollList := item_coll_list();
      vFailed := false;
      FOR vRecipeCnt in pRecipeColl.FIRST..pRecipeColl.LAST
      LOOP
        -- Only process the supplied well number
        IF pRecipeColl(vRecipeCnt).well_number = pItemNum THEN
       
          vItemColl := item_coll();
        
          vItemId := pRecipeColl(vRecipeCnt).item_id; 
          vSrcItemId := pRecipeColl(vRecipeCnt).src_item_id;
        
          IF pRecipeColl(vRecipeCnt).target_conc is null THEN
            vItemConc := 0;
          ELSE
            vItemConc := pRecipeColl(vRecipeCnt).target_conc;
          END IF;
          IF pRecipeColl(vRecipeCnt).target_units = 'mM' THEN
            vItemUnits := 'M';
            vItemConc := vItemConc / 1000;
          ELSE
            vItemUnits := pRecipeColl(vRecipeCnt).target_units;
          END IF;
        
          IF pRecipeColl(vRecipeCnt).chemical_id is null THEN
            vChemicalId := 0;
          ELSE
            vChemicalId := pRecipeColl(vRecipeCnt).chemical_id;
          END IF;
          IF pRecipeColl(vRecipeCnt).solution_id is null THEN
            vSolutionId := 0;
          ELSE
            vSolutionId := pRecipeColl(vRecipeCnt).solution_id;
          END IF;
          vChemGroupId := GetSolutionGroupID(vSolutionId);
          vCurveId := GetpHCurveIDByChemicalID(vChemicalId);
          vUsePhCurve := (vCurveId > 0) and (vChemicalId > 0) and pRecipeColl(vRecipeCnt).target_ph is not null and 
                       (((pFundMixGroupId <> 0) and (vChemGroupId = pFundMixGroupId)) or  
                       ((pBufferGroupId <> 0) and (vChemGroupId = pBufferGroupId)));
                       
          -- Here the potential stocks for each chemical are assembled in vItemColl, then added to vItemCollList
          IF vUsePhCurve = True THEN
            dbms_output.put_line('Calling AddStocksForComplexBuffer');
            AddStocksForComplexBuffer(vItemColl, vFailReason, vFailCode, vChemicalId, vItemConc, vItemUnits,
               pRecipeColl(vRecipeCnt).target_ph, pRecipeColl(vRecipeCnt).item_name, pRecipeColl(vRecipeCnt).target_type);

          ELSIF vChemicalId > 0 THEN
            dbms_output.put_line('Calling AddStocksForChemical');
            AddStocksForChemical(vItemColl, vFailReason, vFailCode, vChemicalId, vItemConc, vItemUnits,
              pRecipeColl(vRecipeCnt).target_ph, pRecipeColl(vRecipeCnt).item_name, pRecipeColl(vRecipeCnt).target_type,
              (vChemGroupId = pBufferGroupId) );

          ELSE
            dbms_output.put_line('Should be calling AddStocksForSolution');
            /* calls AddStocksForSolution(... */
            vFailReason := c_failcode_item_no_stock;
          END IF;
          vItemCollList.EXTEND;
          vItemCollList(vItemCollList.LAST) := vItemColl;
        
          IF vItemColl.COUNT = 0 THEN
            /* CT recreates default stocks and tries again, could I be bothered - NO !!! */
            vFailed := true;
            pRecipeColl(vRecipeCnt).failed_reason := vFailReason;
          END IF;
        END IF; -- Only process supplied well number
      END LOOP; -- end loop recipe objs
      
      -- NB: infinite loop
      -- Potential stocks are selected here
      vLoopCnt := 0;
      LOOP
        vLoopCnt := vLoopCnt + 1;
        IF vLoopCnt > 100 THEN
          dbms_output.put_line('infinite loop problem');
          EXIT;
        END IF;
        -- Only process the supplied well number
        vRecipeCnt := pRecipeColl.FIRST;
        WHILE vRecipeCnt <= pRecipeColl.LAST AND pRecipeColl(vRecipeCnt).well_number != pItemNum
        LOOP
          vRecipeCnt := vRecipeCnt + 1;
        END LOOP;
        IF vRecipeCnt > pRecipeColl.LAST THEN
          EXIT;
        END IF;
 
        vMatchCost := -1;
        vMatchIndex := 0;
        vUsedVol := 0;
        vInvalid := false;
        
        FOR vItemCollCnt in vItemCollList.FIRST..vItemCollList.LAST
        LOOP
          vItemColl := vItemCollList(vItemCollCnt);
          IF vItemColl.COUNT > 0 THEN
            vItem := vItemColl(vItemColl.LAST);
            CopyItemToRecipe(vItem, pRecipeColl(vRecipeCnt));
            vUsedVol := vUsedVol + vItem.VOLUME_PCT;
            IF vItemColl.COUNT > 1 THEN
              vItem := vItemColl(vItemColl.LAST-1);
              -- Discard stocks that result in the biggest reduction in volume first
              -- This prevents HH pairs being discarded before stocks that have different concentrations
              IF vMatchCost < abs(vItemColl(vItemColl.LAST).VOLUME_PCT - vItemColl(vItemColl.LAST-1).VOLUME_PCT) THEN
                vMatchCost := abs(vItemColl(vItemColl.LAST).VOLUME_PCT - vItemColl(vItemColl.LAST-1).VOLUME_PCT);
                vMatchIndex := vItemCollCnt;
              END IF;
            END IF;
          ELSE
            vInvalid := true;
          END IF;
          vRecipeCnt := vRecipeCnt + 1;
          -- Only process the supplied well number
          WHILE vRecipeCnt <= pRecipeColl.LAST AND pRecipeColl(vRecipeCnt).well_number != pItemNum
          LOOP
            vRecipeCnt := vRecipeCnt + 1;
          END LOOP;
          IF vRecipeCnt > pRecipeColl.LAST THEN
            EXIT;
          END IF;
        END LOOP; -- end loop coll list
      
        IF vInvalid = true THEN
          vUsedVol := -1;
        END IF;
        
        vSizeBookMark := pRecipeColl.COUNT;
        
        -- 2nd loop over recipe objs
        vItemCollCnt := vItemCollList.FIRST;
        vRecipeCnt := pRecipeColl.FIRST;
        WHILE vRecipeCnt <= pRecipeColl.LAST AND vItemCollCnt <= vItemCollList.LAST
        LOOP
          -- Only process the supplied well number
          IF pRecipeColl(vRecipeCnt).well_number = pItemNum THEN
            IF pRecipeColl(vRecipeCnt).ITEM_TYPE = c_ITEM_TYPE_HH_PAIR OR pRecipeColl(vRecipeCnt).ITEM_TYPE = c_ITEM_TYPE_COMPLEX_BUFF THEN
              vItemColl := vItemCollList(vItemCollCnt);
              AddPair(pRecipeColl(vRecipeCnt).ITEM_TYPE,
                    pRecipeColl(vRecipeCnt).ITEM_ID,
                    pRecipeColl(vRecipeCnt).SRC_ITEM_ID, 
                    pItemNum, vItemColl, pRecipeColl, vRecipeCnt);
            END IF;
            vItemCollCnt := vItemCollCnt + 1;
          END IF;

          vRecipeCnt := vRecipeCnt + 1;
        END LOOP; --  2nd loop over recipe objs
          
        
        -- Add Water to make up 100% then exit
        IF vUsedVol < 100 THEN
          pRecipeColl.EXTEND;
          CopyItemToRecipe(pWaterRecipeItem, pRecipeColl(pRecipeColl.LAST));
          pRecipeColl(pRecipeColl.LAST).item_added := 1; /* Is this a boolean?? */
          pRecipeColl(pRecipeColl.LAST).item_id := vItemId;
          pRecipeColl(pRecipeColl.LAST).src_item_id := vSrcItemId;
          pRecipeColl(pRecipeColl.LAST).well_number := pItemNum;
          pRecipeColl(pRecipeColl.LAST).CHEMICAL_ID := pWaterChemId;
          pRecipeColl(pRecipeColl.LAST).volume_pct := 100-vUsedVol;
          pRecipeColl(pRecipeColl.LAST).item_conc := 100-vUsedVol;
          pRecipeColl(pRecipeColl.LAST).item_units := 'v/v';
          pRecipeColl(pRecipeColl.LAST).item_ph := null;
          pRecipeColl(pRecipeColl.LAST).item_name := pWaterRecipeItem.STOCK_NAME;
          pRecipeColl(pRecipeColl.LAST).target_conc := null;
          pRecipeColl(pRecipeColl.LAST).target_units := null;
          pRecipeColl(pRecipeColl.LAST).target_pH := null;
          pRecipeColl(pRecipeColl.LAST).target_name := pWaterRecipeItem.STOCK_NAME;
          pRecipeColl(pRecipeColl.LAST).target_type := 'stock';
          pRecipeColl(pRecipeColl.LAST).solution_id := 0;
          EXIT;
        END IF;
        
        IF vUsedVol = 100 OR vMatchIndex < 1 THEN
          EXIT;
        END IF;
        
        -- If we have come here then we have overflowed
        -- Remove first item in collection, so that we can try a higher concentration
        vItemCollList(vMatchIndex).TRIM;
        
        -- This will delete the added records (either water or HH stock) because we overflowed -ccb
        WHILE pRecipeColl.COUNT > vSizeBookMark
        LOOP
          pRecipeColl.TRIM;
        END LOOP;
        
      END LOOP;
      
      IF vUsedVol > c_WELL_OVERFLOW_CUTOFF AND vFailed = false THEN
        FOR vRecipeCnt in pRecipeColl.FIRST..pRecipeColl.LAST
        LOOP
          IF pRecipeColl(vRecipeCnt).failed_reason is null AND pRecipeColl(vRecipeCnt).well_number = pItemNum THEN
            pRecipeColl(vRecipeCnt).overflow_flag := true;
            pRecipeColl(vRecipeCnt).failed_reason := to_char(pRecipeColl(vRecipeCnt).TARGET_CONC,'999.99') || ' ' || pRecipeColl(vRecipeCnt).TARGET_UNITS || ' ' || pRecipeColl(vRecipeCnt).TARGET_NAME;
          END IF;
        END LOOP;
      END IF;
      
      RETURN vUsedVol;
      
    END GenerateItemRecipe;
    
    
    
 PROCEDURE GetRecipeForScreen( pDesignId IN reservoir_designs.reservoir_design_id%TYPE, 
                               pRecipe IN OUT VARCHAR2, 
                               pErrors IN OUT VARCHAR2, 
                               pErrCnt IN OUT INTEGER
                               --,recipe_array OUT well_recipe_array
                               )
    IS
     vBufferGroupId  chem_groups.group_id%TYPE;
     vFundMixGroupId chem_groups.group_id%TYPE;
     vWaterRecipeItem ITEM_TYPE;
     vtotalVolume CONTAINERS.VOL%TYPE;
     vDesignCur  refCursor;
     vRecipeColl recipe_coll;
     vFlatten BOOLEAN;
      vGroupName VARCHAR2(32);
      vConc NUMBER;
      vUnits VARCHAR2(16);
      vPh NUMBER(4,2);
      vChemicalName VARCHAR2(128);
      vWellNumber NUMBER(38);
      vDropNumber NUMBER(38);
      
      vItemId VARCHAR2(128);
      vSolutionId NUMBER(38);
      vName VARCHAR2(128);
      vBaseConc NUMBER;
      vBaseUnits VARCHAR2(16);
      vChemicalId NUMBER(38);
      vDefStockUnits VARCHAR2(7);
      vDefStockConc NUMBER(10,4);
      vDefStock VARCHAR2(128);
      vMaxStockConc NUMBER(10,2);
      vVolume NUMBER(22,12);
      vStockId NUMBER(38);
      vLotId NUMBER(38);
      vBaseContType VARCHAR2(32);
      vSrcItemId VARCHAR2(32);
      vTempStr VARCHAR2(3000);
      vWellStr VARCHAR2(3000); --recipe string for one well
      
      vWellNum INTEGER;
      vWellNumStr VARCHAR2(20); --well name i.e. A1
      vErrDoneWellId BOOLEAN;
      
      vDesignFound BOOLEAN;
      
      vReservoirDesignId reservoir_designs.reservoir_design_id%TYPE;
      vFormatId  reservoir_designs.format_id%TYPE;
      vFormatName plate_formats.name%TYPE;
      vNumRows plate_formats.nrows%TYPE;
      vNumCols plate_formats.ncols%TYPE;
      vNumSubs plate_formats.nsubs%TYPE;
      vMaxResVol plate_formats.max_res_vol%TYPE;
      vMaxDropVol plate_formats.max_drop_vol%TYPE;
      vDefResVol plate_formats.def_res_vol%TYPE;
      vDefDropVol plate_formats.def_drop_vol%TYPE;
      vDesignMode reservoir_designs.design_mode%TYPE;
      vDesignName reservoir_designs.design_name%TYPE;
      vUserName reservoir_designs.username%TYPE;
      vDesignDate reservoir_designs.design_date%TYPE;
      vProjectId reservoir_designs.project_id%TYPE;
      vProjectName projects.name%TYPE;
      vResVol reservoir_designs.res_vol%TYPE;
      vUsageCount reservoir_designs.usage_count%TYPE;
      vComments reservoir_designs.comments%TYPE;
      vCollType coll_types.coll_type%TYPE;
      vWaterChemId chemicals.chemical_id%TYPE;
      
      --not used as ADO.NET doesn't support arrays
      --recipe_array well_recipe_array;
      
      start_time pls_integer;
      item_time pls_integer;
      item_time_tot pls_integer;

    BEGIN
      DBMS_OUTPUT.ENABLE(1000000);
      pErrCnt := 0;
      pRecipe := ' ';
      pErrors := ' ';
      --22364; -- 'Grid_E1_JCSG+_C3_deleteme' need more concentrated stock
      --16664; -- 'test' no matching ph 
      --16111; -- 'RandomC_3' no valid stock, no matching ph  
      --16105; -- no valid stock available
      --20097; -- 'Rand_test_250510' overflow
      --15940; -- 'c3_1'
      --16604;
      --19520; --22363; --5697; 
      vFlatten := True;
      
      start_time := dbms_utility.get_time;
      item_time_tot := 0;

      dbms_output.put_line('calling GetWaterRecipeItem: '||pDesignId );
      GetWaterItem(vWaterRecipeItem, vWaterChemId);
      vBufferGroupId := GETCHEMGROUPID('Buffer');
      vFundMixGroupId := GETCHEMGROUPID('Fundamental Mixtures');
      vRecipeColl := recipe_coll();
      
      --not used as ADO.NET doesn't support arrays
      --recipe_array := well_recipe_array();
      
      dbms_output.put_line('calling GetDesignRecipeData: ' || pDesignId );
      GetDesignRecipeData(pDesignId, vFlatten, vDesignCur);
      vDesignFound := false;
      
      LOOP
        FETCH vDesignCur INTO vGroupName, vConc, vUnits, vPh, vChemicalName,
              vWellNumber, vDropNumber, vItemId, vSolutionId,
              vName, vBaseConc, vBaseUnits, vChemicalId, vDefStockUnits, vDefStockConc,
              vDefStock, vMaxStockConc, vVolume, vStockId, vLotId, vBaseContType, vSrcItemId;
        EXIT WHEN vDesignCur%NOTFOUND;
        
        vDesignFound := true;
        vRecipeColl.EXTEND;
        vRecipeColl(vRecipeColl.LAST).item_id := vItemId;
        vRecipeColl(vRecipeColl.LAST).src_item_id := vSrcItemId;
        vRecipeColl(vRecipeColl.LAST).item_conc := vConc;
        vRecipeColl(vRecipeColl.LAST).item_units := vUnits;
        vRecipeColl(vRecipeColl.LAST).item_ph := vPh;
        vRecipeColl(vRecipeColl.LAST).item_name := vChemicalName;
        vRecipeColl(vRecipeColl.LAST).target_conc := vConc;
        vRecipeColl(vRecipeColl.LAST).target_units := vUnits;
        vRecipeColl(vRecipeColl.LAST).target_ph := vPh;
        vRecipeColl(vRecipeColl.LAST).target_name := vChemicalName;
        vRecipeColl(vRecipeColl.LAST).target_type := vBaseContType;
        vRecipeColl(vRecipeColl.LAST).well_number := vWellNumber;
        vRecipeColl(vRecipeColl.LAST).solution_id := vSolutionId;
        vRecipeColl(vRecipeColl.LAST).chemical_id := vChemicalId;
        vRecipeColl(vRecipeColl.LAST).chem_class := vGroupName;
        vRecipeColl(vRecipeColl.LAST).failed_reason := null;
        vRecipeColl(vRecipeColl.LAST).overflow_flag := false;
      END LOOP;
      
      CLOSE vDesignCur;
      
      IF vDesignFound = false THEN
        dbms_output.put_line('Cannot find design');
        pErrors := 'Cannot verify design. Cannot find design data';
        pErrCnt := 1;
        RETURN;
      END IF;
      
      -- Get Design Data
      dbms_output.put_line('Calling GetDesignCur: ' || pDesignId);
      CT_MISC.GetDesignCur(pDesignId, vDesignCur);     
      dbms_output.put_line('Got design');
      
      FETCH vDesignCur INTO vReservoirDesignId, vFormatId, vFormatName, vNumRows,
            vNumCols, vNumSubs, vMaxResVol, vMaxDropVol, vDefResVol, vDefDropVol, vDesignMode,
            vDesignName, vUserName, vDesignDate, vProjectId, vProjectName, vResVol, vUsageCount,
            vComments, vCollType;
            
      IF vDesignCur%FOUND = False THEN
        dbms_output.put_line('Design Cur not found');
        pErrCnt := 1;
        pErrors := 'Cannot verify design. Cannot find design.';
        RETURN;
      END IF;
      
      -- Create recipe for each well in design
      
      FOR vWellNum IN 1..vNumRows*vNumCols
      LOOP
        dbms_output.put_line(' ');
        dbms_output.put_line('Calling GenerateItemRecipe: well ' || vWellNum ); 
        
        item_time := dbms_utility.get_time;

        vTotalVolume := GenerateItemRecipe(vRecipeColl, vWellNum, vWaterRecipeItem, vWaterChemId, vFundMixGroupId, vBufferGroupId);
        
        item_time := (dbms_utility.get_time - item_time); --/100;
        item_time_tot := item_time_tot + item_time;

        dbms_output.put_line('vTotalVolume=' || vTotalVolume || ', item_time(cs)= ' || item_time);
        
        vWellNumStr := ''; -- have we printed 'Well XX' tp report string yet?
        vErrDoneWellId := False; -- have we printed 'Well XX' to err report string yet?
        
        FOR vRecipeCnt in vRecipeColl.FIRST..vRecipeColl.LAST 
        LOOP
        --Iterate whole collection and search for the vWellNum
          IF vWellNum = vRecipeColl(vRecipeCnt).well_number THEN
            --dbms_output.put_line(' ');
            dbms_output.put_line('* ' || vRecipeColl(vRecipeCnt).item_id || ' (' || vRecipeCnt || ')');
            
            IF vWellNumStr IS NULL THEN
              vWellNumStr := vRecipeColl(vRecipeCnt).item_id;
              vTempStr := '|' || vWellNumStr || '|';
              vWellStr := vTempStr;

              IF length(pRecipe) + length(vTempStr) < 32760 THEN
                pRecipe := pRecipe || vTempStr;
              ELSE
                dbms_output.put_line('* Overflow: ' || vTempStr);
              END IF;
              dbms_output.put_line('ITEM_ID:' ||  vRecipeColl(vRecipeCnt).item_id);
            END IF;
            
            IF vErrDoneWellId = False AND vRecipeColl(vRecipeCnt).failed_reason is not null THEN
              IF LENGTH(pErrors) < 32000 THEN
                pErrors := pErrors || '|Well ' || vRecipeColl(vRecipeCnt).item_id || ':|';
                IF vRecipeColl(vRecipeCnt).overflow_flag = True THEN
                  pErrors := pErrors || ' Well Overflow. Correct by lowering concentration of one or more of these factors:|';
                END IF;
              END IF;
              vErrDoneWellId := True;
            END IF;
            
            --dbms_output.put_line('VOL_PCT: ' || vRecipeColl(vRecipeCnt).volume_pct);
            --dbms_output.put_line('STOCK_NAME: ' || vRecipeColl(vRecipeCnt).stock_name);
            --dbms_output.put_line('TARGET_NAME: ' || vRecipeColl(vRecipeCnt).target_name);
            
            IF vRecipeColl(vRecipeCnt).failed_reason is null THEN
              vTempStr := to_char(vRecipeColl(vRecipeCnt).volume_pct*10,'FM9999.9') || ' ul: ' || vRecipeColl(vRecipeCnt).stock_name || '|';
              vWellStr := vWellStr || vTempStr;
              IF length(pRecipe) + length(vTempStr) < 32760 THEN
                pRecipe := pRecipe || vTempStr;
              ELSE
                dbms_output.put_line('* Overflow: ' || vTempStr);
                pErrCnt := pErrCnt + 1;
                pErrors := pErrors || '* Overflow well ' || vWellNum || ' : ' || vTempStr || '|';
              END IF;
            ELSE
              pErrCnt := pErrCnt + 1;
              IF length(pErrors) < 32000 THEN
                IF  vRecipeColl(vRecipeCnt).overflow_flag = True THEN
                  pErrors := pErrors || '  ' || vRecipeColl(vRecipeCnt).failed_reason || '|';
                ELSE
                  pErrors := pErrors || vRecipeColl(vRecipeCnt).failed_reason || '|';
                END IF;
              END IF;
              dbms_output.put_line('FAILED_REASON: ' || vRecipeColl(vRecipeCnt).failed_reason);
            END IF;
            
          END IF;
        END LOOP; -- vRecipeCnt
        
        --recipe_array.extend;
        --recipe_array(vWellNum) := vWellStr;
        
      END LOOP; -- vWellNum

      --Debug output
      --FOR vWellNum IN 1..vNumRows*vNumCols
      --LOOP
      --  dbms_output.put_line(vWellNum || ': ' || recipe_array(vWellNum));
      --END LOOP; -- vWellNum

      dbms_output.put_line(' ~ ');
      dbms_output.put_line(' ~ ');
      dbms_output.put_line(' ~length = ' || length(pRecipe));
      dbms_output.put_line(' ~Errors ' || pErrors);
      dbms_output.put_line('Total time: ' || (dbms_utility.get_time - start_time)/100 || ' seconds');
      dbms_output.put_line('Item Total time: ' || item_time_tot || ' cs');

    END GetRecipeforScreen;
    
   
    
PROCEDURE GetRecipeForWell(pRowCol IN containers.name%type, pRowColSub containers.name%type, pBarcode IN plates.barcode%TYPE, pReport IN OUT VARCHAR2)
    IS
     vBufferGroupId  chem_groups.group_id%TYPE;
     vFundMixGroupId chem_groups.group_id%TYPE;
     vWaterRecipeItem ITEM_TYPE;
     vtotalVolume CONTAINERS.VOL%TYPE;
     vDesignCur  refCursor;
     vRecipeColl recipe_coll;
     vFlatten BOOLEAN;
      vGroupName VARCHAR2(32);
      vConc NUMBER;
      vUnits VARCHAR2(16);
      vPh NUMBER(4,2);
      vChemicalName VARCHAR2(128);
      vWellNumber NUMBER(38);
      vWellNum INTEGER;
      vDropNumber NUMBER(38);
      
      vItemId VARCHAR2(128);
      vSolutionId NUMBER(38);
      vName VARCHAR2(128);
      vBaseConc NUMBER;
      vBaseUnits VARCHAR2(16);
      vChemicalId NUMBER(38);
      vDefStockUnits VARCHAR2(7);
      vDefStockConc NUMBER(10,4);
      vDefStock VARCHAR2(128);
      vMaxStockConc NUMBER(10,2);
      vVolume NUMBER(22,12);
      vStockId NUMBER(38);
      vLotId NUMBER(38);
      vBaseContType VARCHAR2(32);
      vSrcItemId VARCHAR2(32);
      
      vDesignFound BOOLEAN;
      
      vReservoirDesignId reservoir_designs.reservoir_design_id%TYPE;
      vFormatId  reservoir_designs.format_id%TYPE;
      vFormatName plate_formats.name%TYPE;
      vNumRows plate_formats.nrows%TYPE;
      vNumCols plate_formats.ncols%TYPE;
      vNumSubs plate_formats.nsubs%TYPE;
      vMaxResVol plate_formats.max_res_vol%TYPE;
      vMaxDropVol plate_formats.max_drop_vol%TYPE;
      vDefResVol plate_formats.def_res_vol%TYPE;
      vDefDropVol plate_formats.def_drop_vol%TYPE;
      vDesignMode reservoir_designs.design_mode%TYPE;
      vDesignName reservoir_designs.design_name%TYPE;
      vUserName reservoir_designs.username%TYPE;
      vDesignDate reservoir_designs.design_date%TYPE;
      vProjectId reservoir_designs.project_id%TYPE;
      vProjectName projects.name%TYPE;
      vResVol reservoir_designs.res_vol%TYPE;
      vUsageCount reservoir_designs.usage_count%TYPE;
      vComments reservoir_designs.comments%TYPE;
      vCollType coll_types.coll_type%TYPE;
      vWaterChemId chemicals.chemical_id%TYPE;
      vPlateFormatId plates.format_id%TYPE;
      vDesignId reservoir_designs.reservoir_design_id%type;
      vDropNum INTEGER;
    BEGIN
      DBMS_OUTPUT.ENABLE(1000000); 
      vFlatten := True;
      GetWaterItem(vWaterRecipeItem, vWaterChemId);
      vBufferGroupId := GETCHEMGROUPID('Buffer');
      vFundMixGroupId := GETCHEMGROUPID('Fundamental Mixtures');
      vRecipeColl := recipe_coll();
      
      pReport := '';
      
      select res_design_id, format_id into vDesignId, vPlateFormatId
      from plates
      where barcode = pBarcode;
      
      ItemNumFromId(pRowColSub,vPlateFormatId,vWellNum,vDropNum);
      
      dbms_output.put_line('calling GetDesignRecipeData');
      GetDesignRecipeData(vDesignId, vFlatten, vDesignCur);
      vDesignFound := false;
      LOOP
        FETCH vDesignCur INTO vGroupName, vConc, vUnits, vPh, vChemicalName,
              vWellNumber, vDropNumber, vItemId, vSolutionId,
              vName, vBaseConc, vBaseUnits, vChemicalId, vDefStockUnits, vDefStockConc,
              vDefStock, vMaxStockConc, vVolume, vStockId, vLotId, vBaseContType, vSrcItemId;
        EXIT WHEN vDesignCur%NOTFOUND;
        IF vWellNumber = vWellNum THEN
          vDesignFound := true;
          vRecipeColl.EXTEND;
          /* NB: Item Id is modified in original CT code */
          vRecipeColl(vRecipeColl.LAST).item_id := vItemId;
          vRecipeColl(vRecipeColl.LAST).src_item_id := vSrcItemId;
          vRecipeColl(vRecipeColl.LAST).item_conc := vConc;
          vRecipeColl(vRecipeColl.LAST).item_units := vUnits;
          vRecipeColl(vRecipeColl.LAST).item_ph := vPh;
          vRecipeColl(vRecipeColl.LAST).item_name := vChemicalName;
          vRecipeColl(vRecipeColl.LAST).target_conc := vConc;
          vRecipeColl(vRecipeColl.LAST).target_units := vUnits;
          vRecipeColl(vRecipeColl.LAST).target_ph := vPh;
          vRecipeColl(vRecipeColl.LAST).target_name := vChemicalName;
          vRecipeColl(vRecipeColl.LAST).target_type := vBaseContType;
          vRecipeColl(vRecipeColl.LAST).well_number := vWellNumber;
          vRecipeColl(vRecipeColl.LAST).solution_id := vSolutionId;
          vRecipeColl(vRecipeColl.LAST).chemical_id := vChemicalId;
          vRecipeColl(vRecipeColl.LAST).chem_class := vGroupName;
          vRecipeColl(vRecipeColl.LAST).failed_reason := null;
          vRecipeColl(vRecipeColl.LAST).overflow_flag := false;
        END IF;
      END LOOP;
      CLOSE vDesignCur;
      IF vDesignFound = false THEN
        dbms_output.put_line('Cannot find design');
        RETURN;
      END IF;
      
      -- Get Design Data
      dbms_output.put_line('Calling GetDesignCur');
      CT_MISC.GetDesignCur(vDesignId, vDesignCur);
      
      dbms_output.put_line('Got design');
      FETCH vDesignCur INTO vReservoirDesignId, vFormatId, vFormatName, vNumRows,
            vNumCols, vNumSubs, vMaxResVol, vMaxDropVol, vDefResVol, vDefDropVol, vDesignMode,
            vDesignName, vUserName, vDesignDate, vProjectId, vProjectName, vResVol, vUsageCount,
            vComments, vCollType;
      IF vDesignCur%FOUND = True THEN
        -- Create recipe for each well in design
          dbms_output.put_line(' ');
          dbms_output.put_line('Calling GenerateItemRecipe:' || vWellNum);
          vTotalVolume := GenerateItemRecipe(vRecipeColl, vWellNum, vWaterRecipeItem, vWaterChemId, vFundMixGroupId, vBufferGroupId);
          dbms_output.put_line('vTotalVolume=' || vTotalVolume);
          FOR vRecipeCnt in vRecipeColl.FIRST..vRecipeColl.LAST
          LOOP
              dbms_output.put_line(' ');
              dbms_output.put_line('ITEM_ID:' ||  vRecipeColl(vRecipeCnt).item_id);
              dbms_output.put_line('VOL_PCT: ' || vRecipeColl(vRecipeCnt).volume_pct);
              dbms_output.put_line('STOCK_NAME: ' || vRecipeColl(vRecipeCnt).stock_name);
              dbms_output.put_line('TARGET_NAME: ' || vRecipeColl(vRecipeCnt).target_name);
              
              --pReport := pReport || '<br/>';
              --pReport := pReport || 'WELL:' ||  vRecipeColl(vRecipeCnt).item_id || '<br/>';
              --pReport := pReport || 'CHEMICAL: ' || vRecipeColl(vRecipeCnt).target_name || '<br/>';
              pReport := pReport || to_char(vRecipeColl(vRecipeCnt).volume_pct*10,'9999.9') || ' ul of  ' || vRecipeColl(vRecipeCnt).stock_name || '<br/>';
              --pReport := pReport || 'STOCK: ' ||  || '<br/>';
              --pReport := pReport || 'STOCK PH: ' || vRecipeColl(vRecipeCnt).stock_ph || '<br/>';
              --pReport := pReport || 'STOCK CONC: ' || vRecipeColl(vRecipeCnt).stock_conc || '<br/>';
              
              
              IF vRecipeColl(vRecipeCnt).failed_reason is not null THEN
                IF vRecipeColl(vRecipeCnt).overflow_flag = true THEN
                  dbms_output.put_line('FAILED_REASON: Well overflow. ' || vRecipeColl(vRecipeCnt).failed_reason);
                  pReport := pReport || 'FAILED_REASON: Well overflow. ' || vRecipeColl(vRecipeCnt).failed_reason || '<br/>';
                ELSE
                  dbms_output.put_line('FAILED_REASON: ' || vRecipeColl(vRecipeCnt).failed_reason);
                  pReport := pReport || 'FAILED_REASON: ' || vRecipeColl(vRecipeCnt).failed_reason || '<br/>';
                END IF;
              END IF;
          END LOOP;
      ELSE
        dbms_output.put_line('Design Cur not found');
      END IF;
    END GetRecipeForWell;
    

END CT_RECIPE;