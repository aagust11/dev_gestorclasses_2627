"""Build an installable ZIP without third-party dependencies or student data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root=Path(__file__).resolve().parent.parent
source=root/'EXTENSIO_DESCARREGABLE'
target=root/'dist'/'EXTENSIO_DESCARREGABLE'
target.mkdir(parents=True,exist_ok=True)
files=sorted(p for p in source.rglob('*') if p.is_file() and not p.name.startswith('.'))
with ZipFile(target/'aula-extensio.zip','w',ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path,'EXTENSIO_DESCARREGABLE/'+path.relative_to(source).as_posix())
version=json.loads((source/'manifest.json').read_text())['version']
page=(source/'install.html').read_text().replace('href="aula-extensio.zip"',f'href="aula-extensio.zip?v={version}"').replace('<h1>',f'<p>Versió {version}</p><h1>',1)
(target/'index.html').write_text(page)
print('Extensió preparada:',target/'aula-extensio.zip')
