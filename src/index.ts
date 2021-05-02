import { CameraOrbitControl, Model } from "pixi3d"
import { Application, GC_MODES, Renderer, settings } from "pixi.js"
import { ImageBasedLightingSampler } from "./image-based-lighting-sampler"
import { Skybox } from "./skybox/skybox"
import { Cubemap } from "./cubemap"
import { Environment } from "./environment"
import { CubemapFaces } from "./cubemap-faces"

// @ts-ignore
document.getElementById("environments-button").onclick = () => {
  document.getElementById("environments-content")?.classList.toggle("show")
}

// @ts-ignore
document.getElementById("download-button").onclick = () => {
  if (currentEnvironment) {
    currentEnvironment.download(brdf)
  }
}

settings.GC_MODE = GC_MODES.MANUAL

const app = new Application({
  backgroundColor: 0xdddddd, resizeTo: window, antialias: true, view: <HTMLCanvasElement>document.getElementById("app")
})
document.body.appendChild(app.view)

const environments = [
  new Environment("helipad", "Helipad", <Renderer>app.renderer),
  new Environment("footprint_court", "Footprint Court", <Renderer>app.renderer),
  new Environment("chromatic", "Chromatic", <Renderer>app.renderer),
  new Environment("field", "Field", <Renderer>app.renderer),
  new Environment("ennis", "Ennis", <Renderer>app.renderer),
  new Environment("papermill", "Papermill", <Renderer>app.renderer),
  new Environment("neutral", "Neutral", <Renderer>app.renderer)
]

for (let env of environments) {
  const item = document.createElement("a")
  item.innerText = env.displayName
  item.onclick = () => {
    currentEnvironment = env
    env.setAsLightingEnvironment(brdf, () => {
      setupScene(Cubemap.fromFaces(<CubemapFaces>env.diffuse))
    })
  }
  document.getElementById("environments-content")?.appendChild(item)
}

const sampler = new ImageBasedLightingSampler(<Renderer>app.renderer)
const brdf = sampler.createLUT(512)
const control = new CameraOrbitControl(app.view)

let currentEnvironment = environments[0]
currentEnvironment.setAsLightingEnvironment(brdf, () => {
  setupScene(Cubemap.fromFaces(<CubemapFaces>currentEnvironment.diffuse))
})

const setupScene = (cubemap: Cubemap) => {
  app.stage.removeChildren()
  if (!app.loader.resources["assets/sphere.gltf"]) {
    app.loader.add("assets/sphere.gltf")
  }
  // @ts-ignore
  app.stage.addChild(new Skybox(cubemap))
  app.loader.load(() => {
    // @ts-ignore
    const sphere = app.stage.addChild(Model.from(app.loader.resources["assets/sphere.gltf"].gltf))
    // @ts-ignore
    sphere.meshes[0].material.roughness = 0.3
  })
}