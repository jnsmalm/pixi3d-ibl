import { Buffer, Geometry } from "@pixi/core"
import { MeshGeometry3D, MeshShader } from "pixi3d"

export class SampleShader extends MeshShader {
  createShaderGeometry(geometry: MeshGeometry3D) {
    let result = new Geometry()
    if (geometry.indices) {
      if (geometry.indices.buffer.BYTES_PER_ELEMENT === 1) {
        // PIXI seems to have problems with Uint8Array, let's convert to UNSIGNED_SHORT.
        result.addIndex(new Buffer(new Uint16Array(geometry.indices.buffer)))
      } else {
        result.addIndex(new Buffer(geometry.indices.buffer))
      }
    }
    if (geometry.positions) {
      result.addAttribute("in_position", new Buffer(geometry.positions.buffer),
        3, false, geometry.positions.componentType, geometry.positions.stride)
    }
    if (geometry.uvs && geometry.uvs[0]) {
      result.addAttribute("in_texCoord", new Buffer(geometry.uvs[0].buffer),
        2, false, geometry.uvs[0].componentType, geometry.uvs[0].stride)
    }
    return result
  }
}