import * as PIXI from "pixi.js"

import { ArrayResource, BaseImageResource, BufferResource, Resource } from "pixi.js"
import { FloatBufferResource } from "./float-buffer-resource"

export class MipmapResource extends ArrayResource {
  constructor(source: (string | PIXI.Texture)[], public target: number) {
    super(source)
  }

  upload(renderer: PIXI.Renderer, baseTexture: PIXI.BaseTexture) {
    for (let i = 0; i < this.items.length; i++) {
      const resource = this.items[i].resource
      
      if (resource instanceof FloatBufferResource) {
        // renderer.gl.texImage2D(this.target, i, <PIXI.FORMATS>baseTexture.format,
        //   // @ts-ignore
        //   resource.width, resource.height, 0, <PIXI.FORMATS>baseTexture.format, <PIXI.TYPES>baseTexture.type, resource.data)

        // @ts-ignore
        renderer.gl.texImage2D(this.target, i, renderer.gl.RGBA32F,
          // @ts-ignore
          resource.width, resource.height, 0, PIXI.FORMATS.RGBA, PIXI.TYPES.FLOAT, resource.data)
      }
      else if (resource instanceof BufferResource || true) {
        renderer.gl.texImage2D(this.target, i, <PIXI.FORMATS>baseTexture.format,
          // @ts-ignore
          resource.width, resource.height, 0, <PIXI.FORMATS>baseTexture.format, <PIXI.TYPES>baseTexture.type, resource.data)
      }
      if (resource instanceof BaseImageResource) {
        renderer.gl.texImage2D(this.target, i, <PIXI.FORMATS>baseTexture.format,
          <PIXI.FORMATS>baseTexture.format, <PIXI.TYPES>baseTexture.type, resource.source)
      }
    }
    return true
  }
}