# Edició en múltiples pestanyes i gestió d’avisos

## Desats compartits

Les pestanyes del mateix origen, navegador i perfil poden editar. El bloqueig exclusiu dura només una transacció de desat; no dura tota la sessió. Cada canvi conserva la versió de partida i es combina amb la darrera versió compartida sota el bloqueig. Després es valida i es desa. L’escriptura al fitxer enllaçat, si està activada, també es fa sota el mateix bloqueig.

Els canvis en camps diferents es combinen. Si les dues pestanyes canvien el mateix camp a valors diferents, es conserva el pendent local en memòria i es demana resoldre’l. Els editors d’activitats, assignatures i notes manuals conserven també la versió en què es va obrir l’esborrany. Una eliminació concurrent amb una modificació es considera conflicte.

Les col·leccions d’entitats es combinen per ID. Les notes de període ho fan per assignatura, període i mètode. Les importacions i restauracions creen una generació nova: no s’hi poden incorporar silenciosament canvis pendents de l’anterior conjunt de dades.

Les pestanyes sense pendents s’actualitzen mitjançant els esdeveniments d’emmagatzematge del navegador. Quan hi ha pendents, l’actualització es combina en el següent desat. Un error atura els desats posteriors de la pestanya fins que es reintenta o es resol, i es manté l’opció de descarregar l’estat local.

## Dades i desat

Les accions de desat, fitxer i recuperació es troben a l’apartat del menú lateral. El menú indica el nombre d’avisos no revisats. La capçalera de treball no mostra les caixes persistents de desat i fitxer anterior.

- **Acceptar un avís:** desa una preferència perquè el mateix missatge no torni a destacar. Es pot consultar amb «Mostrar també els revisats». No altera les notes ni dona per resolt un error de desat.
- **Reintentar:** torna a combinar i desar els pendents, sense imposar-los als camps en conflicte.
- **Aplicar els meus canvis:** amb confirmació i còpia prèvia, escull el valor local en els camps en conflicte, mantenint els canvis remots independents. No s’aplica si s’ha substituït el conjunt de dades.
- **Descartar pendents:** amb confirmació, carrega la versió compartida. Abans es pot descarregar la versió local.
- **Oblidar l’enllaç:** deixa de recordar i escriure el fitxer des de totes les pestanyes. No esborra el fitxer ni les dades actives.
- **Renovar permís:** demana novament accés al fitxer i reintenta el desat.
- **Arxivar i eliminar còpies:** inicia la descàrrega de l’arxiu de còpies i elimina només el registre de còpies locals, útil per manca d’espai o còpies malmeses. Les dades actives es conserven.

## Abast

No hi ha sincronització entre navegadors, perfils o dispositius diferents ni amb editors externs del JSON. Web Locks continua sent necessari; si no està disponible, el sistema és de consulta. En actualitzar des de la versió amb una única pestanya editora, cal recarregar les pestanyes antigues perquè alliberin el bloqueig de sessió. Un bloqueig ocupat durant més de vuit segons dona un error amb aquesta indicació, en lloc de quedar esperant indefinidament.

La validació inclou simulacions de canvis simultanis, conflictes, reintents, canvis de generació, bloquejos i persistència dels avisos revisats, i renderització estàtica del menú i les accions.
