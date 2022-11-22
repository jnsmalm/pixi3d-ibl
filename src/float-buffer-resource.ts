import { ALPHA_MODES, BaseTexture, FORMATS, GLTexture, ISize, Renderer, Resource, TARGETS } from "pixi.js";

export class FloatBufferResource extends Resource {
  /** Source array Cannot be ClampedUint8Array because it cant be uploaded to WebGL */
  data: Float32Array | Uint8Array | Uint16Array | Int32Array | Uint32Array;
  /**
   * @param source - Source buffer
   * @param options - Options
   * @param {number} options.width - Width of the texture
   * @param {number} options.height - Height of the texture
   */
  constructor(source: Float32Array | Uint8Array | Uint16Array | Int32Array | Uint32Array, options: ISize, public internalFormat: number) {
    super(options.width, options.height);
    const { width, height } = options || {};
    if (!width || !height) {
      throw new Error('BufferResource width or height invalid');
    }
    this.data = source;
  }
  /**
   * Upload the texture to the GPU.
   * @param renderer - Upload to the renderer
   * @param baseTexture - Reference to parent texture
   * @param glTexture - glTexture
   * @returns - true is success
   */
  upload(renderer: Renderer, baseTexture: BaseTexture, glTexture: GLTexture): boolean {
    const gl = renderer.gl;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, baseTexture.alphaMode === ALPHA_MODES.UNPACK);
    const width = baseTexture.realWidth;
    const height = baseTexture.realHeight;
    if (glTexture.width === width && glTexture.height === height) {
      gl.texSubImage2D(
        <TARGETS>baseTexture.target,
        0,
        0,
        0,
        width,
        height,
        renderer.gl.RGBA, //<FORMATS>baseTexture.format,
        renderer.gl.FLOAT, // glTexture.type,
        this.data
      );
    }
    else {
      glTexture.width = width;
      glTexture.height = height;
      gl.texImage2D(
        <TARGETS>baseTexture.target,
        0,
        this.internalFormat, //glTexture.internalFormat,
        width,
        height,
        0,
        <FORMATS>baseTexture.format,
        glTexture.type,
        this.data
      )
    }
    return true;
  }
  /** Destroy and don't use after this. */
  dispose(): void {
    // @ts-ignore
    this.data = null;
  }
  /**
   * Used to auto-detect the type of resource.
   * @param {*} source - The source object
   * @returns {boolean} `true` if <canvas>
   */
  static test(source: unknown): source is Float32Array | Uint8Array | Uint32Array {
    return source instanceof Float32Array
      || source instanceof Uint8Array
      || source instanceof Uint32Array;
  }
}