# ForeLLM marketing website

This folder contains the single-page landing site for ForeLLM.

- **index.html** — Main page (hero, features including Agent Fore, **Download for Windows** button, install commands, antivirus/SmartScreen notice, GitHub and support links).
- **forellm.png** — Logo used by the page.

**Windows installer (Setup.exe):** The site links to the [Setup_Installer release](https://github.com/emireln/forellm/releases/tag/Setup_Installer). To publish or update the desktop installer:

1. From repo root: `cd forellm-gui && npm run dist` (builds the NSIS installer into `forellm-gui/release-build/`).
2. Edit the existing [Setup_Installer release](https://github.com/emireln/forellm/releases/tag/Setup_Installer) (or create it with tag `Setup_Installer`) and upload the `ForeLLM Setup x.x.x.exe` file from `forellm-gui/release-build/` as an asset.
3. The **Download for Windows** and **Download Setup.exe** buttons will then point to that release. The page includes an **antivirus / SmartScreen** notice so users know they may need to choose "Run anyway" for unsigned open-source installers.

To host on GitHub Pages: in the repo **Settings → Pages**, set the source to the **`website`** folder (or to the `/docs` folder if you copy this content into `docs/`).
