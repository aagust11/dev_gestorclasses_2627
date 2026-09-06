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
