import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function createRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createStarSpriteTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.92)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.38)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStars({ count, minRadius, maxRadius, size, opacity, seed, spriteTexture }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const random = createRandom(seed);
  const colorChoices = [
    new THREE.Color("#c8c8c8"),
    new THREE.Color("#e6e6e6"),
    new THREE.Color("#ffffff"),
    new THREE.Color("#a4a4a4")
  ];

  for (let index = 0; index < count; index += 1) {
    const radius = minRadius + random() * (maxRadius - minRadius);
    const theta = random() * Math.PI * 2;
    const vertical = random() * 2 - 1;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    positions[index * 3] = radius * horizontal * Math.cos(theta);
    positions[index * 3 + 1] = radius * vertical;
    positions[index * 3 + 2] = radius * horizontal * Math.sin(theta);

    const color = colorChoices[Math.floor(random() * colorChoices.length)];
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size,
    map: spriteTexture,
    alphaTest: 0.015,
    vertexColors: true,
    transparent: true,
    opacity,
    sizeAttenuation: true,
    depthWrite: false
  });

  const stars = new THREE.Points(geometry, material);
  stars.userData.baseOpacity = opacity;
  stars.userData.rotationSpeed = 0.0015 + size * 0.006;
  return stars;
}

function createStarfield(scene, lowPower) {
  const field = new THREE.Group();
  const spriteTexture = createStarSpriteTexture();
  const layers = [
    { count: lowPower ? 1200 : 2600, minRadius: 48, maxRadius: 105, size: 0.085, opacity: 0.52, seed: 11 },
    { count: lowPower ? 850 : 1900, minRadius: 82, maxRadius: 155, size: 0.14, opacity: 0.7, seed: 23 },
    { count: lowPower ? 450 : 1000, minRadius: 125, maxRadius: 215, size: 0.2, opacity: 0.9, seed: 37 }
  ].map((config) => createStars({ ...config, spriteTexture }));

  layers.forEach((stars) => field.add(stars));
  scene.add(field);
  return layers;
}

