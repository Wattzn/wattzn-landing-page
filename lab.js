import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Reflector } from "three/addons/objects/Reflector.js";

(function () {
  var stage = document.getElementById("lab");
  if (!stage) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = window.matchMedia("(max-width: 720px)").matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (e) {
    return; // No WebGL: the hero stays text-only.
  }

  var PAPER = 0xf4f3ef;
  var ACCENT = 0xd62b1c;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.appendChild(renderer.domElement);
  stage.parentElement.classList.add("has-lab");

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  scene.fog = new THREE.Fog(PAPER, 7, 16);

  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;

  var camera = new THREE.PerspectiveCamera(30, 2, 0.05, 60);

  // Lighting: soft studio key, sky fill, red kicker from behind
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.6));

  var key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(2.2, 5.5, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 14;
  key.shadow.blurSamples = 20;
  key.shadow.bias = -0.0005;
  var sc = key.shadow.camera;
  sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -5; sc.near = 1; sc.far = 14;
  scene.add(key);

  var kicker = new THREE.SpotLight(ACCENT, 18, 9, Math.PI / 7, 0.8, 1.6);
  kicker.position.set(-3.2, 2.2, -2.4);
  kicker.target.position.set(0, 0.5, 0);
  scene.add(kicker, kicker.target);

  // Floor: soft mirror reflection faded into the page colour, contact shadows on top
  var mirror = new Reflector(new THREE.CircleGeometry(9, 64), {
    color: 0xeeece6,
    textureWidth: Math.round(window.innerWidth * (small ? 0.5 : 0.75)),
    textureHeight: Math.round(window.innerHeight * (small ? 0.5 : 0.75)),
    clipBias: 0.003
  });
  mirror.rotation.x = -Math.PI / 2;
  scene.add(mirror);

  function radialAlpha() {
    var c = document.createElement("canvas");
    c.width = c.height = 256;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, "rgb(170,170,170)");
    grad.addColorStop(0.2, "rgb(205,205,205)");
    grad.addColorStop(0.42, "rgb(255,255,255)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  var veil = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.MeshBasicMaterial({ color: PAPER, alphaMap: radialAlpha(), transparent: true, depthWrite: false, toneMapped: false })
  );
  veil.rotation.x = -Math.PI / 2;
  veil.position.y = 0.0015;
  scene.add(veil);

  var shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), new THREE.ShadowMaterial({ opacity: 0.22 }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.003;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  // Box with rounded vertical edges, used for the force plate.
  function roundedSlab(width, height, depth, radius) {
    var shape = new THREE.Shape();
    var x = -width / 2, y = -depth / 2;
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + depth - radius);
    shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
    shape.lineTo(x + radius, y + depth);
    shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    var g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3 });
    g.rotateX(Math.PI / 2);
    g.translate(0, height, 0);
    return g;
  }

  // Force plate with a red inlay line
  var platformTop = new THREE.Mesh(
    roundedSlab(2.7, 0.035, 1.2, 0.03),
    new THREE.MeshPhysicalMaterial({ color: 0xe9e7e1, roughness: 0.42, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3 })
  );
  platformTop.castShadow = true;
  platformTop.receiveShadow = true;
  scene.add(platformTop);
  var inlay = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.002, 0.012), new THREE.MeshBasicMaterial({ color: ACCENT }));
  inlay.position.set(0, 0.04, 0.52);
  scene.add(inlay);
  var seam = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.002, 1.1), new THREE.MeshBasicMaterial({ color: 0xc9c6bf }));
  seam.position.y = 0.04;
  scene.add(seam);

  // Materials
  function knurlTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    g.fillStyle = "#808080";
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 6;
    for (var i = -64; i < 128; i += 16) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke();
      g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 90);
    return t;
  }
  var knurlMap = knurlTexture();

  var chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 1, envMapIntensity: 1.4 });
  var satin = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.38, metalness: 1, bumpMap: knurlMap, bumpScale: 0.6, roughnessMap: knurlMap });
  var rubberBlack = new THREE.MeshPhysicalMaterial({ color: 0x161616, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.6 });
  var rubberRed = new THREE.MeshPhysicalMaterial({ color: ACCENT, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.5 });
  var castIron = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.62, metalness: 0.45 });
  var white = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1 });

  function shadowed(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Profiles are revolved about Y, then turned onto the X axis.
  function lathe(points, material, segments) {
    var g = new THREE.LatheGeometry(points.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), segments || 96);
    g.computeVertexNormals();
    return shadowed(new THREE.Mesh(g, material));
  }

  function bumper(radius, width, material) {
    var w = width / 2;
    var lip = radius * 0.07;
    var face = w * 0.72;
    var group = new THREE.Group();
    group.add(lathe([
      [0.052, -face], [radius - lip * 1.6, -face], [radius - lip, -w], [radius - 0.004, -w],
      [radius, -w + 0.004], [radius, w - 0.004], [radius - 0.004, w], [radius - lip, w],
      [radius - lip * 1.6, face], [0.052, face], [0.052, -face]
    ], material));
    // Steel hub insert with bolt ring
    group.add(lathe([[0.0262, -w * 0.82], [0.056, -w * 0.82], [0.056, w * 0.82], [0.0262, w * 0.82], [0.0262, -w * 0.82]], chrome, 64));
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2;
      [-1, 1].forEach(function (s) {
        var bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), chrome);
        bolt.position.set(Math.cos(a) * 0.072, s * (face + 0.002), Math.sin(a) * 0.072);
        group.add(bolt);
      });
    }
    return group;
  }

  function onX(object, x) {
    object.rotation.z = -Math.PI / 2;
    object.position.x = x;
    return object;
  }

  // Barbell, dimensions in meters
  var barbell = new THREE.Group();
  barbell.add(onX(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 1.31, 48), satin)), 0));
  [-1, 1].forEach(function (s) {
    barbell.add(onX(lathe([[0.0001, -0.21], [0.025, -0.21], [0.026, -0.205], [0.026, 0.205], [0.025, 0.21], [0.0001, 0.21]], chrome, 64), s * 0.87));
    barbell.add(onX(lathe([[0.0001, -0.018], [0.036, -0.018], [0.04, -0.012], [0.04, 0.012], [0.036, 0.018], [0.0001, 0.018]], chrome, 64), s * 0.672));
    barbell.add(onX(bumper(0.225, 0.066, rubberRed), s * 0.725));
    barbell.add(onX(bumper(0.225, 0.054, rubberBlack), s * 0.787));
    barbell.add(onX(bumper(0.16, 0.03, rubberBlack), s * 0.83));
    barbell.add(onX(lathe([[0.0001, -0.02], [0.042, -0.02], [0.046, -0.014], [0.046, 0.014], [0.042, 0.02], [0.0001, 0.02]], castIron, 48), s * 0.868));
  });
  scene.add(barbell);

  // Motion-capture markers on the sleeve ends
  var markers = [-1, 1].map(function (s) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(0.019, 32, 16), white);
    m.position.set(s * 1.095, 0, 0);
    barbell.add(m);
    return m;
  });

  // Bar-path ribbons
  var TRAIL = 110;
  var ribbonMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9 });
  var trails = markers.map(function () {
    var mesh = new THREE.Mesh(new THREE.BufferGeometry(), ribbonMat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh: mesh, points: [] };
  });
  var tmp = new THREE.Vector3();

  function updateTrail(trail, p) {
    trail.points.unshift(p.clone());
    if (trail.points.length > TRAIL) trail.points.pop();
    if (trail.points.length < 4) return;
    var geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trail.points), trail.points.length, 0.0045, 8, false);
    trail.mesh.geometry.dispose();
    trail.mesh.geometry = geo;
  }

  // Hex dumbbells
  function dumbbell(x, z, rotY, scale) {
    var g = new THREE.Group();
    g.add(onX(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 32), satin)), 0));
    [-1, 1].forEach(function (s) {
      g.add(onX(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.1, 6), rubberBlack)), s * 0.125));
      g.add(onX(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 32), chrome)), s * 0.179));
    });
    g.scale.setScalar(scale);
    g.position.set(x, 0.078 * scale * Math.cos(Math.PI / 6), z);
    g.rotation.y = rotY;
    scene.add(g);
  }

  // Kettlebell
  function kettlebell(x, z, rotY, scale) {
    var g = new THREE.Group();
    g.add(lathe([[0.0001, 0], [0.07, 0], [0.095, 0.02], [0.11, 0.07], [0.105, 0.13], [0.08, 0.175], [0.04, 0.19], [0.0001, 0.192]], castIron, 64));
    var handle = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 20, 48, Math.PI), castIron));
    handle.position.y = 0.235;
    g.add(handle);
    [-1, 1].forEach(function (s) {
      var post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.06, 20), castIron));
      post.position.set(s * 0.07, 0.205, 0);
      g.add(post);
    });
    var band = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.004, 8, 64), rubberRed);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.09;
    g.add(band);
    g.scale.setScalar(scale);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
  }

  dumbbell(-1.5, 0.25, 0.35, 1.1);
  dumbbell(-1.32, 0.52, 0.1, 1.0);
  dumbbell(1.5, -0.45, -0.5, 1.05);
  kettlebell(1.48, 0.2, 0.4, 1.15);

  // Floating glass orbs
  var glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.35, ior: 1.45,
    clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.6,
    attenuationColor: new THREE.Color(0xffe9e6), attenuationDistance: 2
  });
  var orbs = [
    { r: 0.11, p: [-1.55, 0.95, -0.6], s: 0.9 },
    { r: 0.06, p: [-0.45, 1.25, -0.9], s: 1.3 },
    { r: 0.085, p: [1.6, 1.1, -0.4], s: 1.1 },
    { r: 0.04, p: [0.55, 1.45, -0.3], s: 1.6 },
    { r: 0.05, p: [-1.9, 0.55, 0.4], s: 1.2 }
  ].map(function (o) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(o.r, 48, 32), glass);
    m.position.fromArray(o.p);
    m.userData = { base: m.position.clone(), speed: o.s, phase: o.p[0] * 3.1 };
    scene.add(m);
    return m;
  });

  // HUD readout
  var hudHeight = document.querySelector("[data-hud='height']");
  var hudPhase = document.querySelector("[data-hud='phase']");

  // Lift cycle: pull, lockout, lower, reset
  var REST_Y = 0.225 + 0.04;
  var TOP_Y = 0.92;
  var CYCLE = 6.4;
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function liftState(t) {
    var c = t % CYCLE;
    var y, phase;
    if (c < 1.8) { y = REST_Y + (TOP_Y - REST_Y) * easeInOut(c / 1.8); phase = "Concentric"; }
    else if (c < 2.8) { y = TOP_Y; phase = "Lockout"; }
    else if (c < 5.2) { y = TOP_Y - (TOP_Y - REST_Y) * easeInOut((c - 2.8) / 2.4); phase = "Eccentric"; }
    else { y = REST_Y; phase = "Reset"; }
    var k = (y - REST_Y) / (TOP_Y - REST_Y);
    return {
      y: y,
      z: -0.06 * Math.sin(k * Math.PI) - 0.025 * k,
      tilt: 0.01 * Math.sin(t * 1.7) * k,
      spin: k * 0.25,
      phase: phase
    };
  }

  // Camera: product-shot orbit, pointer parallax and scroll dolly
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", function (e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  var lookAt = new THREE.Vector3();
  var FRAME_HALF_WIDTH = 1.7;
  function placeCamera(t) {
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    var rect = stage.getBoundingClientRect();
    var scroll = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1);
    // Pull back far enough to fit the whole set across any screen shape.
    var halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    var halfH = halfV * camera.aspect;
    var radius = Math.max(3.6, (camera.aspect < 1 ? 1.2 : FRAME_HALF_WIDTH) / halfH) * (1 - scroll * 0.18);
    var angle = 0.42 + Math.sin(t * 0.09) * 0.22 + pointer.x * 0.18 + scroll * 0.5;
    var height = 0.75 + pointer.y * -0.12 + scroll * 0.6;
    camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    // Aim below the bar so it sits in the upper part of the frame, above the headline.
    lookAt.set(0, 0.6 - 0.5 * halfV * radius, 0);
    camera.lookAt(lookAt);
  }

  function resize() {
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  var clock = new THREE.Clock();
  var elapsed = 0.6;
  var visible = true;
  var lastPhase = "";
  var frameCount = 0;

  function frame(dt) {
    elapsed += dt;
    frameCount++;
    var s = liftState(elapsed);
    barbell.position.set(0, s.y, s.z);
    barbell.rotation.set(0, s.spin, s.tilt);
    barbell.updateMatrixWorld();

    markers.forEach(function (m, i) {
      m.getWorldPosition(tmp);
      updateTrail(trails[i], tmp);
    });

    orbs.forEach(function (o) {
      var u = o.userData;
      o.position.set(
        u.base.x + Math.sin(elapsed * 0.3 * u.speed + u.phase) * 0.08,
        u.base.y + Math.sin(elapsed * 0.5 * u.speed + u.phase) * 0.1,
        u.base.z + Math.cos(elapsed * 0.25 * u.speed + u.phase) * 0.06
      );
    });

    if (hudHeight && frameCount % 3 === 0) hudHeight.textContent = Math.round((s.y - REST_Y) * 100).toString().padStart(2, "0") + " cm";
    if (hudPhase && s.phase !== lastPhase) { hudPhase.textContent = s.phase; lastPhase = s.phase; }

    placeCamera(elapsed);
    renderer.render(scene, camera);
  }

  if (reduceMotion) {
    for (var i = 0; i < 100; i++) frame(1 / 60);
    stage.classList.add("is-live");
    new ResizeObserver(function () { frame(0); }).observe(stage);
    return;
  }

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) clock.getDelta();
  }).observe(stage);

  renderer.setAnimationLoop(function () {
    if (!visible) return;
    frame(Math.min(clock.getDelta(), 1 / 20));
  });
  requestAnimationFrame(function () { stage.classList.add("is-live"); });
})();
