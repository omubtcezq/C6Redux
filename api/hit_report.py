from fastapi import FastAPI, APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse
import subprocess
import tempfile
import subprocess
import tempfile
import os
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from jinja2 import Environment, FileSystemLoader
from sqlmodel import Session, select, case, col, func, distinct, intersect
from typing import Annotated
import api.db as db
from sqlalchemy.orm import contains_eager
from sqlalchemy.orm import subqueryload
import api.units_and_buffers as unbs
import api.screen_maker as sm

app = FastAPI()

router = APIRouter(
    prefix="/report",
    tags=["Hit Report"]
)


@router.get("/hitReport")
async def main(*, session: Session=Depends(db.get_readonly_session), well_ids: Annotated[list[int], Query()], comment: str | None = None):
    print(os.path.dirname(os.path.abspath(__file__)))
    print("WOW")
    env = Environment(loader = FileSystemLoader(r'.\templates'))
    template = env.get_template(r'hit_report.jinja')

    statement = (
    select(db.Screen)
    .join(db.Well)
    .where(db.Well.id.in_(well_ids))
    .options(contains_eager(db.Screen.wells)
    .subqueryload(db.Well.wellcondition)
    .subqueryload(db.WellCondition.factors)
    .subqueryload(db.Factor.chemical)))

    result = session.exec(statement).unique().all()


    screens = []
    factor_dict = {}
    for screen in result:
        temp_screen = {"name": screen.name, "wells": []}
        for well in screen.wells:
            temp_well = {"name" : well.label, "factors": []}
            for factor in well.wellcondition.factors:
                if factor.chemical.name not in factor_dict:
                    factor_dict[factor.chemical.name] = []
                factor_dict[factor.chemical.name].append(factor)
                temp_factor = {"name": factor.chemical.name, "unit": factor.unit, "concentration": factor.concentration}
                if factor.ph is not None:
                    temp_factor["ph"] = factor.ph
                temp_well["factors"].append(temp_factor)
            temp_screen["wells"].append(temp_well)
        screens.append(temp_screen)
        
    print(comment)
    chemistry = {}
    for chemical_name, factor_list in factor_dict.items():
        unit = None
        concs = []
        if all([factor.unit == factor_list[0].unit for factor in factor_list]):
            unit = factor_list[0].unit
            for factor in factor_list:
                concs.append(unbs.unit_conversion(factor.concentration, factor.unit, factor.chemical.density, factor.chemical.molecular_weight, factor_list[0].unit))
        else:
            unit = "M"
            for factor in factor_list:
                concs.append(unbs.unit_conversion(factor.concentration, factor.unit, factor.chemical.density, factor.chemical.molecular_weight, "M"))
            
        chemistry[chemical_name] = {"class": "", "avgConc": round(sum(concs) / len(concs), 2), "concRange": "{}-{}".format(min(concs), max(concs)) if min(concs) != max(concs) else None, "units": unit, "name": chemical_name, "count": len(factor_list)}
        
    for factor_group in sm.make_factor_groups_from_well_ids(session=session, well_ids=well_ids):
        for factor in factor_group.factors:
            chemistry[factor.chemical.name]["class"] = factor_group.name;


    chemistry = sorted(chemistry.values(), key = lambda chemical: (chemical["class"], chemical["count"], chemical["avgConc"]), reverse = True)

    output = template.render(comment = comment, screens = screens, chemistry = chemistry)


    latex_temp_name = next(tempfile._get_candidate_names())
    with open("document_generation\\" + latex_temp_name + ".tex", "w") as f:
        f.write(output)

    pdf_temp_name = next(tempfile._get_candidate_names())
    result = subprocess.run(
    ['pdflatex', f'-jobname={pdf_temp_name}', '-interaction=nonstopmode', f"-output-directory=document_generation", r".\document_generation" + "\\" + latex_temp_name + ".tex"],
    capture_output=True  # Capture logs for error checking
    )

    return FileResponse(
        "document_generation\\" + pdf_temp_name + ".pdf",
        filename="Hit Report.pdf",
        background=BackgroundTask(lambda: delete_temp_files(latex_temp_name=latex_temp_name, pdf_temp_name=pdf_temp_name))
        )

def delete_temp_files(latex_temp_name, pdf_temp_name):
    os.remove(r".\document_generation" + "\\" + latex_temp_name + ".tex")
    os.remove(r".\document_generation" + "\\" + pdf_temp_name + ".pdf")
    os.remove(r".\document_generation" + "\\" + pdf_temp_name + ".aux")
    os.remove(r".\document_generation" + "\\" + pdf_temp_name + ".log")