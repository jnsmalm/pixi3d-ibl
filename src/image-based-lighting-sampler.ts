import { CubeMipmapTexture, Mesh3D } from "pixi3d"
import { BaseTexture, BufferResource, FORMATS, Program, Renderer, RenderTexture, Shader, Texture, TYPES } from "pixi.js"
import { SampleShader } from "./sample-shader"
import { FloatBufferResource } from "./float-buffer-resource"

export class ImageBasedLightingSampler {
  private _mesh: Mesh3D

  constructor(public renderer: Renderer) {
    this._mesh = Mesh3D.createQuad()
  }

  render(faces: number, textureSize: number, uniforms: (face: number, shader: Shader) => void) {
    const vert = require("./shader/fullscreen.vert").default
    const frag = require("./shader/ibl_filter.frag").default

    const shader = new SampleShader(Program.from(vert, frag))

    const textures: Texture[] = []

    for (let i = 0; i < faces; i++) {
      const renderTexture = RenderTexture.create({ width: textureSize, height: textureSize, format: FORMATS.RGBA, type: TYPES.FLOAT })
      this.renderer.renderTexture.bind(renderTexture)

      uniforms(i, shader)
      shader.render(this._mesh, this.renderer)

      const pixels = new Float32Array(4 * textureSize * textureSize)
      this.renderer.gl.readPixels(0, 0, textureSize, textureSize,
        this.renderer.gl.RGBA, this.renderer.gl.FLOAT, pixels)
      textures.push(new Texture(new BaseTexture(
        new FloatBufferResource(pixels, { width: textureSize, height: textureSize }, this.renderer.gl.RGBA32F), {
        format: FORMATS.RGBA,
        type: TYPES.FLOAT
      })))
      this.renderer.renderTexture.bind(undefined)
    }
    return textures
  }

  filterLambertian(size: number, cubemap: CubeMipmapTexture, sampleCount = 2048) {
    const textures = this.render(6, size, (face, shader) => {
      shader.uniforms.u_width = size
      shader.uniforms.u_currentFace = face
      shader.uniforms.u_lodBias = 0
      shader.uniforms.u_distribution = 0
      shader.uniforms.u_roughness = 0
      shader.uniforms.uCubeMap = cubemap
      shader.uniforms.u_sampleCount = sampleCount
      shader.uniforms.u_isGeneratingLUT = 0
    })
    return {
      posx: textures[0], negx: textures[1], posy: textures[2], negy: textures[3], posz: textures[4], negz: textures[5]
    }
  }

  createLUT(size: number, sampleCount = 512) {
    const textures = this.render(1, size, (_, shader) => {
      shader.uniforms.u_sampleCount = sampleCount
      shader.uniforms.u_distribution = 1
      shader.uniforms.u_isGeneratingLUT = 1
    })
    return textures[0]
  }

  filterGGX(size: number, cubemap: CubeMipmapTexture, sampleCount = 1024) {
    const mipmaps: any[] = []
    const mipmapLevels = 1 + Math.floor(Math.log2(Math.max(size, size, 1)))

    for (var i = 0; i < mipmapLevels; i++) {
      const textures = this.render(6, size >> i, (face, shader) => {
        shader.uniforms.u_width = size >> i
        shader.uniforms.u_currentFace = face
        shader.uniforms.u_lodBias = 0
        shader.uniforms.u_distribution = 1
        shader.uniforms.u_roughness = i / (mipmapLevels - 1)
        shader.uniforms.uCubeMap = cubemap
        shader.uniforms.u_sampleCount = sampleCount
        shader.uniforms.u_isGeneratingLUT = 0
      })
      mipmaps.push({
        posx: textures[0], negx: textures[1], posy: textures[2], negy: textures[3], posz: textures[4], negz: textures[5]
      })
    }
    return mipmaps
  }
}