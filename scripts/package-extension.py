"""Build an installable ZIP without third-party dependencies or student data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil
root=Path(__file__).resolve().parent.parent
source=root/'EXTENSIO_DESCARREGABLE'
target=root/'dist'/'EXTENSIO_DESCARREGABLE'
target.mkdir(parents=True,exist_ok=True)
files=sorted(p for p in source.rglob('*') if p.is_file() and not p.name.startswith('.'))
with ZipFile(target/'aula-extensio.zip','w',ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path,'EXTENSIO_DESCARREGABLE/'+path.relative_to(source).as_posix())
shutil.copy(source/'install.html',target/'index.html')
print('Extensió preparada:',target/'aula-extensio.zip')
