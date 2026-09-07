# Validació d’importacions

La mateixa validació s’aplica a JSON importats, fitxers enllaçats, restauracions i dades del navegador. Es valida abans de normalitzar, copiar, instal·lar o desar l’estat entrant. Un error no substitueix l’estat actual ni modifica el fitxer d’origen. Un error d’importació es mostra separat de l’estat de desat.

## Errors que bloquegen

- Tipus incorrectes, registres nuls, camps identificadors obligatoris absents i duplicats dins de les llistes d’entitats.
- Notes no numèriques, números no finits, pesos negatius, màxims zero, puntuacions superiors al màxim i notes competencials superiors a 4.
- Dates impossibles, dates inicials posteriors a les finals i llindars d’avaluació desordenats.
- Cicles entre grups mare, criteris vinculats a una assignatura aliena i catàlegs amb identificadors incoherents.
- Claus reservades que poden interferir amb els objectes JavaScript, fitxers de més de 20 MiB o estructures amb més de 60 nivells / un milió de camps.

Els errors indiquen el camí del camp (llistes numerades des d’1). No s’inclou el valor del PSI ni el contingut de comentaris als missatges.

## Avisos que exigeixen confirmació en importar

Les referències històriques a assignatures, alumnes, franges o criteris eliminats es conserven i s’adverteixen, en lloc d’esborrar-les. També s’avisa d’activitats sense termini, pesos d’ítems que no sumen 100 %, matrícules que cal reconstruir i identitats ambigües. Les identitats ambigües continuen cap al procés de revisió existent; no es fusionen automàticament.

En carregar la còpia del navegador, els avisos es mostren sense exigir una confirmació repetida a cada inici. Els errors estructurals sí que bloquegen l’edició i permeten recuperar o descarregar l’original.

## Compatibilitat i cost

Es conserven els camps addicionals desconeguts que no contenen claus reservades. Els camps opcionals antics reben valors neutres (llistes i comentaris buits, assistència pendent). Les col·leccions absents de competències, criteris, activitats, sessions i plànols no s’omplen amb dades d’exemple. Els paràmetres de calendari absents mantenen els valors de configuració inicial compatibles amb versions anteriors.

No s’afegeixen dependències. Els índexs de referències es construeixen una vegada per validació; el conjunt de dades no es torna a validar mentre s’escriuen notes o comentaris. Es mostren com a màxim 100 incidències, amb prioritat per als errors.

La validació comprova estructura i coherència tècnica. No pot determinar si una nota realment correspon a l’alumne correcte ni recuperar dades ja sobreescrites.
