import * as THREE from "three";

const CATEGORY_COLORS = {
  javascript: "#f4d15b",
  programming: "#648cff",
  history: "#f0a35f",
  school: "#a78bfa",
  science: "#50ddf5",
  personal: "#ef8bbd",
  ideas: "#83d6a5",
  work: "#f29b62",
  design: "#f58acc"
};
const FALLBACK_COLORS = ["#9b8cff", "#55c8e8", "#f38dbb", "#84d9b2", "#f0b968", "#799fff"];
const PLANETS_PER_ORBIT = 4;
const INNER_ORBIT_RADIUS = 5.2;
const PLANET_RADII = { 1: 0.48, 2: 0.62, 3: 0.8 };
const ORBIT_SPACING = Math.max(...Object.values(PLANET_RADII)) * 2 + 1.2;
const PLANET_GEOMETRY = new THREE.SphereGeometry(1, 48, 32);
const ATMOSPHERE_MATERIALS = new Map();

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function colorForCategory(category) {
  const key = category.trim().toLowerCase();
  return CATEGORY_COLORS[key] || FALLBACK_COLORS[hashString(key) % FALLBACK_COLORS.length];
}

function planetRadius(importance) {
  return PLANET_RADII[importance] || PLANET_RADII[2];
}

function createPlanetTexture(color, seed, category) {
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth < 700 ? 256 : 512;
  canvas.height = canvas.width / 2;
  const context = canvas.getContext("2d");
  const random = createRandom(seed);
  const baseColor = new THREE.Color(color);
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.38).getStyle());
  gradient.addColorStop(0.48, baseColor.getStyle());
  gradient.addColorStop(1, baseColor.clone().lerp(new THREE.Color("#060916"), 0.68).getStyle());
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const type = category.toLowerCase();
  const isGasGiant = ["programming", "school", "work"].includes(type);
  const isIce = type === "science";
  if (isGasGiant) {
    for (let band = 0; band < 74; band += 1) {
      const baseY = random() * canvas.height;
      const amplitude = 1.4 + random() * 7.5;
      context.beginPath();
      context.moveTo(0, baseY);
      for (let x = 0; x <= canvas.width; x += 8) {
        const wave =
          Math.sin((x / canvas.width) * Math.PI * (2 + random() * 4) + band) * amplitude +
          Math.sin((x / canvas.width) * Math.PI * 11 + band * 0.3) * amplitude * 0.24;
        context.lineTo(x, baseY + wave);
      }
      context.strokeStyle = band % 2 ? "rgba(255,255,255,0.1)" : "rgba(7,10,26,0.24)";
      context.lineWidth = 1 + random() * 4;
      context.stroke();
    }
    for (let storm = 0; storm < 4; storm += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const radiusX = 12 + random() * 27;
      const radiusY = radiusX * (0.34 + random() * 0.24);
      const stormColor = `#${baseColor.clone().lerp(new THREE.Color("#f7d8bd"), random() * 0.45).getHexString()}`;
      const gradient = context.createRadialGradient(x, y, radiusY * 0.08, x, y, radiusX);
      gradient.addColorStop(0, "rgba(255,239,216,0.34)");
      gradient.addColorStop(0.42, `${stormColor}88`);
      gradient.addColorStop(1, `${stormColor}00`);
      context.beginPath();
      context.ellipse(x, y, radiusX, radiusY, random() * 0.14, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();
      for (let swirl = 0; swirl < 3; swirl += 1) {
        context.beginPath();
        context.ellipse(x, y, radiusX * (0.45 + swirl * 0.16), radiusY * (0.42 + swirl * 0.15), 0.08, 0.1, Math.PI * 1.8);
        context.strokeStyle = "rgba(255,244,226,0.2)";
        context.lineWidth = 1.2;
        context.stroke();
      }
    }
  } else if (isIce) {
    for (let stream = 0; stream < 74; stream += 1) {
      const baseY = random() * canvas.height;
      context.beginPath();
      context.moveTo(0, baseY);
      for (let x = 0; x <= canvas.width; x += 12) {
        context.lineTo(x, baseY + Math.sin(x * 0.025 + stream) * (2 + random() * 7));
      }
      context.strokeStyle = stream % 3 ? "rgba(231,251,255,0.17)" : "rgba(12,66,100,0.2)";
      context.lineWidth = 0.7 + random() * 2.8;
      context.stroke();
    }
    for (let fracture = 0; fracture < 38; fracture += 1) {
      let x = random() * canvas.width;
      let y = random() * canvas.height;
      context.beginPath();
      context.moveTo(x, y);
      for (let segment = 0; segment < 5; segment += 1) {
        x += (random() - 0.5) * 55;
        y += (random() - 0.5) * 27;
        context.lineTo(x, y);
      }
      context.strokeStyle = fracture % 2 ? "rgba(238,252,255,0.24)" : "rgba(28,78,111,0.2)";
      context.lineWidth = 0.5 + random() * 1.4;
      context.stroke();
    }
  } else {
    const craterCount = type === "history" || type === "javascript" ? 260 : 175;
    for (let crater = 0; crater < craterCount; crater += 1) {
      const radius = 1.2 + random() * 7.5;
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const craterGradient = context.createRadialGradient(
        x - radius * 0.34,
        y - radius * 0.42,
        radius * 0.05,
        x,
        y,
        radius
      );
      craterGradient.addColorStop(0, "rgba(255,255,255,0.27)");
      craterGradient.addColorStop(0.58, "rgba(10,12,24,0.04)");
      craterGradient.addColorStop(0.78, "rgba(255,239,203,0.15)");
      craterGradient.addColorStop(1, "rgba(4,7,18,0.52)");
      context.beginPath();
      context.ellipse(x, y, radius * 1.24, radius * 0.78, random() * 0.4, 0, Math.PI * 2);
      context.fillStyle = craterGradient;
      context.fill();
    }

    for (let ridge = 0; ridge < 58; ridge += 1) {
      let x = random() * canvas.width;
      let y = random() * canvas.height;
      context.beginPath();
      context.moveTo(x, y);
      for (let segment = 0; segment < 6; segment += 1) {
        x += 12 + random() * 28;
        y += (random() - 0.5) * 14;
        context.lineTo(x, y);
      }
      context.strokeStyle = ridge % 2 ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.07)";
      context.lineWidth = 0.5 + random() * 2.2;
      context.stroke();
    }

    for (let cloud = 0; cloud < 45; cloud += 1) {
      const y = random() * canvas.height;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(
        canvas.width * 0.25,
        y + (random() - 0.5) * 28,
        canvas.width * 0.65,
        y + (random() - 0.5) * 28,
        canvas.width,
        y + (random() - 0.5) * 18
      );
      context.strokeStyle = "rgba(255,255,255,0.1)";
      context.lineWidth = 1 + random() * 5;
      context.stroke();
    }
  }

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const grain = (random() - 0.5) * 9;
    pixels.data[index] = Math.max(0, Math.min(255, pixels.data[index] + grain));
    pixels.data[index + 1] = Math.max(0, Math.min(255, pixels.data[index + 1] + grain));
    pixels.data[index + 2] = Math.max(0, Math.min(255, pixels.data[index + 2] + grain));
  }
  context.putImageData(pixels, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const bumpTexture = texture.clone();
  bumpTexture.colorSpace = THREE.NoColorSpace;
  bumpTexture.needsUpdate = true;
  bumpTexture.anisotropy = 4;
  return { map: texture, bumpMap: bumpTexture };
}

