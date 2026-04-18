import { IFCLoader } from 'web-ifc-three/IFCLoader.js';

// ---------------------------------------------------------------------------
// IFC loading. Wraps web-ifc-three and exposes the underlying ifcAPI
// (IfcAPI) so that ifc-query.js can issue property queries.
// ---------------------------------------------------------------------------

export class IfcSession {
  constructor({ scene, modelsGroup, frameObject, onProgress }) {
    this.scene = scene;
    this.modelsGroup = modelsGroup;
    this.frameObject = frameObject;
    this.onProgress = onProgress || (() => {});

    this.loader = new IFCLoader();
    // WASM files are copied next to the bundle by vite-plugin-static-copy.
    // "./" keeps it relative so it works both in dev and after build.
    this.loader.ifcManager.setWasmPath('./');

    this.currentModel = null;
    this.currentModelID = null;
  }

  get ifcAPI() {
    return this.loader.ifcManager.ifcAPI;
  }

  async loadFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const model = await new Promise((resolve, reject) => {
        this.loader.load(
          url,
          (m) => resolve(m),
          (ev) => {
            if (ev && ev.loaded && ev.total) {
              this.onProgress(ev.loaded / ev.total);
            }
          },
          (err) => reject(err)
        );
      });

      // Replace previous model
      if (this.currentModel) {
        this.modelsGroup.remove(this.currentModel);
        this.currentModel.traverse?.((o) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
            else o.material.dispose?.();
          }
        });
      }

      this.currentModel = model;
      this.currentModelID = model.modelID;
      this.modelsGroup.add(model);
      this.frameObject(model);
      return model;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
