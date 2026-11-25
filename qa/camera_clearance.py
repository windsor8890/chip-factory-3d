"""Sample DF-02's offline guided camera against visible scene geometry."""

import argparse
import json

from browser import Browser, source_hash


VARIANTS = (
    ("16x9-hud", 1920, 1080, False),
    ("16x9-film", 1920, 1080, True),
    ("9x16", 1080, 1920, False),
)

PROBE = """fps => {
  const T = THREE;
  const {width, height} = window.__fab.state();
  const probes = Array.from({length: 6}, () => new T.Vector3());
  const local = new T.Vector3(), worldCenter = new T.Vector3();
  const transform = new T.Matrix4(), instance = new T.Matrix4(), inverse = new T.Matrix4();
  const triangle = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
  const crossing = new T.Vector3();
  const ray = new T.Ray(new T.Vector3(), new T.Vector3(.7421, .3719, .5592).normalize());
  const meshesByStage = F.stages.map((_, index) => {
    const meshes = [];
    F.stage(index).root.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry?.attributes.position || Array.isArray(mesh.material)) return;
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const {min, max} = geometry.boundingBox;
      if (Math.min(max.x - min.x, max.y - min.y, max.z - min.z) < .0001) return;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      if (mesh.isInstancedMesh && !mesh.boundingSphere) mesh.computeBoundingSphere();
      meshes.push(mesh);
    });
    return meshes;
  });

  function contains(geometry, position) {
    if (!geometry.boundingBox.containsPoint(position)) return false;
    if (geometry.type === 'BoxGeometry') return true;
    ray.origin.copy(position);
    const vertices = geometry.attributes.position, indices = geometry.index;
    const count = indices ? indices.count : vertices.count;
    const distances = [];
    for (let i = 0; i < count; i += 3) {
      for (let k = 0; k < 3; k++) {
        triangle[k].fromBufferAttribute(vertices, indices ? indices.getX(i + k) : i + k);
      }
      if (!ray.intersectTriangle(triangle[0], triangle[1], triangle[2], false, crossing)) continue;
      const distance = crossing.distanceToSquared(position);
      if (!distances.some(value => Math.abs(value - distance) < 1e-7)) distances.push(distance);
    }
    return distances.length % 2 === 1;
  }

  function visible(mesh) {
    if (!mesh.material.visible || mesh.material.opacity < .75) return false;
    for (let ancestor = mesh; ancestor; ancestor = ancestor.parent) {
      if (!ancestor.visible) return false;
    }
    return true;
  }

  function withinReach(sphere, matrix, camera, reach) {
    worldCenter.copy(sphere.center).applyMatrix4(matrix);
    const radius = sphere.radius * matrix.getMaxScaleOnAxis() + reach;
    return worldCenter.distanceToSquared(camera.position) <= radius * radius;
  }

  // Return one witness per active camera pose. A positive count measures poses, not triangles.
  function findContact(meshes, camera) {
    let reachSquared = 0;
    for (const point of probes) {
      reachSquared = Math.max(reachSquared, point.distanceToSquared(camera.position));
    }
    const reach = Math.sqrt(reachSquared) + 1e-6;
    for (const mesh of meshes) {
      if (!visible(mesh)) continue;
      const geometry = mesh.geometry;
      if (mesh.isInstancedMesh && mesh.instanceMatrix.usage === T.DynamicDrawUsage) {
        mesh.computeBoundingSphere();
      }
      const groupSphere = mesh.isInstancedMesh ? mesh.boundingSphere : geometry.boundingSphere;
      if (!withinReach(groupSphere, mesh.matrixWorld, camera, reach)) continue;
      const count = mesh.isInstancedMesh ? mesh.count : 1;
      for (let index = 0; index < count; index++) {
        if (mesh.isInstancedMesh) {
          mesh.getMatrixAt(index, instance);
          transform.multiplyMatrices(mesh.matrixWorld, instance);
        } else {
          transform.copy(mesh.matrixWorld);
        }
        if (!withinReach(geometry.boundingSphere, transform, camera, reach)) continue;
        inverse.copy(transform).invert();
        for (let point = 0; point < probes.length; point++) {
          local.copy(probes[point]).applyMatrix4(inverse);
          if (contains(geometry, local)) {
            return {mesh: mesh.name, geometry: geometry.type, instance: index, point};
          }
        }
      }
    }
    return null;
  }

  const stageSamples = Array(F.stages.length).fill(0);
  const examples = [];
  const endFrame = Math.ceil(F.duration * fps - 1e-8);
  let contactedPoses = 0;
  for (let frame = 0; frame <= endFrame; frame++) {
    const time = Math.min(frame / fps, F.duration);
    const active = F.contents(F.locate(time).q);
    for (let k = 0; k < active.ids.length; k++) {
      const id = active.ids[k], stage = F.stage(id), progress = active.progress[k];
      stage.update(F.simAt(time), progress);
      stage.root.updateMatrixWorld(true);
      F.camera(stage, progress, width, height, F.view);
      const camera = stage.camera;
      probes[0].copy(camera.position);
      probes[1].set(0, 0, -1).unproject(camera);
      for (let i = 0; i < 4; i++) {
        probes[i + 2].set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, -1).unproject(camera);
      }
      stageSamples[id]++;
      const contact = findContact(meshesByStage[id], camera);
      if (contact) {
        contactedPoses++;
        if (examples.length < 30) examples.push({stage: id, frame, time, ...contact});
      }
    }
  }
  return {width, height, duration: F.duration, timelineSamples: endFrame + 1,
    stageSamples, contactedPoses, examples};
}"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fps", type=int, default=60, help="Samples per second (default 60)")
    args = parser.parse_args()
    if args.fps < 1:
        parser.error("--fps must be a positive integer")
    results = {}
    with Browser(headless=True) as browser:
        for name, width, height, film in VARIANTS:
            page, log = browser.page(width, height)
            try:
                params = {"instant": 1, "tourat": 0, "still": 1, "ar": "9x16" if height > width else "16x9"}
                if film:
                    params["film"] = 1
                browser.open(page, params)
                result = page.evaluate(PROBE, args.fps)
                result["console"] = {key: log[key] for key in ("errors", "warnings", "externalRequests")}
                results[name] = result
            finally:
                page.context.close()

    print(json.dumps({"sourceSha256": source_hash(), "fps": args.fps, "variants": results}, indent=2))
    return int(any(result["contactedPoses"] or any(result["console"].values()) for result in results.values()))


if __name__ == "__main__":
    raise SystemExit(main())
