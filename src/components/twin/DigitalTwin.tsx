"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Html, OrbitControls, Environment } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { fractalNoise2d, geoToScene, type GeoPoint } from "@/lib/geo";
import type { SensorStatus } from "@/types/database";

/**
 * Biodiversity digital twin.
 *
 * Serves both the guest view (`/client`, interactive) and the lobby kiosk
 * (`/lobby`, ambient auto-orbit) from one scene, because they must show the
 * same place — a guest comparing the hall screen to their phone should not see
 * two different resorts.
 *
 * Terrain has two sources:
 *   • A published `.glb` from the photogrammetry pipeline, when one exists.
 *   • Otherwise deterministic procedural terrain. A newly onboarded resort has
 *     no scan yet, and an empty grey plane would read as a broken product; the
 *     noise is seeded from the tenant slug so the same site always renders the
 *     same shape.
 */

export interface TwinSensor {
  id: string;
  name: string;
  status: SensorStatus;
  /** [longitude, latitude] */
  position: [number, number] | null;
}

export interface TwinGeoreference {
  origin: GeoPoint;
  headingDeg: number;
  spanMeters: number;
}

export interface DigitalTwinProps {
  assetUrl: string | null;
  georeference: TwinGeoreference;
  sensors: TwinSensor[];
  /** Seeds procedural terrain so a site's shape is stable. */
  seed: string;
  /** Kiosk mode: continuous orbit, no user input. */
  ambient?: boolean;
  orbitPeriodSeconds?: number;
  /** Highlighted sensor, driven by the detection a guest has selected. */
  activeSensorId?: string | null;
  onSelectSensor?: (sensorId: string) => void;
  className?: string;
}

const STATUS_COLOUR: Record<SensorStatus, string> = {
  active: "#52b892",
  degraded: "#f59e0b",
  offline: "#f87171",
  provisioning: "#94a3b8",
  retired: "#475569",
};

function seedToNumber(seed: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % 100_000;
}

/* ── Terrain ─────────────────────────────────────────────────────────────── */

/**
 * Procedural fallback terrain.
 *
 * Built once with `useMemo`: displacing 128×128 vertices per frame would be
 * pointless work for a static landscape.
 */
function ProceduralTerrain({
  spanMeters,
  seed,
}: {
  spanMeters: number;
  seed: string;
}) {
  const geometry = useMemo(() => {
    const segments = 128;
    const geo = new THREE.PlaneGeometry(spanMeters, spanMeters, segments, segments);
    const numericSeed = seedToNumber(seed);
    const positions = geo.attributes.position;

    if (!positions) return geo;

    // Relief scales with the site so a 40 m garden does not get alpine hills.
    const relief = Math.max(2, spanMeters * 0.06);

    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      const height =
        fractalNoise2d(
          (x / spanMeters) * 4 + 8,
          (y / spanMeters) * 4 + 8,
          3,
          numericSeed
        ) * relief;

      // Fall away at the edges so the tile reads as a plinth rather than a
      // slab with a hard cut.
      const edgeFalloff =
        1 -
        Math.min(
          1,
          Math.hypot(x / (spanMeters / 2), y / (spanMeters / 2)) ** 3
        );

      positions.setZ(i, height * edgeFalloff);
    }

    geo.computeVertexNormals();
    return geo;
  }, [spanMeters, seed]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color="#1a3328" roughness={0.95} metalness={0.02} />
    </mesh>
  );
}

/**
 * Published photogrammetry mesh.
 *
 * Auto-fitted to `spanMeters` and recentred: scans arrive in arbitrary units
 * and with arbitrary pivots, so trusting the file's own scale would put the
 * camera inside the terrain about half the time.
 */
function LoadedTerrain({
  assetUrl,
  spanMeters,
}: {
  assetUrl: string;
  spanMeters: number;
}) {
  const gltf = useLoader(GLTFLoader, assetUrl);

  const prepared = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(centre);

    const longestEdge = Math.max(size.x, size.z) || 1;
    const scale = spanMeters / longestEdge;

    scene.position.set(-centre.x, -box.min.y, -centre.z);
    scene.scale.setScalar(scale);

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.receiveShadow = true;
        child.castShadow = false;
      }
    });

    return scene;
  }, [gltf, spanMeters]);

  return <primitive object={prepared} />;
}

/* ── Sensor pins ─────────────────────────────────────────────────────────── */

