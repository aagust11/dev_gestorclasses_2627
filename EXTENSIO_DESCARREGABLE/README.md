# Àula · Extensió descarregable

Versió 1.1.3. Chrome 116 o posterior, Manifest V3. Inclou popup, panell lateral, cerca d’alumnes, assistència, anotacions i accés al diari.

## Instal·lació

1. Descarrega el ZIP de https://aagust11.github.io/dev_gestorclasses_2627/EXTENSIO_DESCARREGABLE/ i descomprimeix-lo.
2. Obre `chrome://extensions`, activa **Mode de desenvolupador**, selecciona **Carrega una extensió desempaquetada** i tria la carpeta que conté `manifest.json`.
3. Fixa Àula a la barra. Obre l’aplicació en el mateix perfil de Chrome i revisa/enllaça el JSON si cal.
4. Fes clic a la icona i a **Passar llista**. També tens **Incidència ràpida**, el menú contextual i `Alt+Shift+A`.

No s’instal·la automàticament des d’una web. La política d’un equip gestionat pot impedir extensions desempaquetades.

## Funcionament i desat

- Utilitza els IDs, alumnes, horari, sessions i cua de desat de l’Àula oberta. L’extensió no crea una base de dades ni escriu directament al JSON/localStorage.
- No cal tenir Àula oberta ni anar-hi per passar llista. Si està tancada, una acció explícita obre una pestanya auxiliar en segon pla; es manté mentre fas servir el panell i es tanca en sortir-ne, després de confirmar un estat desat segur. Si hi ha errors o el fitxer queda pendent, es conserva perquè puguis resoldre’ls.
- **Desat** apareix després d’acabar la cua. Si només s’ha desat al navegador, s’indica **fitxer pendent de sincronitzar**. Això no confirma que OneDrive hagi acabat de pujar-lo al núvol.
- El fitxer és el ja enllaçat en aquell perfil. Amb el panell actiu es comprova periòdicament també en segon pla, i les escriptures continuen coordinades amb les altres pestanyes. L’extensió no pot concedir permisos d’escriptura: si falten, prem **Obrir Àula** i resol-ho a l’aplicació.
- Canviar d’ordinador requereix configurar Àula i enllaçar-hi el fitxer sincronitzat. No hi ha sincronització pròpia de l’extensió.
- Assistència sense registre = pendent. «Tots presents» no sobreescriu faltes o retards. Les dues hores consecutives comparteixen registre. Les sessions contradictòries es revisen a Àula.
- Selecciona una altra data/sessió per afegir anotacions després de classe. Les anotacions es desen només prement **Desar anotació**; el text sense enviar és temporal.
- Davant d’una resposta interrompuda no es repeteix automàticament la mutació: comprova primer el resultat a Àula per evitar duplicats.

## Privacitat i permisos

Només transporta el context horari i els noms, assistència i anotacions de la sessió seleccionada. No envia PSI, mesures de suport, comentaris privats ni l’AppState complet. Cap servidor extern rep dades.

Permisos: `sidePanel`, `contextMenus` i el domini `https://aagust11.github.io/`. Chrome atorga permisos de host per origen; el content script i l’encaminament es restringeixen a `/dev_gestorclasses_2627/`. No demana `storage`, `tabs`, `all_urls`, ni llegeix el contingut de les altres pàgines.

## Actualització i desenvolupament

Substitueix els fitxers i prem **Torna a carregar** a `chrome://extensions`; actualitza també la pestanya Àula. Protocol 1. Les versions incompatibles produeixen un avís.

`npm run lint`, `npm test`, `npm run build`. La compilació empaqueta aquesta carpeta a `dist/EXTENSIO_DESCARREGABLE/aula-extensio.zip` mitjançant Python 3, sense dependències addicionals. Les icones PNG deriven del favicon propi d’Àula.

API oficial del panell: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

La llista s’ordena alfabèticament pel nom mostrat, respectant els accents i el nom preferit. En actualitzar des de la versió 1.0.0 cal reemplaçar la carpeta, prémer «Torna a carregar» a Chrome i actualitzar qualsevol pestanya antiga d’Àula.

La consulta mostra les dades ja carregades al navegador mentre es comprova el fitxer en segon pla, amb un avís durant la sincronització. Les modificacions mantenen la cua de desat i la comprovació del fitxer. «Obrir Àula» activa la web immediatament, sense esperar aquesta cua.
