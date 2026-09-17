# Fet/No fet, subítems i tests

- A Activitats, «Tipus d’avaluació» permet triar «Amb nota» o «Fet / No fet». El segon és seguiment de compliment: no transforma Fet en un 10 ni No fet en un 0. Els camps antics es conserven si es canvia de tipus.
- NP continua comptant com a zero en les activitats amb nota. Exempt no entra al càlcul i es mostra en groc. Els botons d’estat conserven les notes subjacents.
- «NP / avaluades» és un recompte per alumne i període de lliurament. NP entra al numerador i al denominador; pendents i exemptes no entren al denominador. Les activitats amb diverses caselles només es consideren completament avaluades quan totes tenen nota. Fet i No fet són avaluacions explícites, diferents de NP.
- Qualificacions i fitxes mostren NP / avaluades i Fet / No fet. Els informes de grup i alumne i els Excel inclouen els recomptes i els resultats individuals de les activitats.
- Una nova matrícula des de l’aplicació marca com a exemptes les activitats que ja existien a l’assignatura, incloent-hi les futures ja creades. No modifica notes prèvies de l’alumne en una reincorporació. No s’executa en carregar o importar un JSON.
- A Configuració, cada ítem numèric admet una plantilla de subítems amb text, pes, format i màxim. Seleccionar un ítem a l’activitat copia la plantilla si encara no hi ha subítems; també es poden crear i editar directament a l’activitat. La còpia és independent per evitar canvis retroactius quan s’edita la plantilla.
- Amb subítems, la nota numèrica de l’activitat és la mitjana ponderada de les seves notes normalitzades. Els criteris curriculars vinculats tenen qualificació independent per al seguiment de competències. Sense subítems, es manté el càlcul existent a partir dels criteris o la nota global.
- El format Test està disponible en criteris curriculars, subítems i nota global numèrica. Configuració inicial: 10 preguntes, correcta +1, blanc 0 i incorrecta −0,25. Es configura el nombre de preguntes i els tres valors.
- Cal comptar totes les respostes, inclosos els blancs. Mentre en falten, els recomptes vàlids es desen però la nota queda pendent. Si se supera el total, el formulari avisa i no desa aquell recompte invàlid. El màxim és preguntes × valor de correcta; la puntuació negativa es limita a 0 abans de normalitzar-la a /4 o /10.

No hi ha migració destructiva: els camps nous són opcionals, i es validen als mateixos límits de desat i importació que la resta de dades.
