"""Extract verified card rectangles from the public Korean starter PDF.
No card text/art is redrawn. Requires Poppler and the downloaded source PDF.
"""
from pathlib import Path
import subprocess
from pypdf import PdfReader
pdf = Path('tmp/pdfs/korean-dwarves.pdf')
out = Path('public/images/ko')
out.mkdir(parents=True, exist_ok=True)
pages = PdfReader(pdf).pages
mapping = {
 1: ['02116','131004','03002','01061',None,'131003','17143'],
 2: ['04035','131009','01059','03011','12066','06141','01073','132006','04102'],
 3: ['131011','04109','132018','04061','03003','131013','131014','06143','04030'],
 4: ['04129','03004','131007','131006','03009','16004','17007'],
}
for page, codes in mapping.items():
 width, height = float(pages[page-1].mediabox.width)*220/72, float(pages[page-1].mediabox.height)*220/72
 for i, code in enumerate(codes):
  if not code: continue
  col,row=i%3,i//3
  x1=[15,359,703][col]; x2=[359,703,1047][col]
  y1=([15,508,1000] if page==4 else [22,508,1000])[row]
  y2=[507,999,1493][row]
  args=['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-r','220','-x',str(round(x1/1065*width)),'-y',str(round(y1/1500*height)),'-W',str(round((x2-x1)/1065*width)),'-H',str(round((y2-y1)/1500*height)),'-jpeg','-jpegopt','quality=90',str(pdf),str(out/code)]
  subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
  print(code)