function createNebulaTexture(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const clouds = [
    { x: 74, y: 62, radius: 64, alpha: 0.26 },
    { x: 145, y: 51, radius: 53, alpha: 0.2 },
    { x: 186, y: 85, radius: 38, alpha: 0.14 }
  ];

  for (const cloud of clouds) {
    const gradient = context.createRadialGradient(
      cloud.x,
      cloud.y,
      cloud.radius * 0.05,
      cloud.x,
      cloud.y,
      cloud.radius
    );
    gradient.addColorStop(0, `${color}${Math.round(cloud.alpha * 255).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(0.55, `${color}22`);
    gradient.addColorStop(1, `${color}00`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createNebulae(scene, lowPower) {
  const configs = [
    { color: "#737373", position: [-62, 18, -118], size: [72, 42], opacity: 0.22 },
    { color: "#9a9a9a", position: [74, -25, -142], size: [92, 54], opacity: 0.17 }
  ];
  const nebulae = configs.map((config) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createNebulaTexture(config.color),
        color: "#ffffff",
        transparent: true,
        opacity: lowPower ? config.opacity * 0.7 : config.opacity,
        depthWrite: false,
        toneMapped: false
      })
    );
    sprite.position.set(...config.position);
    sprite.scale.set(...config.size, 1);
    scene.add(sprite);
    return sprite;
  });
  return nebulae;
}

function createFresnelMaterial(color, opacity, power, side = THREE.FrontSide) {
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      glowOpacity: { value: opacity },
      fresnelPower: { value: power }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float glowOpacity;
      uniform float fresnelPower;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0), fresnelPower);
        gl_FragColor = vec4(glowColor, fresnel * glowOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
}

function createSolarSurfaceMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      deepColor: { value: new THREE.Color("#262626") },
      orangeColor: { value: new THREE.Color("#777777") },
      goldColor: { value: new THREE.Color("#b8b8b8") },
      hotColor: { value: new THREE.Color("#eeeeee") }
    },
    vertexShader: `
      varying vec3 vSurfacePosition;
      void main() {
        vSurfacePosition = position / 1.7;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 deepColor;
      uniform vec3 orangeColor;
      uniform vec3 goldColor;
      uniform vec3 hotColor;
      varying vec3 vSurfacePosition;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
              mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
          mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
              mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int octave = 0; octave < 4; octave++) {
          value += noise(p) * amplitude;
          p *= 2.03;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 flow = vSurfacePosition * 3.2;
        flow += vec3(0.0, uTime * 0.09, uTime * 0.035);
        float turbulence = fbm(flow * 1.7);
        float granulation = fbm(flow * 5.4 + vec3(turbulence * 2.0));
        float filaments = sin(vSurfacePosition.y * 38.0 + turbulence * 7.0 + uTime * 0.22);
        float heat = turbulence * 0.55 + granulation * 0.35 + filaments * 0.1;
        vec3 color = mix(deepColor, orangeColor, smoothstep(0.18, 0.48, heat));
        color = mix(color, goldColor, smoothstep(0.46, 0.68, heat));
        color = mix(color, hotColor, smoothstep(0.69, 0.86, heat) * 0.72);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false
  });
}

function createSolarFlares(sun) {
  const arcs = [
    { start: 0.28, span: 1.48, height: 0.47, plane: "xy" },
    { start: 2.55, span: 1.58, height: 0.34, plane: "xz" },
    { start: 4.65, span: 1.42, height: 0.42, plane: "xy" }
  ];

  for (const [index, arc] of arcs.entries()) {
    const points = [];
    for (let step = 0; step <= 36; step += 1) {
      const progress = step / 36;
      const angle = arc.start + progress * arc.span;
      const lift = Math.sin(progress * Math.PI) * arc.height;
      const radius = 1.72 + lift;
      const x = Math.cos(angle) * radius;
      const y = arc.plane === "xy" ? Math.sin(angle) * radius : 0.05 + lift * 0.18;
      const z = arc.plane === "xz" ? Math.sin(angle) * radius : 0.16 + lift * 0.2;
      points.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 44, index === 0 ? 0.022 : 0.016, 5, false);
    const material = new THREE.MeshBasicMaterial({
      color: index === 1 ? "#a8a8a8" : "#dddddd",
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    sun.add(new THREE.Mesh(geometry, material));
  }
}

function createSun(scene) {
  const sun = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 48, 48),
    createSolarSurfaceMaterial()
  );
  sun.add(core);

  const corona = new THREE.Mesh(
    new THREE.SphereGeometry(1.88, 48, 48),
    createFresnelMaterial("#bcbcbc", 0.42, 2.2)
  );
  sun.add(corona);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(2.12, 48, 48),
    createFresnelMaterial("#a5a5a5", 0.2, 1.6)
  );
  sun.add(glow);
  const outerGlow = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 48, 48),
    createFresnelMaterial("#777777", 0.075, 1.35)
  );
  sun.add(outerGlow);
  createSolarFlares(sun);
  scene.add(sun);

  const light = new THREE.PointLight("#dddddd", 220, 100, 2);
  scene.add(light);
  return { sun, core };
}

