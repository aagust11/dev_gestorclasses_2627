# Desat, recuperació i identitat dels alumnes

## Desat

La barra superior indica Desant, Desat o Error i identifica el destí: navegador o navegador i fitxer. Desat només s'indica si s'han confirmat tots els destins actius de la darrera versió. Un error conserva els canvis en memòria, mostra el motiu i permet tornar a desar o descarregar el JSON actual.

Les escriptures al fitxer es serialitzen i cada petició captura les dades en el moment d'encuar-les. Una escriptura fallida no bloqueja les següents. En tancar una pestanya amb desat pendent o error, se sol·licita l'avís de sortida del navegador.

En tornar a obrir, es conserva la còpia del navegador. Un fitxer recordat no la substitueix automàticament: es pot carregar el fitxer o enllaçar-lo conservant les dades actuals.

Recuperació permet descarregar i restaurar les tres darreres còpies prèvies a substitucions, imports, migracions i canvis de matrícules. Abans de restaurar també es copia la versió actual. Si no hi ha espai per fer la còpia, l'operació es bloqueja. Les còpies locals no substitueixen els JSON descarregats fora del navegador. Es pot editar en diverses pestanyes del mateix navegador i perfil: els desats es coordinen i els conflictes exigeixen resolució. No hi ha sincronització entre dispositius o navegadors diferents. Vegeu `pestanyes-i-avisos.md`.

## Identitats

Les persones noves reben UUID. El catàleg `studentRegistry` conserva la identitat encara que es retiri una matrícula; `enrolments` relaciona les identitats amb les assignatures. `subjects[].students` es conserva com a projecció compatible amb les vistes i els fitxers anteriors.

En qualsevol alta, l'usuari tria expressament una persona existent o una nova. Una assignació a diverses assignatures reutilitza les mateixes identitats seleccionades. No es deduplica ni fusiona per nom.

La migració conserva els identificadors antics que no tenen conflictes detectables. Si un mateix ID té noms diferents o està repetit dins d'una assignatura, es bloqueja l'accés a les fitxes fins a revisar les files. L'usuari decideix quines files són de la mateixa persona i, si hi havia dades compartides dins d'una assignatura, qui n'és el destinatari. Es remapen activitats, sessions, notes de període, comentaris i seients.

El PSI i la informació personal d'un ID ambigu es poden assignar explícitament o conservar sense atribució a `identityArchive` dins del JSON. No s'envien automàticament a totes les persones afectades. Les dades sobreescrites abans d'aquesta versió no es poden reconstruir sense una còpia anterior. Tampoc es pot distingir automàticament dues persones homònimes que ja compartien el mateix ID: cal revisar-ne la identitat amb informació externa.

A Alumnat, «Unificar dues fitxes» permet reunir dues identitats després de confirmar que són la mateixa persona. Es bloqueja si la fusió sobreescriuria registres existents o informació personal incompatible. Es conserva una còpia abans d'aplicar-la.
