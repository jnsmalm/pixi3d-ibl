import { Renderer, Texture } from "@pixi/core"
import { Sprite } from "@pixi/sprite"
import * as JSZip from "jszip"
import { saveAs } from "file-saver"
import { ImageBasedLighting, LightingEnvironment } from "pixi3d"
import { Cubemap } from "./cubemap"
import { CubemapFaces } from "./cubemap-faces"
import { ImageBasedLightingSampler } from "./image-based-lighting-sampler"
import { CubemapPanorama } from "./cubemap-panorama"

export class Environment {
  private _imageBasedLighting?: ImageBasedLighting
  private _sampler = new ImageBasedLightingSampler(this.renderer)
  private _diffuse?: CubemapFaces
  private _specular?: CubemapFaces[]

  get diffuse() {
    return this._diffuse
  }

  constructor(public name: string, public displayName:string, public renderer: Renderer) { }

  loadEquirectangularPanorama(complete: (texture: Texture) => void) {
    // @ts-ignore
    const hdr: any = new HDRImage()
    hdr.onload = () => {
      complete(Texture.from(hdr))
    }
    hdr.src = "assets/" + this.name + ".hdr"
  }

  setAsLightingEnvironment(brdf: Texture, complete: () => void) {
    if (!this._imageBasedLighting) {
      this.loadEquirectangularPanorama(texture => {
        const cubemap = CubemapPanorama.createCubemap(this.renderer, texture, 512)
        this._specular = this._sampler.filterGGX(512, cubemap)
        this._diffuse = this._sampler.filterLambertian(512, cubemap)
        this._imageBasedLighting = new ImageBasedLighting(
          Cubemap.fromFaces(this._diffuse),
          Cubemap.fromFaces(this._specular), brdf)
        this.setAsLightingEnvironment(brdf, complete)
      })
    } else {
      complete()
      LightingEnvironment.main = new LightingEnvironment(
        this.renderer, this._imageBasedLighting)
    }
  }

  download(brdf: Texture) {
    if (!this._specular || !this._diffuse) return

    const zip = new JSZip()

    const saveToZip = (texture: Texture, filename: string) => {
      const sprite = new Sprite(texture)
      const image = this.renderer.plugins.extract.base64(sprite)
        .replace(/^data:image\/(png|jpg);base64,/, "")
      zip.file(filename, image, { base64: true })
    }

    zip.file("diffuse.cubemap",
      JSON.stringify(["diffuse_{{face}}.png"]))
      zip.file("specular.cubemap", JSON.stringify(this._specular.map((_, i) =>
      `specular_{{face}}_${i}.png`))
    )
    zip.file("skybox.cubemap",
      JSON.stringify(["specular_{{face}}_0.png"]))

    Cubemap.faces.forEach(face => {
      saveToZip(<Texture>(
        <CubemapFaces>this._diffuse)[face], `diffuse_${face}.png`)
    })
    saveToZip(brdf, "brdf.png")
    this._specular.forEach((n, i) => {
      Cubemap.faces.forEach(face => {
        saveToZip(<Texture>n[face], `specular_${face}_${i}.png`)
      })
    })
    zip.generateAsync({ type: "blob" }).then(content => {
      saveAs(content, this.name + ".zip")
    })
  }
}