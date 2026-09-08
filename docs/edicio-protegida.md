# Edició protegida

## Canvis que es poden tornar a obrir

Abans d’acceptar una actualització dels formularis, s’apliquen les regles d’importació. Si el nou màxim d’un criteri és inferior a una nota existent, es rebutja l’actualització i l’editor d’activitats conserva l’esborrany. No es retalla ni es prorrateja la nota silenciosament. Les dates incompatibles, cicles i altres errors també es rebutgen abans de substituir l’estat. El missatge identifica el camp i manté les dades anteriors.

## Notes de període

La identitat d’un registre és la combinació assignatura + període + mètode. El seu ID textual ja no determina si es troba o s’ignora. Es conserven IDs externs i notes manuals. Un registre antic sense mètode es considera mitjana, excepte quan el seu ID antic exacte indica mediana o moda. Dues entrades per a la mateixa combinació es rebutgen perquè es revisin, sense escollir-ne una arbitràriament. Una edició substitueix la combinació existent, independentment del seu ID.

## Una única pestanya editora

Un Web Lock exclusiu permet una sola pestanya editora per origen del navegador. Les altres queden en consulta. Per canviar de pestanya editora, cal tancar l’anterior i recarregar la nova: es carrega la versió vigent abans de tornar a editar. No es força l’expulsió d’una pestanya mentre desa. Si Web Locks no està disponible, es manté el mode consulta.

Abans de desar es compara la còpia local actual amb la versió que coneix aquesta pestanya. Això també detecta canvis fets per versions antigues que no utilitzen el bloqueig. Si són diferents, es bloqueja el desat, s’ofereix descarregar l’estat en memòria i es demana recarregar. La cua del fitxer torna a comprovar el permís i la versió abans d’escriure i abans de confirmar.

L’abast és el mateix origen, navegador i perfil. No sincronitza dispositius, perfils o navegadors diferents, ni coordina un editor extern que escrigui directament al JSON. Cal continuar evitant editar simultàniament el mateix fitxer des d’aquests entorns.

Les proves automatitzades simulen exclusió, alliberament, peticions cancel·lades, versions antigues i errors durant l’escriptura. Les notes manuals es proven amb el recorregut desar → llegir → calcular, en els tres mètodes.
