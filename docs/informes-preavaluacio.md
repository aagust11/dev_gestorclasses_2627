# Perfil Docent, informes i preavaluació

Configuració → Perfil Docent / Preavaluació permet desar el nom complet i el correu de contacte. S’inclouen als Word i PDF individuals i de grup. El peu gris de cada pàgina identifica el document com a informatiu, sense atribuir-li caràcter oficial.

Rendiment i Informes permet seleccionar assignatura/grup, període i mètode, consultar la distribució i descarregar Word/PDF. Inclou total de matrícula activa, NA, percentatges AE/AN/AS/NA, pendents, notes efectives (amb comparació calculada si són manuals), faltes, retards, comentaris i evolució de grup i individual.

El denominador dels percentatges és tota la matrícula activa actual. Una nota pendent no és un NA. La comparació temporal usa aquest mateix alumnat actual; no reconstrueix una matrícula històrica. La nota anual segueix els càlculs i ajustos manuals de Qualificacions.

La preavaluació és un període amb ID estable dins de `config.terms`, marcat `isPreassessment` i vinculat amb `parentTermId` al primer trimestre. Comença el mateix dia i acaba dins del trimestre. La validació de formularis i imports imposa aquestes regles. Es calcula per data de lliurament com els altres períodes i permet notes manuals i comentaris propis. El trimestre inclou les activitats de tot el seu interval una sola vegada. La proposta anual que fa la mitjana de trimestres exclou expressament la preavaluació.

Durant l’interval de preavaluació, l’horari i les sessions mostren tots dos noms. Desactivar-la retira el període seleccionable, amb confirmació, conservant notes manuals. Les còpies JSON inclouen configuració, perfil i qualificacions.

El PDF incorpora un subconjunt de DejaVu Sans per renderitzar accents i caràcters grecs sense dependre de les fonts del dispositiu. Es carrega només en generar el PDF. La llicència es conserva a `report-font-license.txt`.
