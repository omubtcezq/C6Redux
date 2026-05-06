import anyio
from fastapi import FastAPI, APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse

app = FastAPI()


async def fake_video_streamer():
    for i in range(10):
        yield b"some fake video bytes"
        await anyio.sleep(0)


router = APIRouter(
    prefix="/report",
    tags=["Hit Report"]
)


import subprocess
import tempfile
import subprocess
import tempfile
import os
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from jinja2 import Environment, FileSystemLoader


@router.get("/hitReport")
async def main():
    env = Environment(loader = FileSystemLoader(r'.\templates'))
    template = env.get_template(r'hit_report.jinja')
    output = template.render(comment = "comment", 
        screens = [{"name": "Screen Name", "wells":[{"name": "Well Name", "factors":[{"concentration":"wow", "unit":"epic", "name": "cool"}]}]}],
        chemistry = [{"class": "c", "avgConc": 2, "concRange": "2-4", "units": "yerp", "name": "thats it", "count": "counted"}]
    )


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
        background=BackgroundTask(lambda: delete_temp_files(latex_temp_name=latex_temp_name, pdf_temp_name=pdf_temp_name))
        )

def delete_temp_files(latex_temp_name, pdf_temp_name):
    os.remove(r".\document_generation" + "\\" + latex_temp_name + ".tex")
    os.remove(r".\document_generation" + "\\" + pdf_temp_name + ".pdf")
    os.remove(r".\document_generation" + "\\" + pdf_temp_name + ".aux")
    os.remove(r".\document_generation" + "\\" + pdf_temp_name + ".log")