import * as THREE from 'three';
import {
  IFCBUILDING,
  IFCBUILDINGSTOREY,
  IFCSPACE,
  IFCWALL,
  IFCWALLSTANDARDCASE,
  IFCSLAB,
  IFCROOF,
  IFCDOOR,
  IFCWINDOW,
  IFCBEAM,
  IFCCOLUMN,
  IFCSTAIR,
  IFCUNITARYEQUIPMENT,
  IFCAIRTERMINAL,
  IFCAIRTERMINALBOX,
  IFCFAN,
  IFCPUMP,
  IFCBOILER,
  IFCSPACEHEATER,
  IFCCHILLER,
  IFCFLOWSEGMENT,
  IFCFLOWFITTING,
  IFCDUCTSEGMENT,
  IFCPIPESEGMENT,
  IFCSENSOR,
  IFCMATERIAL,
  IFCPROJECT,
  IFCSITE,
} from 'web-ifc';

// ---------------------------------------------------------------------------
// IFC queries: anything the chatbot might ask about the loaded model.
// All methods assume a model is loaded (see IfcSession.currentModelID).
// ---------------------------------------------------------------------------

export class IfcQuery {
  constructor(session) {
    this.session = session;
  }

  get hasModel() {
    return this.session.currentModel !== null;
  }

  get api() {
    return this.session.ifcAPI;
  }

  get modelID() {
    return this.session.currentModelID;
  }

  // ------- generic helpers --------------------------------------------------

  async _getLines(type) {
    const ids = await this.api.GetLineIDsWithType(this.modelID, type);
    const out = [];
    for (let i = 0; i < ids.size(); i++) {
      out.push(ids.get(i));
    }
    return out;
  }

  async _count(type) {
    const ids = await this.api.GetLineIDsWithType(this.modelID, type);
    return ids.size();
  }

  async _getProps(expressID) {
    return this.api.GetLine(this.modelID, expressID, true);
  }

  // ------- counts -----------------------------------------------------------

  async countByType(type) {
    if (!this.hasModel) return 0;
    return this._count(type);
  }

  async countCTA() {
    // CTA = Centrale de Traitement d'Air ≈ AirHandlingUnit in IFC.
    // IFC4 uses IfcUnitaryEquipment with PredefinedType=AIRHANDLER, but
    // exports vary. We count unitary equipment + air terminals as a heuristic.
    if (!this.hasModel) return 0;
    let total = 0;
    for (const t of [IFCUNITARYEQUIPMENT]) {
      total += await this._count(t);
    }
    return total;
  }

  async countAirTerminals() {
    let n = 0;
    for (const t of [IFCAIRTERMINAL, IFCAIRTERMINALBOX]) {
      n += await this._count(t);
    }
    return n;
  }

  async countStoreys() {
    return this._count(IFCBUILDINGSTOREY);
  }

  async countSpaces() {
    return this._count(IFCSPACE);
  }

  async countWalls() {
    let n = await this._count(IFCWALL);
    n += await this._count(IFCWALLSTANDARDCASE);
    return n;
  }

  async countSlabs() {
    return this._count(IFCSLAB);
  }

  async countRoofs() {
    return this._count(IFCROOF);
  }

  async countDoors() {
    return this._count(IFCDOOR);
  }

  async countWindows() {
    return this._count(IFCWINDOW);
  }

  async countBeams() {
    return this._count(IFCBEAM);
  }

  async countColumns() {
    return this._count(IFCCOLUMN);
  }

  async countStairs() {
    return this._count(IFCSTAIR);
  }

  async countFans() {
    return this._count(IFCFAN);
  }

  async countPumps() {
    return this._count(IFCPUMP);
  }

  async countBoilers() {
    return this._count(IFCBOILER);
  }

  async countRadiators() {
    return this._count(IFCSPACEHEATER);
  }

  async countChillers() {
    return this._count(IFCCHILLER);
  }

  async countSensors() {
    return this._count(IFCSENSOR);
  }

  // ------- dimensions -------------------------------------------------------

  /** Bounding box of the loaded model (world units, usually meters). */
  getBoundingBox() {
    if (!this.hasModel) return null;
    const box = new THREE.Box3().setFromObject(this.session.currentModel);
    return box;
  }

  /** Footprint = X × Z of the bounding box. */
  getFootprintArea() {
    const box = this.getBoundingBox();
    if (!box) return 0;
    const s = box.getSize(new THREE.Vector3());
    return s.x * s.z;
  }

