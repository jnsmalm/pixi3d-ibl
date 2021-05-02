import { BaseTexture, BufferResource, Program, Renderer, RenderTexture, Texture } from "pixi.js"
import { Mesh3D } from "pixi3d"
import { Cubemap } from "./cubemap"
import { SampleShader } from "./sample-shader"

export class CubemapPanorama {
  static createCubemap(renderer: Renderer, panorama: Texture, size: number) {
    if (renderer.context.webGLVersion === 1) {
      let extensions = ["EXT_shader_texture_lod"]
      for (let ext of extensions) {
        if (!renderer.gl.getExtension(ext)) {
          console.warn(`PIXI3D: Extension "${ext}" is not supported by current platform, the material may not be displayed correctly.`)
        }
      }
    }

    const shader = new SampleShader(Program.from(
      require("./shader/fullscreen.vert").default, require("./shader/panorama_to_cubemap.frag").default))
    const faces: Texture[] = []
    const mesh = Mesh3D.createQuad()

    for (let i = 0; i < 6; i++) {
      const renderTexture = RenderTexture.create({ width: size, height: size })
      renderer.renderTexture.bind(renderTexture)

      shader.uniforms.u_currentFace = i
      shader.uniforms.u_panorama = panorama
      shader.render(mesh, renderer)

      const pixels = new Uint8Array(4 * renderTexture.width * renderTexture.height)
      renderer.gl.readPixels(0, 0, renderTexture.width, renderTexture.height,
        renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels)
      faces.push(new Texture(new BaseTexture(
        new BufferResource(pixels, { width: renderTexture.width, height: renderTexture.height }))))
    }

    mesh.destroy()

    return Cubemap.fromFaces({
      posx: faces[0],
      negx: faces[1],
      posy: faces[2],
      negy: faces[3],
      posz: faces[4],
      negz: faces[5],
    })
  }
}