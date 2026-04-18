import { formatDistance } from './measure.js';

// ---------------------------------------------------------------------------
// Simple keyword-matching chatbot (no external API, no AI, purely local).
// Matches the user sentence against intents and calls the right IfcQuery method.
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  'Surface du bâtiment',
  'Combien de CTA ?',
  'Nombre d’étages',
  'Liste des matériaux',
  'Combien de murs ?',
  'Combien de portes ?',
  'Combien de fenêtres ?',
  'Dimensions du bâtiment',
  'Résumé complet',
  'Aide',
];

// Each intent: { keywords: [regex or string], handler: async (query) => string }
function buildIntents(query) {
  return [
    {
      name: 'help',
      keywords: [/^aide$/i, /help/i, /que peux.*faire/i, /quelles questions/i, /comment/i],
      async handler() {
        return `Je peux répondre à des questions sur le fichier IFC chargé :
• <strong>Surface</strong> du bâtiment / emprise au sol
• <strong>Combien de CTA</strong>, radiateurs, chaudières, pompes, ventilateurs…
• <strong>Nombre d'étages</strong>, de murs, portes, fenêtres, pièces
• <strong>Dimensions</strong> (longueur × largeur × hauteur)
• <strong>Liste des matériaux</strong> / des étages
• <strong>Résumé</strong> complet du projet

Tu peux aussi cliquer <strong>📏 Mesurer</strong> en haut pour mesurer une distance entre 2 points sur le modèle.`;
      },
    },

    {
      name: 'summary',
      keywords: [/résumé/i, /resume/i, /récap/i, /recap/i, /vue d.ensemble/i, /tout/i],
      async handler() {
        const s = await query.getSummary();
        if (!s) return notLoaded();
        const info = await query.getProjectInfo();
        const dim = s.dims
          ? `${s.dims.x.toFixed(1)} × ${s.dims.z.toFixed(1)} × ${s.dims.y.toFixed(1)} m`
          : 'inconnues';
        return `📋 <strong>Résumé du projet</strong>
${info?.project ? `• Projet : <strong>${info.project}</strong><br>` : ''}${info?.building ? `• Bâtiment : <strong>${info.building}</strong><br>` : ''}• Dimensions : <strong>${dim}</strong>
• Emprise au sol : <strong>${s.footprint.toFixed(1)} m²</strong>
• Volume englobant : <strong>${s.volume.toFixed(0)} m³</strong>
<ul>
<li>${s.storeys} étage(s)</li>
<li>${s.spaces} pièce(s)</li>
<li>${s.walls} mur(s)</li>
<li>${s.slabs} dalle(s)</li>
<li>${s.doors} porte(s) · ${s.windows} fenêtre(s)</li>
<li>${s.cta} CTA · ${s.radiators} radiateur(s) · ${s.fans} ventilateur(s) · ${s.boilers} chaudière(s)</li>
</ul>`;
      },
    },

    {
      name: 'cta',
      keywords: [/\bcta\b/i, /centrale.*air/i, /traitement.*air/i, /air handling/i, /\bahu\b/i],
      async handler() {
        const n = await query.countCTA();
        const nat = await query.countAirTerminals();
        let msg = `🌬️ Le bâtiment contient <strong>${n} CTA</strong> (équipement unitaire CVC).`;
        if (nat > 0) {
          msg += `\nJ'ai aussi repéré ${nat} bouche(s) / diffuseur(s) d'air.`;
        }
        if (n === 0) {
          msg += `\n\n<em>Astuce : si tu penses qu'il y a des CTA, vérifie dans le modèle qu'elles sont bien exportées comme <code>IfcUnitaryEquipment</code> (pas toujours le cas selon le logiciel source).</em>`;
        }
        return msg;
      },
    },

    {
      name: 'surface',
      keywords: [/surface/i, /aire/i, /m²/i, /emprise/i, /superficie/i],
      async handler() {
        if (!query.hasModel) return notLoaded();
        const sumSpaces = await query.getTotalSpaceArea();
        const footprint = query.getFootprintArea();
        let msg = `📐 <strong>Emprise au sol</strong> (boîte englobante) : <strong>${footprint.toFixed(1)} m²</strong>.`;
        if (sumSpaces !== null) {
          msg += `\n\n🏠 <strong>Somme des surfaces des pièces</strong> (IfcSpace) : <strong>${sumSpaces.toFixed(1)} m²</strong>.`;
        } else {
          msg += `\n\n<em>Les propriétés de surface des pièces ne sont pas disponibles dans ce fichier. L'emprise au sol est donc une estimation géométrique.</em>`;
        }
        return msg;
      },
    },

    {
      name: 'volume',
      keywords: [/volume/i, /m³/i, /cubique/i],
      async handler() {
        if (!query.hasModel) return notLoaded();
        const v = query.getBoundingVolume();
        return `📦 Volume englobant (boîte) : <strong>${v.toFixed(0)} m³</strong>.
<em>C'est une estimation à partir de la boîte englobante du modèle.</em>`;
      },
    },

    {
      name: 'dimensions',
      keywords: [/dimension/i, /taille/i, /longueur/i, /largeur/i, /hauteur/i, /gabarit/i],
      async handler() {
        if (!query.hasModel) return notLoaded();
        const d = query.getDimensions();
        if (!d) return notLoaded();
        return `📏 Dimensions (boîte englobante) :
• Longueur (X) : <strong>${formatDistance(d.x)}</strong>
• Largeur (Z) : <strong>${formatDistance(d.z)}</strong>
• Hauteur (Y) : <strong>${formatDistance(d.y)}</strong>`;
      },
    },

    {
      name: 'storeys',
      keywords: [/étage/i, /etage/i, /niveau/i, /storey/i, /\bstorey\b/i],
      async handler() {
        if (!query.hasModel) return notLoaded();
        const names = await query.getStoreyNames();
        if (names.length === 0)
          return `🏢 Aucun étage détecté dans ce fichier IFC.`;
        return `🏢 Le bâtiment contient <strong>${names.length} étage(s)</strong> :
<ul>${names.map((n) => `<li>${n}</li>`).join('')}</ul>`;
      },
    },

    {
      name: 'spaces',
      keywords: [/pièce/i, /piece/i, /local/i, /locaux/i, /\bespace/i, /\bspace/i, /chambre/i, /room/i],
      async handler() {
        const n = await query.countSpaces();
        if (!query.hasModel) return notLoaded();
        return `🏠 Le bâtiment contient <strong>${n} pièce(s)</strong> (IfcSpace).`;
      },
    },

    {
      name: 'walls',
      keywords: [/\bmur/i, /paroi/i, /cloison/i, /wall/i],
      async handler() {
        const n = await query.countWalls();
        return notLoadedOr(n, `🧱 Le bâtiment contient <strong>${n} mur(s)</strong>.`);
      },
    },

    {
      name: 'slabs',
      keywords: [/\bdalle/i, /plancher/i, /\bslab/i],
      async handler() {
        const n = await query.countSlabs();
        return notLoadedOr(n, `🟫 Le bâtiment contient <strong>${n} dalle(s)</strong>.`);
      },
    },

    {
      name: 'roofs',
      keywords: [/toit/i, /toiture/i, /\broof/i],
      async handler() {
        const n = await query.countRoofs();
        return notLoadedOr(n, `🏠 Le bâtiment contient <strong>${n} toiture(s)</strong>.`);
      },
    },

    {
      name: 'doors',
      keywords: [/\bporte/i, /\bdoor/i],
      async handler() {
        const n = await query.countDoors();
        return notLoadedOr(n, `🚪 Le bâtiment contient <strong>${n} porte(s)</strong>.`);
      },
    },

    {
      name: 'windows',
      keywords: [/fenêtre/i, /fenetre/i, /vitrage/i, /baie/i, /window/i],
      async handler() {
        const n = await query.countWindows();
        return notLoadedOr(n, `🪟 Le bâtiment contient <strong>${n} fenêtre(s)</strong>.`);
      },
    },

    {
      name: 'beams',
      keywords: [/poutre/i, /\bbeam/i],
      async handler() {
        const n = await query.countBeams();
        return notLoadedOr(n, `🪵 Le bâtiment contient <strong>${n} poutre(s)</strong>.`);
      },
    },

    {
      name: 'columns',
      keywords: [/colonne/i, /poteau/i, /column/i],
      async handler() {
        const n = await query.countColumns();
        return notLoadedOr(n, `🏛️ Le bâtiment contient <strong>${n} poteau(x)</strong>.`);
      },
    },

    {
      name: 'stairs',
      keywords: [/escalier/i, /stair/i],
      async handler() {
        const n = await query.countStairs();
        return notLoadedOr(n, `🪜 Le bâtiment contient <strong>${n} escalier(s)</strong>.`);
      },
    },

    {
      name: 'radiators',
      keywords: [/radiateur/i, /chauffage/i, /space heater/i, /radiator/i],
      async handler() {
        const n = await query.countRadiators();
        return notLoadedOr(n, `🔥 Le bâtiment contient <strong>${n} radiateur(s)</strong> (IfcSpaceHeater).`);
      },
    },

    {
      name: 'fans',
      keywords: [/ventilateur/i, /\bfan\b/i, /ventilo/i],
      async handler() {
        const n = await query.countFans();
        return notLoadedOr(n, `🌀 Le bâtiment contient <strong>${n} ventilateur(s)</strong>.`);
      },
    },

    {
      name: 'pumps',
      keywords: [/pompe/i, /pump/i],
      async handler() {
        const n = await query.countPumps();
        return notLoadedOr(n, `💧 Le bâtiment contient <strong>${n} pompe(s)</strong>.`);
      },
    },

    {
      name: 'boilers',
      keywords: [/chaudière/i, /chaudiere/i, /boiler/i],
      async handler() {
        const n = await query.countBoilers();
        return notLoadedOr(n, `🔥 Le bâtiment contient <strong>${n} chaudière(s)</strong>.`);
      },
    },

    {
      name: 'chillers',
      keywords: [/refroidisseur/i, /groupe froid/i, /chiller/i, /\bclim\b/i, /climatisation/i],
      async handler() {
        const n = await query.countChillers();
        return notLoadedOr(n, `❄️ Le bâtiment contient <strong>${n} groupe(s) froid</strong>.`);
      },
    },

    {
      name: 'sensors',
      keywords: [/capteur/i, /sensor/i, /sonde/i],
      async handler() {
        const n = await query.countSensors();
        return notLoadedOr(n, `📡 Le bâtiment contient <strong>${n} capteur(s)</strong>.`);
      },
    },

    {
      name: 'materials',
      keywords: [/matériau/i, /materiau/i, /material/i, /composition/i],
      async handler() {
        if (!query.hasModel) return notLoaded();
        const mats = await query.listMaterials();
        if (mats.length === 0)
          return `🪨 Aucun matériau nommé n'a été trouvé dans ce fichier.`;
        return `🪨 <strong>${mats.length} matériau(x)</strong> trouvé(s) :
<ul>${mats.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
      },
    },

    {
      name: 'project-info',
      keywords: [/projet/i, /bâtiment/i, /batiment/i, /site/i, /nom/i, /info/i],
      async handler() {
        if (!query.hasModel) return notLoaded();
        const info = await query.getProjectInfo();
        if (!info) return notLoaded();
        return `ℹ️ Informations du fichier IFC :
<ul>
<li>Projet : <strong>${escapeHtml(info.project || 'inconnu')}</strong></li>
<li>Site : <strong>${escapeHtml(info.site || 'inconnu')}</strong></li>
<li>Bâtiment : <strong>${escapeHtml(info.building || 'inconnu')}</strong></li>
</ul>`;
      },
    },
  ];
}

function notLoaded() {
  return `🤔 Aucun fichier IFC n'est chargé pour l'instant. Glisse un fichier dans la zone 3D ou clique <strong>📂 Charger IFC</strong>.`;
}
function notLoadedOr(n, msg) {
  return typeof n === 'number' ? msg : notLoaded();
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export class Chatbot {
  constructor({ query, messagesEl, suggestionsEl, inputEl, formEl }) {
    this.query = query;
    this.messagesEl = messagesEl;
    this.suggestionsEl = suggestionsEl;
    this.inputEl = inputEl;
    this.formEl = formEl;
    this.intents = buildIntents(query);

    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.inputEl.value.trim();
      if (!text) return;
      this.inputEl.value = '';
      this.ask(text);
    });

    this._renderSuggestions();
    this._greet();
  }

  _greet() {
    this.addBot(
      `👋 Salut ! Je suis l'assistant <strong>SEKMEN</strong>.
Charge un fichier IFC (glisse-dépose ou bouton en haut à droite) et pose-moi des questions — par exemple : <em>“surface du bâtiment ?”</em> ou <em>“combien de CTA ?”</em>.`
    );
  }

  _renderSuggestions() {
    this.suggestionsEl.innerHTML = '';
    for (const s of SUGGESTIONS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = s;
      chip.addEventListener('click', () => this.ask(s));
      this.suggestionsEl.appendChild(chip);
    }
  }

  clear() {
    this.messagesEl.innerHTML = '';
    this._greet();
  }

  addUser(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.textContent = text;
    this.messagesEl.appendChild(el);
    this._scroll();
  }

  addBot(html) {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = String(html).replace(/\n/g, '<br>');
    this.messagesEl.appendChild(el);
    this._scroll();
  }

  _scroll() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  async ask(text) {
    this.addUser(text);
    const intent = this._match(text);
    if (!intent) {
      this.addBot(
        `🤷 Je n'ai pas compris la question. Essaie par exemple : <em>“surface du bâtiment”</em>, <em>“combien de CTA”</em>, <em>“nombre d'étages”</em>, ou tape <strong>aide</strong> pour la liste.`
      );
      return;
    }
    try {
      const answer = await intent.handler();
      this.addBot(answer);
    } catch (err) {
      console.error(err);
      this.addBot(`⚠️ Oups, erreur pendant la réponse : ${escapeHtml(err.message || err)}`);
    }
  }

  _match(text) {
    // Score each intent by number of keyword hits; return the best.
    let best = null;
    let bestScore = 0;
    for (const intent of this.intents) {
      let score = 0;
      for (const kw of intent.keywords) {
        if (kw instanceof RegExp) {
          if (kw.test(text)) score++;
        } else if (text.toLowerCase().includes(String(kw).toLowerCase())) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    }
    return best;
  }
}
