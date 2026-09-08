# Revisió de dades desvinculades

A **Dades i desat → Revisar dades desvinculades**, cada cas identifica l’activitat, assignatura o data de sessió. «Veure i decidir» mostra el contingut conservat i l’abast exacte de l’eliminació. Si l’alumne o l’assignatura ja no existeix, es mostra l’identificador disponible, sense deduir-ne el nom.

- Un criteri inexistent es revisa per aspecte d’activitat, incloses les repeticions. Eliminar-lo retira només aquell aspecte, configuració i puntuacions; conserva els altres aspectes, comentaris i notes manuals. Els càlculs automàtics poden variar.
- Una entrada d’horari sense franja es pot eliminar conservant totes les sessions del diari. Aquestes poden quedar desvinculades i es revisen separadament.
- Una sessió sense assignatura o entrada d’horari es presenta una sola vegada. Eliminar-la retira tot el seu registre, inclosa l’assistència i els comentaris.
- Un alumne absent del catàleg i dels grups es pot eliminar només del registre de la sessió indicada, conservant la resta del diari.

No s’elimina res automàticament. Cal obrir el detall i marcar la confirmació. La transacció compartida comprova que la dada revisada segueix igual i continua desvinculada; una importació/restauració també invalida el detall antic. Es valida el resultat i es crea una còpia recuperable abans de desar cap eliminació. Si falla la còpia, les dades actives es conserven. Els canvis independents d’altres pestanyes es mantenen. Si falla el fitxer després del desat al navegador, s’indica que cal resoldre el desat pendent.

Els avisos de les dades actives es recalculen i s’agrupen per missatge per evitar la repetició de textos tècnics. Altres avisos de validació continuen visibles; aquest inspector cobreix els criteris d’activitat, les franges i les referències del diari descrites més amunt.