function SensorPin({
  sensor,
  position,
  active,
  showLabel,
  onSelect,
}: {
  sensor: TwinSensor;
  position: [number, number, number];
  active: boolean;
  showLabel: boolean;
  onSelect?: (id: string) => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const colour = STATUS_COLOUR[sensor.status];

  // Only active units pulse. A ring on an offline balise would suggest it is
  // still listening.
  useFrame(({ clock }) => {
    if (!ringRef.current || sensor.status !== "active") return;
    const t = (clock.getElapsedTime() % 3) / 3;
    ringRef.current.scale.setScalar(0.6 + t * 2.2);
    const material = ringRef.current.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = 0.55 * (1 - t);
    }
  });

  const height = 3.2;

  return (
    <group position={position}>
      {/* Mast, so a pin reads as standing on the terrain rather than floating. */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, height, 6]} />
        <meshStandardMaterial color="#0c1f18" roughness={0.8} />
      </mesh>

      <mesh
        position={[0, height, 0]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(sensor.id);
        }}
      >
        <sphereGeometry args={[active || hovered ? 0.72 : 0.5, 20, 20]} />
        <meshStandardMaterial
          color={colour}
          emissive={colour}
          emissiveIntensity={active ? 1.5 : 0.6}
          roughness={0.35}
        />
      </mesh>

      <mesh ref={ringRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 40]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {showLabel && (active || hovered) ? (
        <Html position={[0, height + 1.3, 0]} center distanceFactor={38}>
          <span className="hud-surface whitespace-nowrap px-2 py-1 hud-title">
            {sensor.name}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

/* ── Camera ──────────────────────────────────────────────────────────────── */

/** Continuous orbit for the kiosk. Period comes from the resort's settings. */
function AmbientOrbit({
  radius,
  periodSeconds,
}: {
  radius: number;
  periodSeconds: number;
}) {
  useFrame(({ camera, clock }) => {
    const angle = (clock.getElapsedTime() / Math.max(10, periodSeconds)) * Math.PI * 2;
    camera.position.set(
      Math.cos(angle) * radius,
      radius * 0.55,
      Math.sin(angle) * radius
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ── Scene ───────────────────────────────────────────────────────────────── */

function TwinScene({
  assetUrl,
  georeference,
  sensors,
  seed,
  ambient,
  orbitPeriodSeconds,
  activeSensorId,
  onSelectSensor,
}: DigitalTwinProps) {
  const { origin, headingDeg, spanMeters } = georeference;

  const placed = useMemo(
    () =>
      sensors
        .filter(
          (sensor): sensor is TwinSensor & { position: [number, number] } =>
            sensor.position !== null
        )
        .map((sensor) => ({
          sensor,
          scenePosition: geoToScene(
            origin,
            { lon: sensor.position[0], lat: sensor.position[1], alt: origin.alt },
            headingDeg
          ),
        })),
    [sensors, origin, headingDeg]
  );

  const cameraRadius = spanMeters * 0.95;

  return (
    <>
      {/* Warm key light, cool fill: reads as late-afternoon canopy light. */}
      <ambientLight intensity={0.4} color="#cfe6d8" />
      <directionalLight
        position={[spanMeters * 0.6, spanMeters * 0.8, spanMeters * 0.4]}
        intensity={1.5}
        color="#ffe8c4"
      />
      <directionalLight
        position={[-spanMeters * 0.5, spanMeters * 0.3, -spanMeters * 0.6]}
        intensity={0.35}
        color="#7fb8d8"
      />

      <Environment preset="forest" background={false} />

      <fog attach="fog" args={["#050d0a", spanMeters * 1.4, spanMeters * 3.4]} />

      <Suspense fallback={null}>
        {assetUrl ? (
          <LoadedTerrain assetUrl={assetUrl} spanMeters={spanMeters} />
        ) : (
          <ProceduralTerrain spanMeters={spanMeters} seed={seed} />
        )}
      </Suspense>

      {placed.map(({ sensor, scenePosition }) => (
        <SensorPin
          key={sensor.id}
          sensor={sensor}
          position={scenePosition}
          active={sensor.id === activeSensorId}
          showLabel={!ambient || sensor.id === activeSensorId}
          onSelect={ambient ? undefined : onSelectSensor}
        />
      ))}

      {ambient ? (
        <AmbientOrbit
          radius={cameraRadius}
          periodSeconds={orbitPeriodSeconds ?? 90}
        />
      ) : (
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={spanMeters * 0.35}
          maxDistance={spanMeters * 2}
          // Stop just short of horizontal so the camera cannot slide under the
          // terrain, which would show the unlit underside of the mesh.
          maxPolarAngle={Math.PI / 2.15}
          target={[0, 0, 0]}
        />
      )}
    </>
  );
}

export function DigitalTwin(props: DigitalTwinProps) {
  const { className = "", georeference } = props;
  const cameraRadius = georeference.spanMeters * 0.95;

  return (
    <div className={className}>
      <Canvas
        // Capped for the kiosk: an unbounded DPR on a 4K display would render
        // millions of extra pixels a frame for no visible gain.
        dpr={[1, 2]}
        shadows={false}
        camera={{
          position: [cameraRadius * 0.8, cameraRadius * 0.6, cameraRadius * 0.8],
          fov: 42,
          near: 0.1,
          far: georeference.spanMeters * 6,
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#050d0a"]} />
        <TwinScene {...props} />
      </Canvas>
    </div>
  );
}