  getBoundingVolume() {
    const box = this.getBoundingBox();
    if (!box) return 0;
    const s = box.getSize(new THREE.Vector3());
    return s.x * s.y * s.z;
  }

  getDimensions() {
    const box = this.getBoundingBox();
    if (!box) return null;
    return box.getSize(new THREE.Vector3());
  }

  /** Sum of IfcSpace floor areas when available. */
  async getTotalSpaceArea() {
    if (!this.hasModel) return null;
    const ids = await this._getLines(IFCSPACE);
    if (ids.length === 0) return null;
    let total = 0;
    let found = 0;
    for (const id of ids) {
      const area = await this._readPropertyFloat(id, /Area|Surface/i);
      if (area !== null) {
        total += area;
        found++;
      }
    }
    return found > 0 ? total : null;
  }

  /** Try to read a numeric property (by regex on name) on an element. */
  async _readPropertyFloat(expressID, nameRegex) {
    try {
      const psetIds = await this.api.GetLineIDsWithType(this.modelID, 0); // placeholder
      // Simpler approach: walk the relDefinesByProperties
      const line = await this.api.GetLine(this.modelID, expressID, true);
      // Try direct quantities / property sets embedded in line (rare).
      if (line && line.IsDefinedBy) {
        for (const rel of line.IsDefinedBy) {
          const pset = rel.RelatingPropertyDefinition;
          if (!pset) continue;
          // IfcElementQuantity
          if (pset.Quantities) {
            for (const q of pset.Quantities) {
              if (q.Name && nameRegex.test(q.Name.value || '')) {
                const v =
                  q.AreaValue?.value ??
                  q.LengthValue?.value ??
                  q.VolumeValue?.value ??
                  q.CountValue?.value;
                if (typeof v === 'number') return v;
              }
            }
          }
          // IfcPropertySet
          if (pset.HasProperties) {
            for (const p of pset.HasProperties) {
              if (p.Name && nameRegex.test(p.Name.value || '')) {
                const v = p.NominalValue?.value;
                if (typeof v === 'number') return v;
              }
            }
          }
        }
      }
    } catch (e) {
      // Silently ignore — not all elements have readable properties.
    }
    return null;
  }

  // ------- info / lists -----------------------------------------------------

  async getProjectInfo() {
    if (!this.hasModel) return null;
    const projIds = await this._getLines(IFCPROJECT);
    const siteIds = await this._getLines(IFCSITE);
    const bldIds = await this._getLines(IFCBUILDING);
    const info = {};
    if (projIds.length) {
      const p = await this._getProps(projIds[0]);
      info.project = p.Name?.value || p.LongName?.value || '(sans nom)';
    }
    if (siteIds.length) {
      const s = await this._getProps(siteIds[0]);
      info.site = s.Name?.value || '(sans nom)';
    }
    if (bldIds.length) {
      const b = await this._getProps(bldIds[0]);
      info.building = b.Name?.value || b.LongName?.value || '(sans nom)';
    }
    return info;
  }

  async listMaterials(limit = 30) {
    if (!this.hasModel) return [];
    const ids = await this._getLines(IFCMATERIAL);
    const names = new Set();
    for (const id of ids) {
      try {
        const m = await this._getProps(id);
        if (m && m.Name && m.Name.value) names.add(m.Name.value);
      } catch {}
      if (names.size >= limit) break;
    }
    return [...names];
  }

  async getStoreyNames() {
    if (!this.hasModel) return [];
    const ids = await this._getLines(IFCBUILDINGSTOREY);
    const out = [];
    for (const id of ids) {
      try {
        const s = await this._getProps(id);
        out.push(s.Name?.value || s.LongName?.value || `Étage ${id}`);
      } catch {}
    }
    return out;
  }

  /** High-level summary used by the chatbot "résumé" command. */
  async getSummary() {
    if (!this.hasModel) return null;
    const [
      storeys,
      spaces,
      walls,
      slabs,
      doors,
      windows,
      cta,
      radiators,
      fans,
      boilers,
    ] = await Promise.all([
      this.countStoreys(),
      this.countSpaces(),
      this.countWalls(),
      this.countSlabs(),
      this.countDoors(),
      this.countWindows(),
      this.countCTA(),
      this.countRadiators(),
      this.countFans(),
      this.countBoilers(),
    ]);
    const dims = this.getDimensions();
    return {
      storeys,
      spaces,
      walls,
      slabs,
      doors,
      windows,
      cta,
      radiators,
      fans,
      boilers,
      dims,
      footprint: this.getFootprintArea(),
      volume: this.getBoundingVolume(),
    };
  }
}
