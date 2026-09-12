import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import type { AssetPreviewModelFormat } from "../../shared/ipc-types";

type ModelPreviewCanvasProps = {
  dataUrl: string;
  format: AssetPreviewModelFormat;
};

async function loadModel(
  url: string,
  format: AssetPreviewModelFormat,
): Promise<THREE.Object3D> {
  if (format === "fbx") {
    return new FBXLoader().loadAsync(url);
  }
  if (format === "obj") {
    return new OBJLoader().loadAsync(url);
  }
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}

function fitObjectToView(object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 2 / maxDim;
  object.scale.setScalar(scale);
  object.position.sub(center.multiplyScalar(scale));
}

function formatModelLoadError(err: unknown, format: AssetPreviewModelFormat): string {
  const message = err instanceof Error ? err.message : "Failed to load 3D model";
  if (
    format === "fbx" &&
    /forEach|Connections|FBX/i.test(message)
  ) {
    return "This FBX file has no mesh data (empty or invalid). Replace the fixture with a real model.";
  }
  return message;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      material?.dispose();
    }
  });
}

export function ModelPreviewCanvas({ dataUrl, format }: ModelPreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let objectUrl: string | null = null;
    let loadedObject: THREE.Object3D | null = null;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141418);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 200);
    camera.position.set(2.4, 1.6, 2.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.8;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(4, 8, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8d0e0, 0.35);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const resize = (): void => {
      const nextWidth = Math.max(container.clientWidth, 1);
      const nextHeight = Math.max(container.clientHeight, 1);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const animate = (): void => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        const object = await loadModel(objectUrl, format);
        if (cancelled) {
          disposeObject(object);
          return;
        }
        fitObjectToView(object);
        scene.add(object);
        loadedObject = object;
        camera.lookAt(0, 0, 0);
        controls.update();
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(formatModelLoadError(err, format));
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      if (loadedObject) {
        scene.remove(loadedObject);
        disposeObject(loadedObject);
      }
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [dataUrl, format]);

  return (
    <div className="asset-preview-model">
      <div ref={containerRef} className="asset-preview-model-canvas" />
      {loading ? <p className="asset-preview-model-status muted">Loading 3D…</p> : null}
      {error ? <p className="asset-preview-model-status error-text">{error}</p> : null}
    </div>
  );
}
