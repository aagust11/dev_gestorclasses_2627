# Integritat del JSON entre ordinadors

## Revisió i mesures implementades

El desat anterior serialitzava les escriptures i coordinava les pestanyes del mateix navegador, però no llegia el fitxer extern abans de sobreescriure'l. Això podia substituir dades arribades de l'altre ordinador per una còpia antiga del navegador.

- Lectura del fitxer a l'inici, cada 15 segons amb la pàgina visible, en recuperar el focus o la connexió i abans d'escriure. L'edició inicial espera la comprovació.
- Versió de referència persistent en IndexedDB, vinculada al fitxer concret i compartida entre pestanyes. Els enllaços antics sense una referència segura requereixen una selecció explícita si les versions difereixen.
- Comparació a tres bandes: referència, navegador i fitxer. Canvis independents es combinen; un conflicte atura el desat. Les importacions, restauracions i eliminacions que canvien la generació no es combinen amb canvis concurrents.
- Validació de totes les dades llegides i del resultat abans d'escriure. Un JSON invàlid no es repara ni se sobreescriu automàticament.
- Comparació del contingut extern abans i durant l'escriptura temporal, avortament si canvia i lectura de verificació després de tancar-la.
- Còpies locals abans d'incorporar canvis externs. Un error en crear la còpia atura l'operació. Les dades del navegador es confirmen abans d'avançar la referència, permetent reintentar una operació interrompuda.
- No es reescriu un fitxer sense canvis. A «Dades i desat» hi ha hora de comprovació, comprovació manual, descàrrega del fitxer i càrrega explícita amb confirmació.

## Límits reals

No és una transacció distribuïda. Web Locks només coordina pestanyes del mateix origen i navegador; no bloqueja un altre ordinador ni OneDrive. La comprovació abans de tancar una escriptura redueix la finestra de conflicte, però el sistema de fitxers no ofereix una operació atòmica de comparar i substituir entre dispositius. Un canvi que OneDrive encara no ha descarregat és invisible per a l'aplicació. Tampoc es detecten automàticament còpies de conflicte que OneDrive pugui crear amb un altre nom.

«Desat» confirma el navegador i el fitxer local enllaçat; no confirma la pujada al núvol. No s'ha executat una prova real amb dos ordinadors i el client OneDrive. Les proves del fitxer utilitzen una implementació simulada de FileSystemFileHandle.

Les còpies recuperables són les tres últimes d'aquest navegador. No són un arxiu independent ni es comparteixen entre ordinadors. El JSON i les dades del navegador no estan xifrats per l'aplicació: ocultar PSI a la pantalla no és un control d'accés.

## Ús entre centre i casa

1. Enllaçar el mateix JSON de la carpeta OneDrive a cada ordinador, concedint el permís del navegador quan calgui.
2. Abans de deixar un ordinador, esperar el desat de l'aplicació i comprovar que OneDrive ha acabat la sincronització.
3. A l'altre ordinador, esperar que OneDrive descarregui els canvis i obrir l'aplicació o prémer «Comprovar fitxer ara».
4. Si apareix un conflicte, descarregar les dues versions abans de decidir. No treballar simultàniament als dos equips ni editar sense connexió si també s'utilitza l'altre equip.

## Propostes pendents, prioritzades

| Prioritat | Millora | Impacte | Abast |
|---|---|---|---|
| Alta | Prova d'acceptació amb un JSON fictici als dos equips reals, incloent suspensió i renovació de permisos | Verificar el client OneDrive i els navegadors que s'utilitzaran | Requereix els dos equips |
| Alta | Còpies periòdiques independents i prova de restauració | Recuperar-se d'esborrats, errors de sincronització o pèrdua del perfil del navegador | Definir una destinació de còpia |
| Alta si cal edició simultània | Accés al núvol amb comprovació de versió al servidor i resolució de conflictes | Rebutjar escriptures sobre una versió remota antiga | Integració autenticada; no s'ha implementat |
| Alta en equips compartits | Dissenyar control d'accés i xifrat amb recuperació de claus | Protegir notes i PSI davant d'altres usuaris del dispositiu o del fitxer | No es resol amb una pantalla de contrasenya superficial |

Referència operativa: [Resolució de problemes de sincronització de OneDrive](https://support.microsoft.com/en-us/onedrive/fix-onedrive-sync-problems).
