# SEKMEN ☀️

Visualiseur de fichiers IFC avec chatbot énergie, 100% dans le navigateur.

- 🌤️ Scène 3D avec soleil et nuages en mouvement
- 📂 Glisser-déposer un fichier IFC
- 💬 Chatbot qui répond aux questions (surface, nombre de CTA, étages, matériaux…)
- 📏 Mesure entre 2 points (mètres + centimètres)
- 🆓 Gratuit, hors-ligne, partageable via une simple URL

---

## 🚀 Démarrer en local (première fois)

> Tu as besoin de **Node.js** (déjà installé chez toi). Vérifie avec :
> ```
> node --version
> ```

1. Ouvre un terminal dans le dossier `SEKMEN`.
2. Installe les dépendances (seulement la première fois) :
   ```
   npm install
   ```
3. Lance le site :
   ```
   npm run dev
   ```
4. Ton navigateur s'ouvre sur `http://localhost:5173`. Glisse un fichier IFC dessus.

---

## 📤 Partager avec quelqu'un (GitHub Pages, gratuit)

### 1 — Mets le projet sur GitHub

Dans le dossier `SEKMEN`, ouvre un terminal :
```
git init
git add .
git commit -m "Premier commit SEKMEN"
```

Ensuite crée un nouveau dépôt vide sur github.com (appelle-le par exemple **SEKMEN**, public), puis lie-le :
```
git remote add origin https://github.com/TON-PSEUDO/SEKMEN.git
git branch -M main
git push -u origin main
```

### 2 — Active GitHub Pages

- Sur la page GitHub du dépôt : **Settings → Pages**
- Source : **Deploy from a branch**, dossier `/ (root)` sur la branche `gh-pages`

### 3 — Publie la version construite

```
npm run build
npm run deploy
```

GitHub Pages publie ton site. L'URL sera du style :
```
https://TON-PSEUDO.github.io/SEKMEN/
```

Envoie cette URL à qui tu veux — la personne n'a **rien à installer**, juste un navigateur.

---

## 🗂️ Organisation du projet

```
SEKMEN/
├── index.html            # page HTML principale
├── package.json          # dépendances + scripts npm
├── vite.config.js        # configuration du bundler
├── public/               # fichiers servis tels quels
└── src/
    ├── main.js           # point d'entrée — branche tout
    ├── scene.js          # scène Three.js (soleil, nuages, sol)
    ├── ifc-loader.js     # chargement d'un fichier IFC
    ├── ifc-query.js      # fonctions d'extraction (surfaces, CTA, etc.)
    ├── measure.js        # outil de mesure 2 points
    ├── chatbot.js        # chatbot par mots-clés
    └── style.css         # styles
```

---

## 💬 Questions comprises par le chatbot

Tape ta question en français, des boutons au-dessus du champ proposent les plus courantes.

| Thème | Exemples de questions |
|---|---|
| Dimensions | surface du bâtiment · emprise au sol · dimensions · hauteur · volume |
| Étages & pièces | nombre d'étages · liste des étages · nombre de pièces |
| Structure | combien de murs · combien de dalles · combien de portes · fenêtres · poutres · poteaux · escaliers |
| Équipements CVC | combien de CTA · radiateurs · chaudières · pompes · ventilateurs · groupes froids · capteurs |
| Matériaux | liste des matériaux · composition |
| Synthèse | résumé · récap · aide |

---

## 📏 Mesurer une distance

1. Charge un fichier IFC.
2. Clique **📏 Mesurer** (ou appuie sur `M`).
3. Clique un **point A** sur le modèle → un repère vert apparaît.
4. Clique un **point B** → la distance s'affiche en **mètres et centimètres**.
5. Un nouveau clic recommence une mesure.

---

## 🛠️ Commandes npm disponibles

| Commande | Rôle |
|---|---|
| `npm install` | Installer les dépendances (une fois) |
| `npm run dev` | Lancer le site en local pendant le développement |
| `npm run build` | Construire la version publique (dossier `dist/`) |
| `npm run preview` | Prévisualiser la version construite |
| `npm run deploy` | Publier sur GitHub Pages (après `npm run build`) |

---

## ❓ Problèmes fréquents

**Le fichier IFC ne s'affiche pas ?**
- Essaie un fichier plus petit (< 100 Mo).
- Ouvre la console (F12) pour voir l'erreur et me l'envoyer.

**Le chatbot dit « aucun fichier chargé » alors qu'un modèle est visible ?**
- Le fichier a bien été chargé mais les propriétés spécifiques (surface des pièces, etc.) peuvent varier selon le logiciel qui a exporté l'IFC.

**Les CTA ne sont pas détectées ?**
- Selon le logiciel d'origine, les CTA peuvent être exportées comme `IfcUnitaryEquipment`, `IfcAirTerminalBox`, ou simplement comme `IfcBuildingElementProxy`. Dans ce dernier cas, le chatbot ne peut pas les distinguer automatiquement.

---

## 📝 Licence

Projet personnel. Libre d'utilisation.
