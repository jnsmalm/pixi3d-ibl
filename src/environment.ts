import { Renderer, Texture, BaseTexture, RenderTexture, Shader, Program } from "@pixi/core"
import { Sprite } from "@pixi/sprite"
import * as JSZip from "jszip"
import { saveAs } from "file-saver"
import { ImageBasedLighting, LightingEnvironment, Material, Mesh3D, MeshShader } from "pixi3d"
import { Cubemap } from "./cubemap"
import { CubemapFaces } from "./cubemap-faces"
import { ImageBasedLightingSampler } from "./image-based-lighting-sampler"
import { CubemapPanorama } from "./cubemap-panorama"
import { ALPHA_MODES, FORMATS, MIPMAP_MODES, TYPES } from "pixi.js"
import { FloatBufferResource } from "./float-buffer-resource"

export class Environment {
  private _imageBasedLighting?: ImageBasedLighting
  private _sampler = new ImageBasedLightingSampler(this.renderer)
  private _diffuse?: CubemapFaces
  private _specular?: CubemapFaces[]

  get diffuse() {
    return this._diffuse
  }

  get specular() {
    return this._specular
  }

  constructor(public url: string, public displayName: string, public renderer: Renderer, public isRGBE = true) { }

  loadEquirectangularPanorama(complete: (texture: Texture) => void) {
    // @ts-ignore
    const hdr: any = new HDRImage()
    hdr.onload = () => {
      if (this.isRGBE) {
        let baseTexture = new BaseTexture(new FloatBufferResource(hdr.dataFloat, { width: hdr.width, height: hdr.height }, this.renderer.gl.RGB32F), {
          format: FORMATS.RGB,
          type: TYPES.FLOAT
        })
        baseTexture.mipmap = MIPMAP_MODES.OFF
        let hdrTexture = new Texture(baseTexture)
        complete(hdrTexture)
      } else {
        complete(Texture.from(hdr))
      }
    }
    hdr.src = this.url
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

  download(brdf: Texture, rgbe = false, exposure = 1) {
    if (!this._specular || !this._diffuse) return

    const zip = new JSZip()

    const extractPixelsFromRenderTexture = (renderTexture: RenderTexture) => {
      let renderer = (this.renderer as Renderer);
      renderer.renderTexture.bind(renderTexture);
      const webglPixels = new Uint8ClampedArray(4 * renderTexture.width * renderTexture.height);
      const gl = renderer.gl
      gl.readPixels(0, 0, renderTexture.width, renderTexture.height,
        gl.RGBA, gl.UNSIGNED_BYTE, webglPixels);
      return webglPixels
    }

    const encodeVert = `#version 300 es

      precision highp int;
      precision highp float;

      in vec3 a_Position;
      in vec2 a_UV1;

      out vec2 v_UV1;

      void main() {
        v_UV1 = a_UV1;
        gl_Position = vec4(a_Position, 1.0);
      }
    `;

    const encodeFrag = `#version 300 es

      precision highp float;

      in vec2 v_UV1;

      out vec4 outColor;

      uniform sampler2D u_Texture;
      uniform bool u_RGBE;
      uniform float u_Exposure;

      vec4 encodeRGBE(vec3 rgb) {
        vec4 vEncoded;
        float maxComponent = max(max(rgb.r, rgb.g), rgb.b);
        float fExp = ceil(log2(maxComponent));
        vEncoded.rgb = rgb / exp2(fExp);
        vEncoded.a = (fExp + 128.0) / 255.0;
        return vEncoded;
      }

      void main() {
        vec2 uv = vec2(v_UV1.x, 1.0 - v_UV1.y);
        vec4 color = texture(u_Texture, uv);
        if (u_RGBE) {
          outColor = encodeRGBE(color.rgb * u_Exposure);
        } else {
          outColor = vec4(color.rgb * u_Exposure, 1.0);
        }
      }
    `;

    class EncodeMaterial extends Material {
      exposure = 1
      rgbe = false

      constructor(public texture: Texture) {
        super()
      }

      createShader() {
        return new MeshShader(Program.from(encodeVert, encodeFrag))
      }

      updateUniforms(mesh: Mesh3D, shader: Shader) {
        shader.uniforms.u_Texture = this.texture
        shader.uniforms.u_RGBE = this.rgbe
        shader.uniforms.u_Exposure = this.exposure
      }
    }

    let encodeMaterial = new EncodeMaterial(Texture.EMPTY)
    const encodeQuad = Mesh3D.createQuad(encodeMaterial)

    const saveToZip = (texture: Texture, filename: string, encodeToRGBE = true, exposure = 1) => {
      const renderTexture = RenderTexture.create({
        width: texture.width,
        height: texture.height,
        format: FORMATS.RGBA,
        type: TYPES.UNSIGNED_BYTE,
        alphaMode: ALPHA_MODES.NO_PREMULTIPLIED_ALPHA
      })
      encodeMaterial.texture = texture
      encodeMaterial.rgbe = encodeToRGBE
      encodeMaterial.exposure = exposure
      this.renderer.render(encodeQuad, { renderTexture });
      const pixels = extractPixelsFromRenderTexture(renderTexture)
      const imageData = new ImageData(pixels, texture.width, texture.height)
      let canvas = document.createElement("canvas")
      canvas.width = texture.width
      canvas.height = texture.height
      let context = canvas.getContext("2d")
      context?.putImageData(imageData, 0, 0)
      const base64 = canvas.toDataURL("image/png")
        .replace(/^data:image\/(png|jpg);base64,/, "")
      zip.file(filename, base64, { base64: true })
    }

    zip.file("diffuse.cubemap", JSON.stringify({
      version: 2,
      mipmaps: ["diffuse_{{face}}.png"],
      format: rgbe ? "rgbe8" : "ldr"
    }, undefined, 2))

    zip.file("specular.cubemap", JSON.stringify({
      version: 2,
      mipmaps: this._specular.map((_, i) =>
        `specular_{{face}}_${i}.png`
      ),
      format: rgbe ? "rgbe8" : "ldr"
    }, undefined, 2))

    zip.file("skybox.cubemap", JSON.stringify({
      version: 2,
      mipmaps: ["specular_{{face}}_0.png"],
      format: rgbe ? "rgbe8" : "ldr"
    }, undefined, 2))

    Cubemap.faces.forEach(face => {
      saveToZip(<Texture>(
        <CubemapFaces>this._diffuse)[face], `diffuse_${face}.png`, rgbe, exposure)
    })
    saveToZip(brdf, "brdf.png", false)
    this._specular.forEach((n, i) => {
      Cubemap.faces.forEach(face => {
        saveToZip(<Texture>n[face], `specular_${face}_${i}.png`, rgbe, exposure)
      })
    })
    zip.generateAsync({ type: "blob" }).then(content => {
      saveAs(content, this.displayName.toLowerCase() + ".zip")
    })
  }
}