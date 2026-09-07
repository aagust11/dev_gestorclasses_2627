# Gestor de classes · DocentSuite

Aplicació React i TypeScript exportada de Google AI Studio i adaptada a GitHub Pages.

Web: https://aagust11.github.io/dev_gestorclasses_2627/

## Publicació

Al repositori, obre **Settings → Pages → Build and deployment → Source** i selecciona **GitHub Actions**. El workflow `.github/workflows/deploy.yml` comprova TypeScript, compila i publica `dist` a cada canvi de `main`. També es pot executar manualment des d'**Actions → Deploy to GitHub Pages → Run workflow**.

La ruta base està configurada a `vite.config.ts` per a `/dev_gestorclasses_2627/`. Cal adaptar-la si es canvia el nom del repositori o es configura un domini propi.

## Desenvolupament local

Requereix Node.js 22 o superior.

```sh
npm ci
npm run dev
```

Obre l'adreça que mostra Vite. Per comprovar la versió de producció:

```sh
npm run lint
npm run build
npm run preview
```

No cal configurar Gemini, cap clau API ni cap servidor.

## Dades i còpies de seguretat

Les dades introduïdes es desen al navegador (`localStorage`), no al repositori ni a GitHub Pages. No se sincronitzen entre dispositius i es poden perdre si s'esborren les dades del navegador. Exporta còpies JSON periòdicament i importa-les per traslladar les dades des de l'aplicació d'AI Studio.

L'enllaç amb un fitxer local permet desar-hi els canvis en navegadors compatibles, com Chrome i Edge d'escriptori, amb permís de lectura i escriptura. En altres navegadors, utilitza la importació i l'exportació JSON.

## Avaluació i pantalles

- **Assignatures → Configurar** (o **Configuració → Assignatures → Configurar**) obre una pàgina dedicada amb el sistema numèric/competencial, els ítems i pesos, els valors NA/AS/AN/AE sobre 4, els llindars inclusius AS/AN/AE i el límit de CE suspeses. Les equivalències sobre 10 també es mostren.
- **Configuració → Competències** permet editar els textos breus i reordenar els criteris.
- **Activitats → Nova / Editar** obre l'editor complet; cada criteri pot tenir un text específic, un pes i un format de qualificació amb màxim numèric propi.
- **Activitats → Qualificar** obre la pantalla d'avaluació amb alumnes en files, criteris en subfiles i un comentari per alumne. Les notes es desen automàticament.
- **Qualificacions** permet triar assignatura i trimestre/curs, veure les notes de les activitats o el resum de CA, CE i ítems; les dues vistes s'exporten a Excel.
- Les sessions mostren els comentaris anteriors, actuals i següents sobre una única taula d'assistència i conducta; es mantenen els avisos de tasques en curs i d'última classe abans del lliurament.

### Regles de càlcul

La data de lliurament determina el trimestre; el curs inclou totes les activitats. Les notes numèriques d'un criteri es normalitzen sobre 4 segons el màxim configurat. Per a cada CA, el pes és el producte del pes de l'activitat i el pes del criteri. Les CE combinen els CA amb nota amb pesos iguals; la nota final combina les CE amb nota amb pesos iguals. Les assignatures numèriques combinen les activitats de cada ítem segons el seu pes, i els ítems segons els percentatges de l'assignatura.

Un zero és una nota real. Una nota buida queda pendent, no es tracta com un NA ni entra als càlculs. Els pesos disponibles es renormalitzen quan falta una nota; un pes zero exclou l'element. No s'arrodoneixen puntuacions intermèdies per decidir els llindars.

Mitjana, mediana i moda es calculen a tots els nivells respectant els pesos. La mediana ponderada fa la mitjana dels dos valors centrals quan la suma acumulada és exactament la meitat. La moda suma els pesos de puntuacions iguals (a dos decimals); en cas d'empat, tria la menor. Cada mètode té les seves notes manuals independents; els registres antics s'incorporen a la vista de mitjana.

Les notes manuals es conserven en recalcular dependències. «Recalcular columna» elimina les correccions manuals només d'aquella columna. El límit de CE suspeses força NA fins i tot amb una nota final manual; 0 desactiva el límit. «Esborrar notes del període» buida els tres mètodes sense esborrar les notes originals de les activitats; «Calcular des de les activitats» les torna a generar per al mètode seleccionat.

### Verificació

```sh
npm test
npm run lint
npm run build
```

Les proves cobreixen ponderacions, zeros i pendents, llindars, modes estadístics, correccions manuals, filtres de període, persistència i estructura dels Excel. El desplegament executa aquestes comprovacions abans de publicar.

### Criteris repetits i rúbriques

A l'editor d'activitats, selecciona un criteri i prem **Afegir**. El pots afegir diverses vegades: cada entrada conserva una nota, un pes, un format i un text propis. Els càlculs del trimestre/curs agrupen aquestes entrades dins del CA original, amb els pesos corresponents. Les exportacions mostren una columna per cada entrada.

Cada entrada permet descriure els nivells **NA, AS, AN i AE**. En avaluar, passa el cursor per cada botó per veure'n la descripció; també es mostra sobre l'equivalent qualitatiu d'una puntuació numèrica.

A **Configuració → Competències → Editar competències i criteris** es poden editar els codis i les descripcions sense canviar els identificadors interns ni perdre les notes. Els criteris també poden tenir descripcions de nivell comunes, que les activitats utilitzen mentre no les personalitzis.