export function createSolarScene(container, initialQuality = "auto") {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#050505");
  scene.fog = new THREE.FogExp2("#050505", 0.0022);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 300);
  camera.position.set(0, 10, 21);

  const lowPower =
    window.innerWidth < 700 ||
    (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ||
    (Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4);
  const renderer = new THREE.WebGLRenderer({
    antialias: !lowPower,
    alpha: false,
    powerPreference: lowPower ? "low-power" : "high-performance"
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.className = "solar-canvas";
  renderer.domElement.setAttribute("aria-label", "3D-solsystem. Klicka på en planet för att öppna anteckningen.");
  container.prepend(renderer.domElement);

  const controls = new OrbitControls(camera, container);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 7;
  controls.maxDistance = 75;
  controls.maxPolarAngle = Math.PI * 0.82;
  controls.target.set(0, 0, 0);
  let focusTarget = null;
  let focusCamera = null;
  let resettingCamera = false;
  controls.addEventListener("start", () => {
    focusTarget = null;
    focusCamera = null;
    resettingCamera = false;
  });
  const neutralCameraPosition = camera.position.clone();
  const neutralTarget = controls.target.clone();

  const ambient = new THREE.AmbientLight("#a8a8a8", 0.27);
  scene.add(ambient);
  const { sun, core } = createSun(scene);
  const starLayers = createStarfield(scene, lowPower);
  const nebulae = createNebulae(scene, lowPower);

  let resizeObserver;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
  } else {
    window.addEventListener("resize", resize);
  }

  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  const qualitySettings = {
    auto: { pixelRatio: lowPower ? 1 : 1.5, detail: lowPower ? 0.72 : 1 },
    low: { pixelRatio: 1, detail: 0.62 },
    medium: { pixelRatio: 1.25, detail: 0.82 },
    high: { pixelRatio: 1.5, detail: 1 },
    ultra: { pixelRatio: 2, detail: 1.12 }
  };
  let currentQuality = "";
  function setQuality(value) {
    const nextQuality = Object.prototype.hasOwnProperty.call(qualitySettings, value) ? value : "auto";
    if (nextQuality === currentQuality) return;
    currentQuality = nextQuality;
    const settings = qualitySettings[nextQuality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
    for (const stars of starLayers) {
      stars.material.opacity = stars.userData.baseOpacity * settings.detail;
      stars.userData.qualityOpacity = stars.material.opacity;
    }
    for (const nebula of nebulae) {
      nebula.material.opacity = nebula.userData.baseOpacity * settings.detail;
    }
    resize();
  }

  nebulae.forEach((nebula) => {
    nebula.userData.baseOpacity = nebula.material.opacity;
  });
  starLayers.forEach((stars) => {
    stars.userData.qualityOpacity = stars.material.opacity;
  });
  setQuality(initialQuality);
  resize();

  function resetCamera() {
    focusTarget = neutralTarget.clone();
    focusCamera = neutralCameraPosition.clone();
    resettingCamera = true;
  }

  function focus(position, distance = 9) {
    resettingCamera = false;
    const direction = camera.position.clone().sub(controls.target).normalize();
    if (direction.lengthSq() === 0) direction.set(0, 0.35, 1);
    focusTarget = position.clone();
    focusCamera = position.clone().add(direction.multiplyScalar(distance));
  }

  function updateFocus(delta) {
    if (!focusTarget || !focusCamera) return;
    const easing = 1 - Math.exp(-5.5 * delta);
    controls.target.lerp(focusTarget, easing);
    camera.position.lerp(focusCamera, easing);
    if (
      controls.target.distanceToSquared(focusTarget) < 0.0025 &&
      camera.position.distanceToSquared(focusCamera) < 0.01
    ) {
      controls.target.copy(focusTarget);
      camera.position.copy(focusCamera);
      focusTarget = null;
      focusCamera = null;
      if (resettingCamera) {
        resettingCamera = false;
        controls.reset();
      }
    }
  }

  function updateAmbient(delta, time) {
    core.material.uniforms.uTime.value = time;
    starLayers.forEach((stars, index) => {
      stars.rotation.y += delta * stars.userData.rotationSpeed;
      stars.material.opacity =
        stars.userData.qualityOpacity *
        (0.9 + Math.sin(time * (0.45 + index * 0.16) + index) * 0.1);
    });
    nebulae.forEach((nebula, index) => {
      nebula.material.rotation += delta * (index ? -0.0007 : 0.0009);
    });
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    sun,
    sunCore: core,
    focus,
    resetCamera,
    setQuality,
    updateFocus,
    updateAmbient,
    resize,
    dispose() {
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", resize);
      controls.dispose();
      const geometries = new Set();
      const materials = new Set();
      const textures = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material)
          ? object.material
          : object.material
            ? [object.material]
            : [];
        for (const material of objectMaterials) {
          materials.add(material);
          for (const value of Object.values(material)) {
            if (value && value.isTexture) textures.add(value);
          }
        }
      });
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
