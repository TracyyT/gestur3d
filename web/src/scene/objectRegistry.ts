import type { Object3D } from 'three';

/** Pickable object meshes by scene object id, for hand raycasting. */
const meshes = new Map<string, Object3D>();

export const objectRegistry = {
  set(id: string, mesh: Object3D) {
    mesh.userData.objectId = id;
    meshes.set(id, mesh);
  },
  delete(id: string) {
    meshes.delete(id);
  },
  all(): Object3D[] {
    return Array.from(meshes.values());
  },
};
