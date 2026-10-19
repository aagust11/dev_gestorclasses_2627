# Recuperacions d’activitats

A Configuració → assignatura → Recuperacions es poden activar i configurar. Cada activitat pot substituir aquesta configuració des de Qualificar → Política de recuperacions.

A Qualificar, «Registrar recuperació» està disponible per a NP i NA. Es trien els criteris o aspectes concrets i s’introdueixen les evidències reals. La previsualització mostra la qualificació computable. L’original es conserva; un nou intent substitueix el resultat computable del mateix criteri, amb el mateix pes, mai no afegeix una activitat ponderada.

Per defecte s’aplica reducció només als NP després de tancar una avaluació que contingui l’activitat: AE → AN, AN → AS, AS → AS, NA → NA. Els NA es poden reavaluar sense penalització. Es pot configurar màxim AS, cap penalització, aplicar també als NA i excepcions justificades. Els canvis de política afecten intents futurs; cada intent conserva la política aplicada.

## Períodes tancats

A Qualificacions, selecciona el període i prem «Tancar avaluació». Es conserven els tres mètodes, les notes manuals, els comentaris i les activitats d’aquell moment. Una recuperació posterior afecta els períodes oberts, inclòs el primer trimestre, que incorpora la preavaluació una sola vegada. Un període tancat no es recalcula. «Reobrir per rectificar» requereix un motiu i conserva el tancament anterior a l’historial.

No es poden reconstruir automàticament qualificacions històriques que no s’hagin desat: abans de registrar recuperacions, tanca explícitament la preavaluació que vulguis conservar. La data original antiga pot quedar com a desconeguda; no s’inventa.

## Conversió numèrica

Es normalitza cada evidència sobre 4. S’utilitzen els llindars de l’assignatura vigents en registrar l’intent. En baixar un nivell, la posició relativa dins l’interval AE passa a l’interval AN; la d’AN, a AS. El límit superior queda just per sota del nivell següent. Amb màxim AS, es limita just per sota del llindar AN. AS i NA no canvien. Els decimals mostrats són arrodonits però la qualificació usa el valor precís. La moda conserva els grups de centèsimes del sistema existent i pren un valor real del grup guanyador, sense crear una nota superior per arrodoniment.

## Historial i proves vinculades

L’indicador R obre tots els intents, evidències reals i computables, dates i observacions. Per rectificar, anul·la un intent amb un motiu i registra’n un altre: l’anul·lació és traçable. «Pendent de recuperació» és independent del NP/NA.

Des del dossier → Proves de recuperació, es poden crear proves amb participants i correspondències explícites a criteris de diverses activitats. Cada resultat s’avalua a la seva correspondència, sense pes addicional ni exempcions dels no participants.

JSON conserva intents, tasques i tancaments. L’Excel d’activitats inclou un full de recuperacions. Els informes d’alumne incorporen l’historial. La validació comprova coherència de la conversió i duplicats. La sincronització conserva canvis compatibles entre alumnes i rebutja canvis obsolets que travessen un tancament; no els sobreescriu silenciosament.

NP conserva el valor zero dels criteris encara no recuperats; Exempt queda exclòs. Fet/No fet no es recupera amb aquest sistema numèric. Les evidències inicials i el lliurament amb retard no s’alteren.