function createRandom(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function getAtmosphereMaterial(color) {
  if (ATMOSPHERE_MATERIALS.has(color)) return ATMOSPHERE_MATERIALS.get(color);

  const material = new THREE.ShaderMaterial({
    uniforms: { atmosphereColor: { value: new THREE.Color(color) } },
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
      uniform vec3 atmosphereColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0), 3.2);
        gl_FragColor = vec4(atmosphereColor, fresnel * 0.34);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  ATMOSPHERE_MATERIALS.set(color, material);
  return material;
}

export function createPlanetSystem(scene, labelLayer) {
  const entries = new Map();
  const orbits = new Map();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let elapsed = 0;
  let hoveredId = null;
  let selectedId = null;
  let searchQuery = "";
  let categoryFilter = null;
  let noteFilter = null;

  function createOrbit(radius, color) {
    const points = [];
    for (let index = 0; index <= 180; index += 1) {
      const angle = (index / 180) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.15,
      depthWrite: false
    });
    const orbit = new THREE.LineLoop(geometry, material);
    scene.add(orbit);
    return orbit;
  }

  function add(note, index = entries.size) {
    if (entries.has(note.id)) return entries.get(note.id);

    const color = colorForCategory(note.category);
    const radius = planetRadius(note.importance);
    const orbitIndex = Math.floor(index / PLANETS_PER_ORBIT);
    const positionInOrbit = index % PLANETS_PER_ORBIT;
    const orbitRadius = INNER_ORBIT_RADIUS + orbitIndex * ORBIT_SPACING;
    const startAngle =
      (positionInOrbit / PLANETS_PER_ORBIT) * Math.PI * 2 + orbitIndex * 0.28;
    const speed =
      (0.11 / Math.sqrt(orbitRadius)) * (1 + (positionInOrbit - (PLANETS_PER_ORBIT - 1) / 2) * 0.012);
    const categoryKey = note.category.toLowerCase();
    const isIce = categoryKey === "science";
    const isGasGiant = ["programming", "school", "work"].includes(categoryKey);
    const surfaceTexture = createPlanetTexture(color, note.id, note.category);
    const material = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      map: surfaceTexture.map,
      roughness: isIce ? 0.42 : isGasGiant ? 0.64 : 0.86,
      bumpMap: surfaceTexture.bumpMap,
      bumpScale: isIce ? 0.035 : isGasGiant ? 0.012 : 0.045,
      metalness: 0.035,
      clearcoat: isIce ? 0.2 : 0.07,
      clearcoatRoughness: isIce ? 0.38 : 0.72,
      emissive: color,
      emissiveIntensity: 0.07
    });
    const mesh = new THREE.Mesh(PLANET_GEOMETRY, material);
    mesh.scale.setScalar(radius);
    mesh.userData.noteId = note.id;

    const atmosphere = new THREE.Mesh(PLANET_GEOMETRY, getAtmosphereMaterial(color));
    atmosphere.scale.setScalar(1.12);
    atmosphere.renderOrder = 1;
    mesh.add(atmosphere);

    let orbit = orbits.get(orbitIndex);
    if (!orbit) {
      orbit = createOrbit(orbitRadius, "#766faa");
      orbits.set(orbitIndex, orbit);
    }

    const label = document.createElement("button");
    label.type = "button";
    label.className = "planet-label";
    label.textContent = note.title;
    label.setAttribute("aria-label", `Öppna anteckningen ${note.title}`);
    label.dataset.noteId = note.id;
    labelLayer.append(label);

    scene.add(mesh);
    const entry = {
      note,
      mesh,
      orbit,
      label,
      color,
      radius,
      orbitIndex,
      orbitRadius,
      startAngle,
      speed,
      rotationSpeed: 0.07 + (hashString(note.id) % 100) / 1000,
      matched: true,
      hovered: note.id === hoveredId,
      selected: note.id === selectedId,
      scaleFactor: 1
    };
    entries.set(note.id, entry);
    updatePosition(entry);
    applyFilters();
    return entry;
  }

  function updateNote(note) {
    const entry = entries.get(note.id);
    if (!entry) return null;

    const color = colorForCategory(note.category);
    const categoryKey = note.category.toLowerCase();
    const isIce = categoryKey === "science";
    const isGasGiant = ["programming", "school", "work"].includes(categoryKey);
    const previousTexture = entry.mesh.material.map;
    const previousBumpTexture = entry.mesh.material.bumpMap;
    const surfaceTexture = createPlanetTexture(color, note.id, note.category);
    entry.mesh.material.map = surfaceTexture.map;
    entry.mesh.material.bumpMap = surfaceTexture.bumpMap;
    entry.mesh.material.bumpScale = isIce ? 0.035 : isGasGiant ? 0.012 : 0.045;
    entry.mesh.material.roughness = isIce ? 0.42 : isGasGiant ? 0.64 : 0.86;
    entry.mesh.material.clearcoat = isIce ? 0.2 : 0.07;
    entry.mesh.material.clearcoatRoughness = isIce ? 0.38 : 0.72;
    entry.mesh.material.emissive.set(color);
    entry.mesh.material.needsUpdate = true;
    if (previousTexture) previousTexture.dispose();
    if (previousBumpTexture) previousBumpTexture.dispose();

    const atmosphere = entry.mesh.children[0];
    if (atmosphere) atmosphere.material = getAtmosphereMaterial(color);
    entry.note = note;
    entry.color = color;
    entry.radius = planetRadius(note.importance);
    entry.mesh.scale.setScalar(entry.radius * entry.scaleFactor);
    entry.label.textContent = note.title;
    entry.label.setAttribute("aria-label", `Öppna anteckningen ${note.title}`);
    applyFilters();
    return entry;
  }

  function updatePosition(entry) {
    const angle = entry.startAngle + elapsed * entry.speed;
    entry.mesh.position.set(
      Math.cos(angle) * entry.orbitRadius,
      Math.sin(angle * 0.65) * 0.42,
      Math.sin(angle) * entry.orbitRadius
    );
  }

  function update(delta, camera) {
    elapsed += delta;
    const viewportWidth = labelLayer.clientWidth;
    const viewportHeight = labelLayer.clientHeight;
    for (const entry of entries.values()) {
      updatePosition(entry);
      entry.mesh.rotation.y += delta * entry.rotationSpeed;
      const targetGlow = entry.selected ? 0.82 : entry.hovered ? 0.5 : entry.matched ? 0.16 : 0.035;
      entry.mesh.material.emissiveIntensity +=
        (targetGlow - entry.mesh.material.emissiveIntensity) * Math.min(delta * 5, 1);
      const targetScale = entry.selected ? 1.13 : entry.hovered ? 1.07 : 1;
      entry.scaleFactor = THREE.MathUtils.lerp(
        entry.scaleFactor,
        targetScale,
        Math.min(delta * 5, 1)
      );
      entry.mesh.scale.setScalar(entry.radius * entry.scaleFactor);
      const position = entry.mesh.position.clone().project(camera);
      const isVisible = position.z > -1 && position.z < 1;
      const screenX = ((position.x + 1) / 2) * viewportWidth;
      const screenY = ((-position.y + 1) / 2) * viewportHeight - 22;
      entry.label.style.transform = `translate(-50%, -50%) translate(${screenX}px, ${screenY}px)`;
      entry.label.style.display = isVisible ? "block" : "none";
      entry.label.classList.toggle("is-dimmed", !entry.matched);
    }
  }

  function applyFilters() {
    const matches = [];
    const matchingOrbits = new Set();
    for (const entry of entries.values()) {
      const noteText =
        `${entry.note.title} ${entry.note.category} ${entry.note.content} ${entry.note.tags.join(" ")}`
          .toLocaleLowerCase("sv");
      const isMatch =
        (!searchQuery || noteText.includes(searchQuery)) &&
        (!categoryFilter || entry.note.category.toLocaleLowerCase("sv") === categoryFilter) &&
        (!noteFilter || noteFilter.has(entry.note.id));
      entry.matched = isMatch;
      entry.mesh.material.transparent = !isMatch;
      entry.mesh.material.opacity = isMatch ? 1 : 0.22;
      entry.mesh.material.emissiveIntensity = isMatch ? 0.2 : 0.035;
      entry.label.classList.toggle("is-dimmed", !isMatch);
      if (isMatch) {
        matches.push(entry.note);
        matchingOrbits.add(entry.orbitIndex);
      }
    }
    for (const [orbitIndex, orbit] of orbits) {
      orbit.material.opacity = matchingOrbits.has(orbitIndex) ? 0.15 : 0.035;
    }
    return matches;
  }

  function setSearch(query) {
    searchQuery = query.trim().toLocaleLowerCase("sv");
    return applyFilters();
  }

  function setCategoryFilter(category) {
    categoryFilter = category ? category.trim().toLocaleLowerCase("sv") : null;
    return applyFilters();
  }

  function setNoteFilter(ids) {
    noteFilter = ids ? new Set(ids) : null;
    return applyFilters();
  }

  function intersect(event, canvas, camera) {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(
      Array.from(entries.values(), (entry) => entry.mesh),
      false
    );
    return intersections.length ? entries.get(intersections[0].object.userData.noteId) : null;
  }

  function focusPlanet(id, solarScene) {
    const entry = entries.get(id);
    if (!entry) return false;
    solarScene.focus(entry.mesh.position, Math.max(entry.orbitRadius * 0.3, 7));
    return true;
  }

  function setHovered(id) {
    if (hoveredId === id) return;
    hoveredId = id;
    for (const entry of entries.values()) entry.hovered = entry.note.id === id;
  }

  function setSelected(id) {
    selectedId = id;
    for (const entry of entries.values()) entry.selected = entry.note.id === id;
  }

  return {
    add,
    updateNote,
    update,
    setSearch,
    setCategoryFilter,
    setNoteFilter,
    intersect,
    focusPlanet,
    setHovered,
    setSelected,
    get: (id) => entries.get(id)
  };
}
