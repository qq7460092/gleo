/**
 * @class AbstractAttributeSet
 *
 * Represents a set of attribute data for vertices (each set being a small slice
 * of contiguous memory), plus some niceties to add/modify records.
 *
 * Internally this represents a `gl.ARRAY_BUFFER` at the WebGL level, or a Vertex Buffer
 * Object (VBO) at the OpenGL level. It also includes the VertexAttrib call(s) needed
 * to use the attribute(s) contained here (since this is WebGL1 and there are no Vertex
 * Array Objects/VAOs, which would cache this).
 *
 * Note that an `AbstractAttributeSet` might correspond to just one attribute (and
 * offer the `BindableAttribute` interface), or several attributes (and do not offer
 * the `BindableAttribute` interface, but rather have properties of setters for such).
 *
 * This is the base abstract class - record size (amount of data per vertex)
 * for this class is zero.
 *
 */
class AbstractAttributeSet {
	constructor(gl, options = {}, recordSize = 0) {
		this._gl = gl;

		// Size of each record, in bytes. Must be set internally in each subclass.
		this._recordSize = recordSize;

		// @option size: Number = 255
		// Maximum number of records (vertices) to hold
		this._size = options.size || 255;

		// @option growFactor: Boolean = false
		// Specifies that the size of this attribute buffer is static.
		// @alternative growFactor: Number
		// When `growFactor` is a `Number`, the size of this attribute buffer will
		// grow by that factor (e.g. a factor of 2 means the buffer doubles its size each
		// time the size is insufficient)
		this._growFactor = options.growFactor;

		// @option usage: GLenum = gl.STATIC_DRAW
		// One of `gl.STATIC_DRAW`, `gl.DYNAMIC_DRAW` or `gl.STREAM_DRAW`.
		// See the documentation of the `usage` parameter at
		// [WebGL's `bufferData`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/bufferData)
		// for more details.
		this._usage = options.usage || gl.STATIC_DRAW;

		// Create a WebGL ARRAY_BUFFER with (record count) * (bytes per record) bytes
		this._buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
		gl.bufferData(gl.ARRAY_BUFFER, this._recordSize * this._size, this._usage);

		if (this._growFactor) {
			// Growable attribute buffers need to store all the data in a
			// readable data structure, in order to call `bufferData` with
			// the new size without destroying data.
			// 			this._arrayBuf = new ArrayBuffer(this._recordSize * this._size);
			this._byteData = new Uint8Array(this._recordSize * this._size);
		}
	}

	// Maps a string containing a GLSL type to its number of components.
	static GLSL_TYPE_COMPONENTS = {
		float: 1,
		vec2: 2,
		vec3: 3,
		vec4: 4,
		// mat2: 4,
		// mat3: 9,
		// mat4: 16,
	};

	/**
	 * @section Batch update methods
	 * @method commit(index, length): this
	 * Dumps the contents of the data in RAM into GPU memory. Will dump a
	 * contiguous section of memory, for a block of vertices starting at `index`
	 * and with the given `length`.
	 *
	 * Will fail if the attribute set has been created with a `growFactor` of zero.
	 */
	commit(index, length) {
		const gl = this._gl;
		const addr = this._recordSize * index;
		const size = this._recordSize * length;
		const data = new Uint8Array(this._byteData.buffer, addr, size);

		if (!isFinite(addr) || !isFinite(size)) {
			throw new Error("Cannot commit attribute data witn non-finite start/length");
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
		gl.bufferSubData(gl.ARRAY_BUFFER, addr, data);

		return this;
	}

	/**
	 * @section Internal methods
	 * @method set(index: Number, offset: Number, data: ArrayBufferView): this
	 *
	 * Uploads the given `data` to GPU memory, given the vertex `index` and the byte
	 * `offset` into that record.
	 *
	 * It can be used to update one record at a time (passing a record-full of `data`),
	 * one attribute field (less than a record-full of data, specifying `offset`), or several
	 * contiguous records.
	 *
	 * The input `data` is *expected* to be in the same byte format than the expected
	 * storage; subclasses do this by coercing `TypeArray`s of specific sizes. Users
	 * wanting to dump binary data using this method are advised to pay attention to
	 * the way the data is packed.
	 *
	 * Will grow self if allowed by `grow` when `index` is larger than the current size.
	 * @alternative
	 * @method set(index: Number, offset: Number, data: ArrayBuffer): this
	 * In addition to `TypedArray`s of any kind and `DataView`s, this method can
	 * also take `ArrayBuffer`s.
	 */
	setBytes(index, offset, data) {
		// if (index >= this._size) {
		const upperIndex =
			index + Math.floor((data.byteLength + offset) / this._recordSize);
		if (upperIndex > this._size) {
			this._grow(upperIndex);
		}

		const gl = this._gl;
		//if (gl.getParameter(gl.ARRAY_BUFFER_BINDING) !== this._buf) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
		//}

		const addr = this._recordSize * index + offset;

		gl.bufferSubData(gl.ARRAY_BUFFER, addr, data);

		if (this._byteData) {
			if (data instanceof ArrayBuffer) {
				this._byteData.set(new Uint8Array(data), addr);
			} else {
				this._byteData.set(
					new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
					addr
				);
			}
		}
		return this;
	}

	// Internal use only - grows the size of both the JS RAM `ArrayBuffer` and the
	// in-GPU GL arraybuffer/VBO.
	// Copies everything from the RAM-held copy `this._byteData`, then creates a
	// new, bigger RAM-held copy.
	_grow(minimum) {
		if (!this._growFactor) {
			throw new Error(
				`Non-growable attribute buffer can only hold ${
					this._size
				} records, but tried to set ${minimum + 1}-th record.`
			);
		}
		this._size = Math.max(minimum + 1, Math.ceil(this._size * this._growFactor));

		const newByteData = new Uint8Array(this._recordSize * this._size);
		newByteData.set(this._byteData, 0);
		this._byteData = newByteData;

		const gl = this._gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
		gl.bufferData(gl.ARRAY_BUFFER, this._byteData, this._usage);
	}
}

var constantNames = [
	/**
	 * @class Glii
	 * @section Buffer usage constants
	 * @aka Buffer usage constant
	 *
	 * Used in the `usage` option of `IndexBuffer`s and `AbstractAttributeSet`s,
	 * these allegedly tell the hardware which region of GPU memory the data should
	 * be into.
	 *
	 * @property STATIC_DRAW: Number
	 * Hints the hardware that the contents of the buffer are likely to be used often
	 * and not change often.
	 * @property DYNAMIC_DRAW: Number
	 * Hints the hardware that the contents of the buffer are likely to be used often
	 * and change often.
	 * @property STREAM_DRAW: Number
	 * Hints the hardware that the contents of the buffer are likely to not be used often.
	 */
	"STATIC_DRAW",
	"DYNAMIC_DRAW",
	"STREAM_DRAW",

	/**
	 * @section Data type constants
	 * @aka Data type constant
	 *
	 * Used in the `type` option of `IndexBuffer`s.
	 *
	 * Note that `BindableAttribute`s infer the data type from the subclass of `TypedArray`.
	 *
	 * @property BYTE: Number; 8-bit integer, complement-2 signed
	 * @property UNSIGNED_BYTE: Number; 8-bit integer, unsigned
	 * @property SHORT: Number; 16-bit integer, complement-2 signed
	 * @property UNSIGNED_SHORT: Number; 16-bit integer, unsigned
	 * @property INT: Number; 32-bit integer, complement-2 signed
	 * @property UNSIGNED_INT: Number; 32-bit integer, unsigned
	 * @property FLOAT: Number; 32-bit IEEE754 floating point
	 */
	"BYTE",
	"UNSIGNED_BYTE",
	"SHORT",
	"UNSIGNED_SHORT",
	"INT",
	"UNSIGNED_INT",
	"FLOAT",

	/**
	 * @section Texture pixel type constants
	 * @aka Texture pixel type constant
	 *
	 * Used in the `type` option of `Texture`s, for the `type` parameter of `texImage2D` calls.
	 *
	 * Note that, in WebGL1, some values are only valid when an extension is loaded. See
	 * [`WEBGL_depth_texture`](https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_depth_texture.html),
	 * [`OES_texture_float`](https://developer.mozilla.org/en-US/docs/Web/API/OES_texture_float.html), and
	 * [`OES_texture_half_float`](https://developer.mozilla.org/en-US/docs/Web/API/OES_texture_half_float.html).
	 *
	 * @property UNSIGNED_BYTE: Number; 8-bit integer, unsigned
	 * @property UNSIGNED_SHORT_5_6_5: Number; 5 red bits, 6 green bits, 5 blue bits.
	 * @property UNSIGNED_SHORT_4_4_4_4: Number; 4 red bits, 4 green bits, 4 blue bits, 4 alpha bits.
	 * @property UNSIGNED_SHORT_5_5_5_1: Number; 5 red bits, 5 green bits, 5 blue bits, 1 alpha bit.
	 * @property UNSIGNED_SHORT: Number; 16-bit integer, unsigned
	 * @property UNSIGNED_INT: Number; 32-bit integer, unsigned
	 * @property FLOAT: Number; 32-bit IEEE754 floating point
	 */

	//"UNSIGNED_BYTE",
	"UNSIGNED_SHORT_5_6_5",
	"UNSIGNED_SHORT_4_4_4_4",
	"UNSIGNED_SHORT_5_5_5_1",
	//"UNSIGNED_SHORT",
	//"UNSIGNED_INT",
	//"FLOAT",

	/**
	 * @section Draw mode constants
	 * @aka Draw mode constant
	 *
	 * Used in the `drawMode` option of `SequentialIndices`, `IndexBuffer` and
	 * `SparseIndices`. Determines how vertices (pointed by their indices) form draw
	 * primitives.
	 *
	 * See [primitives in the OpenGL wiki](https://www.khronos.org/opengl/wiki/Primitive)
	 * and [`drawElements` in Mozilla dev network](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawElements).
	 *
	 * @property POINTS: Number; Each vertex is drawn as a single point.
	 * @property LINES: Number; Each set of two vertices is drawn as a line segment.
	 * @property LINE_LOOP: Number
	 * Each vertex connects to the next with a line segment. The last vertex connects to
	 * the first.
	 * @property LINE_STRIP: Number
	 * Draw a line segment from the first vertex to each of the other vertices
	 * @property TRIANGLES: Number
	 * Each set of three vertices is drawn as a triangle (0-1-2, then 3-4-5, 6-7-8, etc)
	 * @property TRIANGLE_STRIP: Number
	 * Each group of three adjacent vertices is drawn as a triangle (0-1-2, then 2-3-4,
	 * 3-4-5, etc). See [triangle strip on wikipedia](https://en.wikipedia.org/wiki/Triangle_strip)
	 * @property TRIANGLE_FAN: Number
	 * The first vertex plus each group of two adjacent vertices is drawn as a triangle.
	 * See [triangle fan on wikipedia](https://en.wikipedia.org/wiki/Triangle_fan)
	 */
	"POINTS",
	"LINES",
	"LINE_LOOP",
	"LINE_STRIP",
	"TRIANGLES",
	"TRIANGLE_STRIP",
	"TRIANGLE_FAN",

	/**
	 * @section Texture format constants
	 * @aka Texture format constant
	 *
	 * Determines the [image format](https://www.khronos.org/opengl/wiki/Image_Format)
	 * of a `Texture`. Used in a `Texture`'s `format`&`internalFormat` options&properties.
	 *
	 * Some of these are only available when using a WebGL2 context. In some
	 * cases, a few of the WebGL2-only formats are available when using a WebGL1
	 * extension such as `OES_texture_float`.
	 *
	 * See https://registry.khronos.org/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
	 *
	 * @property RGB: Number; Texture holds red, green and blue components.
	 * @property RGBA: Number; Texture holds red, green, blue and alpha components.
	 * @property ALPHA: Number; Texture holds only an alpha component
	 * @property LUMINANCE: Number
	 * Texture holds only a luminance component. This effectively makes the texture greyscale.
	 * @property LUMINANCE_ALPHA: Number
	 * Texture holds luminance and alpha. This effectively makes the texture grayscale with
	 * transparency.
	 * @property RED: Number; WebGL2 only. Texture holds red component only.
	 * @property RG: Number
	 * WebGL2 only. Texture holds red and green components only.
	 * @property RED_INTEGER
	 * WebGL2 only. Texture holds integers in its red component.
	 * @property RG_INTEGER
	 * WebGL2 only. Texture holds integer in its red and green components.
	 * @property RGB_INTEGER
	 * WebGL2 only. Texture holds integer in its red, green and blue components.
	 * @property RGBA_INTEGER
	 * WebGL2 only. Texture holds integer in its red, green, blue and alpha components.
	 *
	 */
	"ALPHA",
	"RGB",
	"RGBA",
	"LUMINANCE",
	"LUMINANCE_ALPHA",

	"RED",
	"RG",
	"RED_INTEGER",
	"RG_INTEGER",
	"RGB_INTEGER",
	"RGBA_INTEGER",

	/**
	 * @section Texture interpolation constants
	 * @aka Texture interpolation constant
	 *
	 * Determines the behaviour of texel interpolation (when a fragment shader requests
	 * a texel coordinate which falls between several texels). This is used in the
	 * `minFilter` and `maxFilter` options&properties of `Texture`s.
	 *
	 * See [sampler filtering on the OpenGL wiki](https://www.khronos.org/opengl/wiki/Sampler_Object#Filtering)
	 *
	 * @property NEAREST: Number; Nearest-texel interpolation
	 * @property LINEAR: Number; Linear interpolation between texels
	 * @property NEAREST_MIPMAP_NEAREST: Number
	 * Nearest-texel interpolation, in the nearest mipmap
	 * @property LINEAR_MIPMAP_NEAREST: Number
	 * Linear interpolation between texels, in the nearest mipmap
	 * @property NEAREST_MIPMAP_LINEAR: Number
	 * Nearest-texel interpolation, in a linearly-interpolatex mipmap
	 * @property LINEAR_MIPMAP_LINEAR: Number
	 * Linear interpolation between texels, in a linearly-interpolated mipmap
	 */
	"NEAREST",
	"LINEAR",
	"NEAREST_MIPMAP_NEAREST",
	"LINEAR_MIPMAP_NEAREST",
	"NEAREST_MIPMAP_LINEAR",
	"LINEAR_MIPMAP_LINEAR",

	/**
	 * @section Texture wrapping constants
	 * @aka Texture wrapping constant
	 *
	 * Used in the `wrapS`/`wrapT` options of a `Texture`.
	 *
	 * Determines the behaviour of texel sampling when the requested texel is outside
	 * the bounds of the `Texture` (i.e. when the texel coordinate is outside the
	 * [0..1] range).
	 *
	 * See [https://learnopengl.com/Getting-started/Textures](https://learnopengl.com/Getting-started/Textures)
	 * for an illustrative example.
	 *
	 * @property REPEAT: Number; Texture repeats.
	 * @property CLAMP_TO_EDGE: Number
	 * Texels from the edge of the texture are used outside.
	 * @property MIRRORED_REPEAT: Number
	 * Texture repeats but is mirrored on every odd occurence.
	 */
	"REPEAT",
	"CLAMP_TO_EDGE",
	"MIRRORED_REPEAT",

	/**
	 * @section Renderbuffer format constants
	 * @aka Renderbuffer format constant
	 *
	 * Determines the internal format of a `RenderBuffer` (to be attached as
	 * either/both the depth component and/or the stencil component of a
	 * framebuffer).
	 *
	 * See [`renderBufferStorage`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/renderbufferStorage)
	 *
	 * Some of these are only available when using a WebGL2 context. (In some
	 * cases, a few of the WebGL2-only formats are available when using a WebGL1
	 * extension such as `WEBGL_depth_texture`).
	 *
	 * @property RGBA4: Number;  4 red bits, 4 green bits, 4 blue bits 4 alpha bits.
	 * @property RGB565: Number;  5 red bits, 6 green bits, 5 blue bits.
	 * @property RGB5_A1: Number;  5 red bits, 5 green bits, 5 blue bits, 1 alpha bit.
	 * @property DEPTH_COMPONENT16: Number; Renderbuffer holds 16 bits of depth
	 * @property STENCIL_INDEX8: Number; Renderbuffer holds 8 bits of stencil
	 * @property DEPTH_STENCIL: Number; Renderbuffer holds both depth and stencil
	 * (implementation-dependant; can be assumed to hold *at least* 16 bits of depth
	 * and 8 bits of stencil on WebGL1; in WebGL2 it should behave as `DEPTH24_STENCIL8`)
	 * @property DEPTH_COMPONENT24: Number; Renderbuffer holds 24 bits of depth
	 * (WebGL2 only).
	 * @property DEPTH_COMPONENT32F: Number; Renderbuffer holds depth as 32-bit
	 * floating point (WebGL2 only).
	 * @property DEPTH24_STENCIL8: Number; Renderbuffer holds 24 bits of depth
	 * and 8 bits of stencil (WebGL2 only).
	 * @property DEPTH32F_STENCIL8: Number; Renderbuffer holds depth as 32-bit
	 * @property R32I: Number; Renderbuffer holds depth as 32-bit signed
	 * integer.
	 */
	"RGBA4",
	"RGB565",
	"RGB5_A1",

	"DEPTH_COMPONENT16",	//0x81A5
	"STENCIL_INDEX8",	//0x8D48
	"DEPTH_STENCIL",	//0x84F9

	"DEPTH_COMPONENT24",
	"DEPTH_COMPONENT32F",
	"DEPTH24_STENCIL8",
	"DEPTH32F_STENCIL8",

	"R32I",

	/**
	 * @section Comparison constants
	 * @aka Comparison constant
	 *
	 * Used in the `depth` option of `WebGL1Program`.
	 *
	 * Use `glii.ALWAYS` to disable depth testing. Otherwise, the most usual
	 * value is `glii.LEQUAL` or `glii.LESS`, to render fragments with a lower
	 * `z` component of their `gl_Position` ("closer to the camera") over fragments
	 * with a higher `z`.
	 *
	 * See [depth testing in learnopengl.com](https://learnopengl.com/Advanced-OpenGL/Depth-testing).
	 *
	 * @property NEVER: Number; Always fails (i.e. shall drop all fragments).
	 * @property ALWAYS: Number; Disables depth testing.
	 * @property LESS: Number
	 * Render fragments that have a lower `z` ("closer to the camera") over others.
	 * @property LEQUAL: Number
	 * As `LESS`, but also renders fragments with the same `z`.
	 * @property GREATER: Number
	 * Render fragments that have a higher `z` ("further away from the camera") over others.
	 * @property GEQUAL: Number
	 * As `GREATER`, but also renders fragments with the same `z`.
	 * @property EQUAL: Number
	 * Only render fragments with the same `z` as the depth buffer value.
	 * @property NOTEQUAL: Number; Opposite of `EQUAL`.
	 */
	"NEVER",
	"ALWAYS",
	"LESS",
	"LEQUAL",
	"GREATER",
	"GEQUAL",
	"EQUAL",
	"NOTEQUAL",

	/**
	 * @section Blend equation constants
	 * @aka Blend equation constant
	 *
	 * Used in the `blend` option of `WebGL1Program`.
	 *
	 * Defines which kind of arithmetic operation is applied to the RGB and Alpha
	 * channels of fragments when they need to be blended together (i.e. when
	 * two or more fragments from several triangles have the same `x,y` position
	 * in the output framebuffer)
	 *
	 * See `WebGLRenderingContext`'s [`blendEquationSeparate`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendEquationSeparate)
	 *
	 * @property FUNC_ADD: Number; source + destination
	 * @property FUNC_SUBTRACT: Number; source - destination
	 * @property FUNC_REVERSE_SUBTRACT: Number; destination - source
	 * @property MIN: Number; Minimum of source and destination
	 * @property MAX: Number; Maximum of source and destination
	 */
	"FUNC_ADD",
	"FUNC_SUBTRACT",
	"FUNC_REVERSE_SUBTRACT",
	"MIN",
	"MAX",

	/**
	 * @section Blend factor constants
	 * @aka Blend factor constant
	 *
	 * Used in the `blend` option of `WebGL1Program`.
	 *
	 * Defines what factors shall multiply the RGB and Alpha components of
	 * overlapping fragments just prior to applying the "blend equation" operation.
	 *
	 * See `WebGLRenderingContext`'s [`blendFuncSeparate`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendFuncSeparate)
	 * @property ZERO: Number; Multiplies all colors by 0.
	 * @property ONE: Number; Multiplies all colors by 1.
	 * @property SRC_COLOR: Number; Multiplies all colors by the source colors.
	 * @property ONE_MINUS_SRC_COLOR: Number; Multiplies all colors by 1 minus each source color.
	 * @property DST_COLOR: Number; Multiplies all colors by the destination color.
	 * @property ONE_MINUS_DST_COLOR: Number; Multiplies all colors by 1 minus each destination color.
	 * @property SRC_ALPHA: Number; Multiplies all colors by the source alpha color.
	 * @property ONE_MINUS_SRC_ALPHA: Number; Multiplies all colors by 1 minus the source alpha color.
	 * @property DST_ALPHA: Number; Multiplies all colors by the destination alpha color.
	 * @property ONE_MINUS_DST_ALPHA: Number; Multiplies all colors by 1 minus the destination alpha color.
	 * @property CONSTANT_COLOR: Number; Multiplies all colors by a constant color.
	 * @property ONE_MINUS_CONSTANT_COLOR: Number; Multiplies all colors by 1 minus a constant color.
	 * @property CONSTANT_ALPHA: Number; Multiplies all colors by a constant alpha value.
	 * @property ONE_MINUS_CONSTANT_ALPHA: Number; Multiplies all colors by 1 minus a constant alpha value.
	 * @property SRC_ALPHA_SATURATE: Number; Multiplies the RGB colors by the smaller of either the source alpha color or the value of 1 minus the destination alpha color. The alpha value is multiplied by 1.
	 *
	 */
	"ZERO",
	"ONE",
	"SRC_COLOR",
	"ONE_MINUS_SRC_COLOR",
	"DST_COLOR",
	"ONE_MINUS_DST_COLOR",
	"SRC_ALPHA",
	"ONE_MINUS_SRC_ALPHA",
	"DST_ALPHA",
	"ONE_MINUS_DST_ALPHA",
	"CONSTANT_COLOR",
	"ONE_MINUS_CONSTANT_COLOR",
	"CONSTANT_ALPHA",
	"ONE_MINUS_CONSTANT_ALPHA",
	"SRC_ALPHA_SATURATE",
];

const factories = {};
// Inspired by Leaflet's addInitHook()
// `fact` must be a factory function that expects a `WebGLContext`,
// optionally expects an instances of `GliiFactory`, and
// returns a (wrapped) class constructor.
function registerFactory(name, fact) {
	factories[name] = fact;
}

/**
 * @class Glii
 * @aka GliiFactory
 * @inherits EventTarget
 * Glii core. Wraps the functionality of a `WebGLRenderingContext`.
 *
 * Contains wrappers for buffer, program, texture classes; also contains
 * a partial set of WebGL constants (only the ones that need to be
 * specified as options/parameters to Glii classes).
 *
 * @example
 * ```
 * // The Glii factory class is the default export of the Glii module;
 * // importing it looks like...
 * import Glii from "path_to_glii/index.mjs";
 *
 * // Create a Glii factory instance from a canvas...
 * const glii = new Glii(document.getElementById("some-canvas"));
 *
 * // ...and use such instance to spawn stuff...
 * let pointIndices = new glii.IndexBuffer({
 * 	// ...using constants available in the Glii factory instance.
 * 	drawMode: glii.POINTS
 * });
 * ```
 *
 * Note that all Glii classes except for `GliiFactory` are meant to be instantiated from
 * the following wrapped classes. In other words: do not try to instantiate e.g.
 * `new IndexBuffer(...)`, but rather create a `GliiFactory` instance
 * (usually named lowercase `glii` in the documentation and examples) and instantiate
 * `new glii.IndexBuffer(...)`.
 *
 * Idem for WebGL constants: most (if not all) the constants needed in class constructors
 * are copied into the namespace of `GliiFactory`, as shown above with `glii.POINTS`.
 *
 */

class GliiFactory extends EventTarget {
	/**
	 * @constructor GliiFactory(target: HTMLCanvasElement, contextAttributes?: Object)
	 * Create a GL factory from a `HTMLCanvasElement`, and context attributes as per
	 * [`getContext`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)
	 * @alternative
	 * @constructor GliiFactory(target: WebGLRenderingContext)
	 * Create a GL factory from an already instantiated `WebGLRenderingContext`
	 * @alternative
	 * @constructor GliiFactory(target: WebGL2RenderingContext)
	 * Create a GL factory from an already instantiated `WebGL2RenderingContext`
	 */
	/// TODO: Add another alternative, using only context attributes, which shall
	/// implicitly create the canvas.
	constructor(target, contextAttributes) {
		super();

		if (!target || !target.constructor || !target.constructor.name) {
			// Happens on CI environments (gitlab CI)
			throw new Error(
				"Invalid target passed to GliiFactory constructor. Expected either a HTMLCanvasElement or a WebGLRenderingContext but got " +
					typeof target +
					"," +
					JSON.stringify(target) +
					"."
			);
		}
		switch (target.constructor.name) {
			case "HTMLCanvasElement":
				function get(name) {
					try {
						return target.getContext(name, contextAttributes);
					} catch (e) {
						return undefined;
					}
				}

				this.gl =
					get("webgl2") ||
					get("webgl") ||
					get("experimental-webgl") ||
					get("webgl-experimental");

				if (!this.gl) {
					throw new Error("Glii could not create a WebGL context from canvas.");
				}
				break;

			case "WebGLRenderingContext":
			case "WebGL2RenderingContext":
			case "bound WebGLRenderingContext": // Happens on headless using "gl" module
			case "bound WebGL2RenderingContext":
				this.gl = target;
				break;
			default:
				throw new Error(
					"Invalid target passed to GliiFactory constructor. Expected either a HTMLCanvasElement or a WebGLRenderingContext but got an instance of " +
						target.constructor.name +
						"."
				);
		}

		const gl = this.gl;

		this._isWebGL2 =
			gl.constructor.name === "WebGL2RenderingContext" ||
			gl.constructor.name === "bound WebGL2RenderingContext";

		// Call all individual factory functions, assign the class constructors to
		// properties of this instance.
		for (let factName in factories) {
			this[factName] = factories[factName](gl, this);
		}

		// Copy constants from the `WebGLRenderingContext`.
		for (let i in constantNames) {
			const name = constantNames[i];
			this[name] = gl[name];
		}

		if ("canvas" in gl) {
			gl.canvas.addEventListener(
				"webglcontextlost",
				(ev) => {
					console.warn("glii has lost context", ev);
					ev.preventDefault();
				},
				false
			);
			gl.canvas.addEventListener(
				"webglcontextrestored",
				(ev) => {
					console.warn("glii lost context has been restored", ev);
				},
				false
			);

			const resizeObserver = new ResizeObserver(this.#onResize.bind(this));

			resizeObserver.observe(gl.canvas, { box: "content-box" });
		}

		this.refreshDrawingBufferSize();

		this._loadedExtensions = new Map();

		/// TODO: simulate context loss with gl.getExtension('WEBGL_lose_context').loseContext();

		// 		// Fetch some info from the context
		//
		// 		// This kinda assumes that, when given a WebGLRenderingContext/
		// 		// WebGL2RenderingContext, there have been no framebuffer shenanigans.
		// 		this._defaultFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		// 		this._defaultRenderbuffer = gl.getParameter(gl.RENDERBUFFER_BINDING);
		// 		this._glslVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
		//
		// 		const attachments = [gl.COLOR_ATTACHMENT0, gl.DEPTH_ATTACHMENT, gl.STENCIL_ATTACHMENT];
		// 		const pnames = [
		// 			gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE,
		// 			gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME,
		// 			gl.FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL,
		// // 			gl.FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE
		// 		];
		//
		// // 			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		// 		this._defaultAttachments = {};
		// 		for (let att of attachments){
		// 			this._defaultAttachments[att] = {};
		// 			for (let i=0; i<0xFFFF; i++) {
		// // 				for (let pname of pnames){
		// // 					console.log(att, pname);
		// // 					this._defaultAttachments[att][pname] =
		// 				const value =
		// // 						gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, att, pname);
		// 					gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, att, i);
		// // 						gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, att, null);
		// 				if (value) {
		// 					console.log(att, i, value);
		// 				}
		// 			}
		// 		}
		//
		// 		console.log('default framebuffer: ', this._defaultFramebuffer);
		// 		console.log('default renderbuffer: ', this._defaultRenderbuffer);
		// 		console.log('default attachments: ', this._defaultAttachments);
		// 		console.log('GLSL version: ', this._glslVersion);
	}

	/**
	 * @method getSupportedExtensions(): Array of String
	 * Returns the list of GL extensions supported in the running platform, as per
	 * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getSupportedExtensions.html
	 */
	getSupportedExtensions() {
		if (this._knownExtensions) {
			return this._knownExtensions;
		}
		return (this._knownExtensions = this.gl.getSupportedExtensions());
	}

	/**
	 * @method isExtensionSupported(extName: String): Boolean
	 * Returns whether the given extension is supported in the running platform
	 */
	isExtensionSupported(extName) {
		return this.getSupportedExtensions().includes(extName);
	}

	/**
	 * @method loadExtension(ext: String): Object
	 * Tries to load the given GL extension. Throws an error if the extension is
	 * not supported.
	 *
	 * Returns the extension object, which may vary by extension.
	 */
	loadExtension(extName) {
		let ext = this._loadedExtensions.get(extName);
		if (ext) {
			return ext;
		} else {
			if (!this.isExtensionSupported(extName)) {
				throw new Error(`WebGL extension ${extName} is not supported`);
			}
			ext = this.gl.getExtension(extName);
			this._loadedExtensions.set(extName, ext);
			return ext;
		}
	}

	/**
	 * @method isWebGL2(): Boolean
	 * Returns whether the Glii instance is using a `WebGL2RenderingContext` or
	 * not.
	 */
	isWebGL2() {
		return this._isWebGL2;
	}

	// React to resize observer updates, and cache the dimensions (in device
	// pixels) of the canvas. The canvas is not updated immediately; instead
	// the `refreshDrawingBufferSize()` method should be called prior to a redraw
	#onResize(entries) {
		let entry = entries[0];

		// From https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
		let width_css;
		let height_css;
		let width_device;
		let height_device;
		let dpr = devicePixelRatio ?? 1;

		if (entry.devicePixelContentBoxSize) {
			// NOTE: Only this path gives the correct answer
			// The other paths are imperfect fallbacks
			// for browsers that don't provide anyway to do this
			width_device = entry.devicePixelContentBoxSize[0].inlineSize;
			height_device = entry.devicePixelContentBoxSize[0].blockSize;

			width_css = width_device / dpr;
			height_css = height_device / dpr;
		} else {
			if (entry.contentBoxSize) {
				if (entry.contentBoxSize[0]) {
					width_css = entry.contentBoxSize[0].inlineSize;
					height_css = entry.contentBoxSize[0].blockSize;
				} else {
					width_css = entry.contentBoxSize.inlineSize;
					height_css = entry.contentBoxSize.blockSize;
				}
			} else {
				width_css = entry.contentRect.width;
				height_css = entry.contentRect.height;
			}
			width_device = width_css * dpr;
			height_device = height_css * dpr;
		}


		this.#resizedWidth = width_device = Math.round(width_device);
		this.#resizedHeight = height_device = Math.round(height_device);

		this._drawingBufferSizeChanged = true;

		/**
		 * @event resize: CustomEvent
		 * Fired whenever the underlying `<canvas>` changes size. The next
		 * call to `refreshDrawingBufferSize()` will update the output
		 * framebuffer to the updated size (in device pixels).
		 * The `detail` of this event contains the new size, both in CSS pixels
		 * and device pixels.
		 */
		this.dispatchEvent(
			new CustomEvent("resized", {
				detail: {
					x_css: width_css,
					y_css: height_css,
					x_device: this.#resizedWidth,
					y_device: this.#resizedHeight,
					x: this.#resizedWidth,
					y: this.#resizedHeight
				},
			})
		);
	}

	#resizedWidth;
	#resizedHeight;

	/**
	 * @section Internal methods
	 * @method refreshDrawingBufferSize(): Array of Number
	 * Ensure that the size of the <canvas> linked to the `WebGLRenderingContext`
	 * matches the size provided by `getClientRect()`.
	 *
	 * Meant to be called from a `WebGL1Program` right before fetching the drawing buffer
	 * size. This technique should lower blinking when the `<canvas>` is resized.
	 *
	 * Returns the current canvas dimensions in `[width, height]` form.
	 */
	refreshDrawingBufferSize() {
		if (this._drawingBufferSizeChanged) {
			const canvas = this.gl.canvas;
			if (this.#resizedWidth) {
				this._width = canvas.width = this.#resizedWidth;
				this._height = canvas.height = this.#resizedHeight;
			} else {
				let dpr = devicePixelRatio ?? 1;
				let rect = canvas.getClientRects && canvas.getClientRects()[0];
				let width, height;

				if (rect) {
					// Canvas is in the DOM, possibly with applied CSS
					width = rect.width;
					height = rect.height;
				} else if (canvas.width) {
					// Canvas is *not* in the DOM, so trust its width/height
					/// FIXME: What if canvas is a WebGLRenderingContext?
					width = canvas.width;
					height = canvas.height;
				} else if (canvas.drawingBufferWidth) {
					width = canvas.drawingBufferWidth;
					height = canvas.drawingBufferHeight;
				}

				this._width = canvas.width = width * dpr;
				this._height = canvas.height = height * dpr;
			}
			this._drawingBufferSizeChanged = false;
		}
		return [this._width, this._height];
	}

	/// TODO: lightweight event handler for resizing; uniforms might need to be re-set.
}

// Maps each kind of TypedArray to the GL constant for the corresponding type.
// Only includes kinds of JS TypedArray that have a counterpart in WebGL.

// prettier-ignore
var typeMap = new Map([
	[Int8Array,         0x1400], // gl.BYTE
	[Uint8Array,        0x1401], // gl.UNSIGNED_BYTE
	[Uint8ClampedArray, 0x1401], // gl.UNSIGNED_BYTE
	[Int16Array,        0x1402], // gl.SHORT
	[Uint16Array,       0x1403], // gl.UNSIGNED_SHORT
	[Int32Array,        0x1404], // gl.INT
	[Uint32Array,       0x1405], // gl.UNSIGNED_INT
	[Float32Array,      0x1406], // gl.FLOAT
]);

/*
 * Notes:
 *
 * - For attributes, gl.INT and gl.UNSIGNED_INT can only
 * be used in WebGL2 (vertexAttrib*I*Pointer)
 *
 * - For index buffers, only unsigned types are valid.
 *
 * - While the rest of the code copies the GL constants from the WebGLRenderingContext,
 * this *assumes* the type constants are indeed constants. I always have this
 * fear that the actual integer values for these constants might change without notice.
 *
 */

// Partial regexp for precision qualifiers:
// A capturing group that matches lowp|mediump|highp, then one or more spaces,
// all of it optional.
const precisionQualifiers = "((?:(?:lowp)|(?:mediump)|(?:highp))\\s+)?";

// Accepted GLSL types for attribute buffers
// mat2/mat3/mat4 not yet here, see https://gitlab.com/IvanSanchez/glii/-/issues/18
// A capturing group that matches float|vec2|vec3|vec4
const glsl1AttribTypes = "((?:float)|(?:vec[2-4]))";

// Accepted GLSL types for declaration of varyings. Reused for uniforms.
// A capturing group that matches float|int|bool|vec2|vec3|vec4|ivec2|ivec3|ivec4|
// bvec2|bvec3|bvec4|mat2|mat3|mat4.
const glsl1VaryingTypes = "((?:float)|(?:int)|(?:bool)|(?:[ib]?vec[2-4])|(?:mat[2-4]))";

const regexpAttrib = new RegExp(
	// Nothing before.
	"^" +
		// First capturing group: optional precision qualifier
		precisionQualifiers +
		// Second capturing group: float|vecN.
		glsl1AttribTypes +
		// Nothing afterwards.
		"$"
);

const regexpVarying = new RegExp("^" + precisionQualifiers + glsl1VaryingTypes + "$");

/**
 * Parses a string containing:
 * - An (optional) precision qualifier
 * - A GLSL type for an attribute
 *
 * Returns a string of the form [precision, type]
 */
function parseGlslAttribType(str) {
	const match = regexpAttrib.exec(str);
	if (!match) {
		throw new Error(
			`Invalid GLSL type. Expected float|vec2|vec3|vec4 (optionally prepended by lowp|mediump|highp), but found "${str}"`
		);
	}
	const [_, precision, type] = match;
	return [precision, type];
}

/**
 * Parses a string containing:
 * - An (optional) precision qualifier
 * - A GLSL type for a varying (reused for uniforms)
 *
 * Returns a string of the form [precision, type]
 */
function parseGlslVaryingType(str) {
	const match = regexpVarying.exec(str);
	if (!match) {
		throw new Error(
			`Invalid GLSL type. Expected float|vec(234)|(ib)vec(234)|mat(234) (optionally prepended by lowp|mediump|highp), but found "${str}"`
		);
	}
	const [_, precision, type] = match;
	return [precision, type];
}

const parseGlslUniformType = parseGlslVaryingType;

function stridify(arrayType) {
	/**
	 * @class StridedTypedArray
	 *
	 * This is not a standalone class, but a decorated `TypedArray`, with
	 * the ability to store items based on a *record index* instead of an
	 * index relative to the number of elements in the array.
	 *
	 * @example
	 * ```
	 * // Get a strided array representation of the 3rd field in an interleaved
	 * // attribute set (position `2` since it's zero-indexed), capable of
	 * // holding at least 1000 vertices
	 * let strided = myInterlavedAttributes.asStridedArray(2, 1000);
	 *
	 * // Assuming the field is a `vec3`, this will store data for the 42th vertex
	 * // (`41` because, again, it's zero-indexed)
	 * strided.set([x, y, z], 41);
	 * ```
	 */
	return class StridedTypeArray extends arrayType {
		#stride;
		#offset;

		constructor(buffer, stride, offset) {
			super(buffer);

			this.#stride = stride;
			this.#offset = offset;
		}

		/**
		 * @method set(values: Array of Number, index: Number = 0): undefined
		 * Sets the given values (as per
		 * [`TypedArray.set()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/set)),
		 * but taking an `index` (relative to the number of records) instead of
		 * an `offset` (relative to the number of elements in the array).
		 *
		 * No sanity checks are performed on the length on the input data. (In
		 * other words: if a `StridedTypeArray` represents a `vec2` attribute,
		 * then `values` should have a length of `2`, idem for `vec2` and `vec4`).
		 */
		set(values, index) {
			super.set(values, index * this.#stride + this.#offset);
		}
	};
}

const stridedArrays = new Map(Array.from(typeMap.keys()).map((t) => [t, stridify(t)]));

/**
 * @class SingleAttribute
 * @inherits AbstractAttributeSet
 * @inherits BindableAttribute
 *
 * Represents a `gl.ARRAY_BUFFER` holding data for a single attribute.
 *
 * @example
 *
 * ```
 * const posInPlane = new glii.SingleAttribute({
 * 	type: Float32Array
 * 	glslType: 'vec2'
 * });
 *
 * const rgbaColour = new glii.SingleAttribute({
 * 	type: Uint8Array,
 * 	normalized: true,
 * 	glslType: 'vec4'
 * });
 * ```
 */

/// TODO: Somehow implement integer GLSL types for WebGL2.

class SingleAttribute extends AbstractAttributeSet {
	constructor(gl, options) {
		/**
		 * @section
		 * @aka SingleAttribute options
		 * @option type: prototype = Float32Array
		 * A specific subclass of `TypedArray` defining the data format
		 */
		const type = options.type || Float32Array;
		const bytesPerElement = type.BYTES_PER_ELEMENT;

		/**
		 * @option glslType: String = 'float'
		 * The GLSL type associated with this attribute. One of `float`, `vec2`, `vec3`, `vec4`, with an optional precision qualifier after it (`lowp`, `mediump` or
		 * `highp`, e.g. `"mediump vec3"`).
		 *
		 * This also defines the number of components for this attribute (1, 2, 3 or 4, respectively).
		 *
		 * `matN` attributes are not supported (yet), see https://gitlab.com/IvanSanchez/glii/-/issues/18
		 */
		const fullGlslType = options.glslType || "float";
		const [glslPrecision, glslType] = parseGlslAttribType(fullGlslType);
		if (!(glslType in AbstractAttributeSet.GLSL_TYPE_COMPONENTS)) {
			throw new Error(
				"Invalid value for the `glslType` option; must be `float`, `vec2`, `vec3`, or `vec4`."
			);
		}
		const componentCount = AbstractAttributeSet.GLSL_TYPE_COMPONENTS[glslType];

		super(gl, options, bytesPerElement * componentCount);

		this._glslType = fullGlslType;
		this._componentCount = componentCount;
		this._glType = typeMap.get(type);

		this._normalized = options.normalized;

		/**
		 * @method set(index: Number, value: Number): this
		 * Alias of `setNumber`, available when `glslType` is `float`.
		 * @alternative
		 * @method set(index: Number, values: [Number]): this
		 * Alias of `setArray`, available when `glslType` is `vec2`, `vec3` or `vec4`. `values`
		 * must be an array of length 2, 3 or 4 (respectively).
		 */
		if (options.glslType === "float") {
			this.set = this.setNumber;
		} else {
			this.set = this.setArray;
		}

		this._recordBuf = new type(componentCount);
		this._arrayType = type;
	}

	/**
	 * @method setNumber(index: Number, value: Number): this
	 * Sets the value for the `index`th vertex. Valid when `glslType` is `float`.
	 */
	setNumber(index, value) {
		this._recordBuf[0] = value;
		super.setBytes(index, 0, this._recordBuf);
		return this;
	}

	/**
	 * @method setArray(index: Number, values: Array of Number): this
	 * Sets the values for the `index`th vertex. Valid when `glslType` is `vec2`, `vec3` or `vec4`. `val` must be an array of length 2, 3 or 4 (respectively).
	 */
	setArray(index, values) {
		if (values.length !== this._componentCount) {
			throw new Error(
				`Expected ${this._componentCount} values but got ${values.length}.`
			);
		}
		this._recordBuf.set(values);
		super.setBytes(index, 0, this._recordBuf);
		return this;
	}

	/**
	 * @section Batch update methods
	 *
	 * These methods are a less convenient, but more performant, way of updating
	 * attribute data.
	 *
	 * For a `SingleAttribute`, the workflow is:
	 * - Call `asTypedArray()`
	 * - Update the values in the returned typed array (using typed array offsets,
	 *   avoiding array concatenations)
	 * - Call `commit()`
	 *
	 * These methods need the attribute set to have been created with a `growFactor`
	 * larger than zero.
	 *
	 * @method asStridedArray(minSize: Number): StridedTypedArray
	 * Returns a view of the internal in-RAM data buffer, as a `TypedArray` of
	 * the appropriate type.
	 */
	asStridedArray(minSize) {
		if (minSize > this._size) {
			this._grow(minSize);
		}
		return new (stridedArrays.get(this._arrayType))(
			this._byteData.buffer,
			this._componentCount,
			0
		);
	}

	/**
	 * @method multiSet(index: Number, values: Array of Number): this
	 *
	 * Batch version of `setArray()`.
	 *
	 * Sets values for several contiguous values at once, starting with the `index`th.
	 *
	 * The length of `values` must be a multiple of 2, 3 or 4 when `glslType` is `vec2`,
	 * `vec3` or `vec4` (respectively). `values` must be a flat array (i.e. run
	 * `.flat()` if needed).
	 */
	multiSet(index, values) {
		if (values.length % this._componentCount) {
			throw new Error(
				`Expected values to be a multiple of ${this._componentCount} but got ${values.length}.`
			);
		}
		super.setBytes(index, 0, this._arrayType.from(values));
		return this;
	}

	// Method implementing `BindableAttribute` interface.
	bindWebGL1(location) {
		const gl = this._gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
		gl.enableVertexAttribArray(location);
		gl.vertexAttribPointer(
			location,
			this._componentCount,
			this._glType,
			this._normalized,
			this._recordSize, // stride
			0 // offset
		);
	}

	// Method implementing `BindableAttribute` interface.
	getGlslType() {
		return this._glslType;
	}

	/**
	 * @method destroy(): this
	 * Tells WebGL to free resources associated with this `SingleAttribute`. Use
	 * when the `SingleAttribute` won't be used anymore.
	 *
	 * After being destroyed, WebGL programs should not use the destroyed `SingleAttribute`.
	 */
	destroy() {
		this._gl.deleteBuffer(this._buf);
	}

	debugDump(start, length) {
		start ??= 0;
		length ??= this._size;
		const end = start + length;


		const view = new this._arrayType(this._byteData.buffer);

		// return Array.from(new Array(this._size), (_, i) => {
		const result = new Array(this._size);

		for (let i=start; i<end; i++) {
			const j = i * this._componentCount;
			result[i] = view.subarray(j, j + this._componentCount);
		}		return result;
	}
}

/**
 * @factory GliiFactory.SingleAttribute(options: SingleAttribute options)
 * @class Glii
 * @section Class wrappers
 * @property SingleAttribute(options: SingleAttribute options): Prototype of SingleAttribute
 * Wrapped `SingleAttribute` class
 */
registerFactory("SingleAttribute", function (gl) {
	return class WrappedSingleAttribute extends SingleAttribute {
		constructor(options) {
			super(gl, options);
		}
	};
});

/**
 * @class InterleavedAttributes
 * @inherits AbstractAttributeSet
 * @relationship aggregationOf BindableAttribute, 1..1, 0..n
 *
 * Represents a `gl.ARRAY_BUFFER` holding data for several attributes, which
 * internally (in memory) are interleaved (data for the same vertex index is
 * adjacent).
 *
 * Since the internal data structure vaguely resembles a C `struct`, each attribute
 * contained therein is referred to as `field`.
 *
 * @example
 *
 * ```
 * // Instantiate
 * const interleaved = new glii.InterleavedAttributes({
 * 	usage: glii.STATIC_DRAW
 * },[{
 * 	type: Float32Array
 * 	glslType: 'vec2'
 * }, {
 * 	type: Uint8Array,
 * 	normalized: true,
 * 	glslType: 'vec4'
 * }]);
 *
 * // Set the float32 values (0th field) for vertex 5
 * interleaved.setField(5, 0, [0.5, 0.5]);
 *
 * // Set the uint8 values (1st field) for vertex 2
 * interleaved.setField(2, 1, [255, 0, 0, 255]);
 *
 * // Set all fields for vertex 7
 * interleaved.setFields(7, [[0.5, 0.5], [255, 0, 0, 255]]);
 *
 * // Link to attributes in a program
 * program = new glii.WebGL1Program({
 * 	attributes: {
 * 		aRGBA: interleaved.getBindableAttribute(1),
 * 		aPos: interleaved.getBindableAttribute(0),
 * 	},
 * 	// etc
 * });
 * ```
 */

/// TODO: Somehow implement integer GLSL types for WebGL2.

class InterleavedAttributes extends AbstractAttributeSet {
	constructor(gl, options, fields) {
		let bytesPerRecord = 0;
		let _fields = [];
		let byteAlignment = 0;

		for (let field of fields) {
			let _field = {
				type: field.type || Float32Array,
				glslType: field.glslType || "float",
				normalized: !!field.normalized,
				offset: bytesPerRecord,
			};

			const bytesPerElement = _field.type.BYTES_PER_ELEMENT;
			const [_, glslType] = parseGlslAttribType(_field.glslType);
			const componentCount = AbstractAttributeSet.GLSL_TYPE_COMPONENTS[glslType];
			_field.components = componentCount;

			if (_field.offset % bytesPerElement) {
				// Pad before the field, if needed. The offsets of 2-byte and
				// 4-byte fields must be a multiple of their `bytesPerElement`.
				_field.offset += bytesPerElement - (_field.offset % bytesPerElement);
			}

			bytesPerRecord += bytesPerElement * componentCount;
			_fields.push(_field);
			byteAlignment = Math.max(byteAlignment, bytesPerElement);
		}

		// Pad after the last field, if needed. If there are 2-byte (or 4-byte)
		// datatypes, then the stride must be a multiple of 2 (or 4).
		const unalignment = bytesPerRecord % byteAlignment;
		if (unalignment !== 0) {
			bytesPerRecord += byteAlignment - unalignment;
		}

		super(gl, options, bytesPerRecord);

		this._fields = _fields;
		this._recordBuf = new ArrayBuffer(this._recordSize);
		this._typedArrays = _fields.map(
			(f) => new f.type(this._recordBuf, f.offset, f.components)
		);
	}

	/**
	 * @method setField(vertexIndex: Number, fieldIndex, values: Array of Number): this
	 * Sets the value(s) for the given vertex index and 0-indexed field.
	 *
	 * Values must be given as an `Array` (or `Array-like`) of numbers, even for
	 * 1-component fields with the `float` GLSL type.
	 */
	setField(vertexIndex, fieldIndex, values) {
		this._typedArrays[fieldIndex].set(values);
		super.setBytes(
			vertexIndex,
			this._fields[fieldIndex].offset,
			this._typedArrays[fieldIndex]
		);

		return this;
	}

	/**
	 * @method setFields(vertexIndex: Number, values: Array of Array of Number): this
	 * Sets the value(s) for all fields for the given vertex index.
	 *
	 * Values must be given as an `Array`; the `n`th element in this `Array` must be an
	 * `Array` (or `Array-like`) of arrays of numbers with the values for the `n`th
	 * field.
	 */
	setFields(vertexIndex, values) {
		this._typedArrays.forEach((arr, f) => {
			arr.set(values[f]);
		});

		super.setBytes(vertexIndex, 0, this._recordBuf);
		return this;
	}

	/**
	 * @method multiSet(vertexIndex: Number, values: Array of Array of Array of Number): this
	 *
	 * Batch version of `setFields`. Instead of
	 * `attrs.setFields(i, foo); attrs.setFields(i+1,bar);` one can do
	 * `attrs.multiSet(i, [foo, bar])`.
	 */
	multiSet(vertexIndex, values) {
		const multiBuf = new ArrayBuffer(this._recordSize * values.length);
		const tmpDst = new Uint8Array(multiBuf);
		const tmpSrc = new Uint8Array(this._recordBuf);

		/// TODO: Possible optimization here - dump values directly to `tmp`
		/// by looping through offsets, instead of dumping to `_this._recordBuf`
		/// and then copying it.
		/// That would require some refactoring of `this._fields`, however.
		values.forEach((fields, i) => {
			this._typedArrays.forEach((arr, f) => {
				arr.set(fields[f]);
			});
			tmpDst.set(tmpSrc, this._recordSize * i);
		});

		super.setBytes(vertexIndex, 0, multiBuf);
		return this;
	}

	/**
	 * @method getBindableAttribute(fieldIndex: Number): BindableAttribute
	 */
	getBindableAttribute(fieldIndex) {
		const field = this._fields[fieldIndex];
		const glType = typeMap.get(field.type);
		return {
			bindWebGL1: function bindWebGL1(location) {
				if (location === -1) {
					console.warn("Tried to bind an attribute not in use");
					return;
				}
				const gl = this._gl;
				gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
				gl.enableVertexAttribArray(location);
				gl.vertexAttribPointer(
					location,
					field.components,
					glType,
					field.normalized,
					this._recordSize, // stride
					field.offset // offset
				);
			}.bind(this),

			getGlslType: function getGlslType() {
				return field.glslType;
			},

			debugDump: function debugDump(start, length) {
				start ??= 0;
				length ??= this._size;
				const end = start + length;

				const result = new Array(this._size);

				for (let i=start; i<end; i++) {
					result[i] = new field.type(
						this._byteData.buffer,
						i * this._recordSize + field.offset,
						field.components
					);
				}				return result;
			}.bind(this),
		};
	}

	/**
	 * @section Batch update methods
	 *
	 * These methods are a less convenient, but more performant, way of updating
	 * attribute data.
	 *
	 * For a `InterlevedAttributes`, the workflow is:
	 * - Call `asTypedArray()` once per bindable attribute
	 * - Update the values in the returned typed array (using typed array offsets,
	 *   avoiding array concatenations)
	 * - Call `commit()`
	 *
	 * These methods need the attribute set to have been created with a `growFactor`
	 * larger than zero.
	 *
	 * @method asStridedArray(fieldIndex: Number, minSize?: Number = 0): StridedTypedArray
	 * Returns a view of the internal in-RAM data buffer for the attribute at
	 * `fieldIndex`, as a `TypedArray` of the appropriate type.
	 */
	asStridedArray(fieldIndex, minSize = 0) {
		if (minSize > this._size) {
			this._grow(minSize);
		}
		const { type, offset } = this._fields[fieldIndex];
		const bpe = type.BYTES_PER_ELEMENT;

		return new (stridedArrays.get(type))(
			this._byteData.buffer,
			this._recordSize / bpe,
			offset / bpe
		);
	}

	/**
	 * @method destroy(): this
	 * Tells WebGL to free resources associated with this `InterleavedAttributes`. Use
	 * when the `InterleavedAttributes` won't be used anymore.
	 *
	 * After being destroyed, WebGL programs should not use any `BindableAttribute`
	 * linked to a destroyed `InterleavedAttributes`.
	 */
	destroy() {
		this._gl.deleteBuffer(this._buf);
	}
}

/**
 * @factory GliiFactory.InterleavedAttributes(options: InterleavedAttributes options, fields: Array of BindableAttributeOptions)
 * @class Glii
 * @section Class wrappers
 * @property InterleavedAttributes(options: InterleavedAttributes options, fields: Array of BindableAttributeOptions): Prototype of InterleavedAttributes
 * Wrapped `InterleavedAttributes` class
 */
registerFactory("InterleavedAttributes", function (gl) {
	return class WrappedInterleavedAttributes extends InterleavedAttributes {
		constructor(options, fields) {
			super(gl, options, fields);
		}
	};
});

/**
 * @class SequentialIndices
 *
 * Represents a set of sequential vertex indices. The order cannot
 * be changed.
 *
 * A `SequentialIndices` of size `n` behaves (in practice) the same as a
 * `IndexBuffer` of size `n` with sequential indices starting at zero.
 *
 * In other words, the following two are equivalent in practice:
 *
 * ```
 * let seqIdx = new glii.SequentialIndices({ size: 9 });
 *
 * let idxBuf = new glii.IndexBuffer({ size: 9 });
 * idxBuf.set(0, [0,1,2,3,4,5,6,7,8]);
 * ```
 *
 * Internally, this performs a `gl.drawArrays` calls instead of `gl.drawElements`.
 *
 */

class SequentialIndices {
	constructor(gl, options = {}) {
		this._gl = gl;

		// @section
		// @aka SequentialIndices options
		// @option size: Number = 3
		// Exact number of indices to refer to.
		this._size = options.size || 3;

		// @option drawMode: Draw mode constant = glii.TRIANGLES
		// Determines what kind of primitive is represented by the vertices
		// pointed by the indices.
		this._drawMode = options.drawMode === undefined ? gl.TRIANGLES : options.drawMode;
	}

	/**
	 * @section Internal methods
	 * @uninheritable
	 * @method drawMe(): undefined
	 * Internal use only. Does the `WebGLRenderingContext.drawArrays()` calls, but
	 * assumes that everyhing else (bound program, textures, attribute name-locations,
	 * uniform name-locations-values) has been set up already.
	 *
	 * This is expected to be called from `WebGL1Program` only.
	 */
	drawMe() {
		this._gl.drawArrays(this._drawMode, 0, this._size);
	}

	/**
	 * @method drawMePartial(start: Number, count: Number): undefined
	 * Internal use only. As `drawMe()`, but lets the programmer explicitly
	 * set the range of vertex slots to be drawn.
	 *
	 * This is expected to be called from `WebGL1Program` only.
	 */
	drawMePartial(start, count) {
		this._gl.drawArrays(this._drawMode, start, count);
	}

	/**
	 * @section
	 * @method destroy(): this
	 * Stub method.
	 *
	 * Subclasses that allocate WebGL resources (i.e. element buffers) shall
	 * reimplement this method and free them.
	 */
	destroy() {
		return this;
	}
}

/**
 * @section
 * @factory GliiFactory.SequentialIndices(options: SequentialIndices options)
 * @class Glii
 * @section Class wrappers
 * @property SequentialIndices(options: SequentialIndices options): Prototype of SequentialIndices
 * Wrapped `SequentialIndices` class
 */
registerFactory("SequentialIndices", function (gl) {
	return class WrappedSequentialIndices extends SequentialIndices {
		constructor(options) {
			super(gl, options);
		}
	};
});

/**
 * @class IndexBuffer
 * @inherits SequentialIndices
 *
 * Represents a set of configurable vertex indices. This will tell the
 * program which vertices to draw, in which mode (points/lines/triangles),
 * and in which order. Includes a couple of niceties like setters and
 * handling of the data types.
 *
 * The implementation of `IndexBuffer` is low-ish level. Using the
 * `TriangleIndices` subclass might feel easier.
 *
 * Internally this represents a `gl.ELEMENT_ARRAY_BUFFER` at the WebGL level, or an
 * Element Array Buffer (EAB) at the OpenGL level.
 */

class IndexBuffer extends SequentialIndices {
	constructor(gl, gliiFactory, options = {}) {
		super(gl, options);

		// @section
		// @aka IndexBuffer options
		// @option size: Number = 255
		// Maximum number of indices to hold
		this._size = options.size || 255;

		// @option growFactor: Boolean = false
		// Specifies that the size of this indices buffer is static.
		// @alternative
		// @option growFactor: Number
		// Allows this buffer to automatically grow when `set()` is out of bounds.
		//
		// Each time that happens, the `size` of this indices buffer will
		// grow by that factor (e.g. a `growFactor` of 2 means the buffer doubles its size each
		// time the size is insufficient). `growFactor` should be greater than `1`.
		this._growFactor = options.growFactor || 1.2;

		// @option usage: Buffer usage constant = glii.STATIC_DRAW
		// One of `gl.STATIC_DRAW`, `gl.DYNAMIC_DRAW` or `gl.STREAM_DRAW`.
		// See the documentation of the `usage` parameter at
		// [`bufferData`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/bufferData)
		// for more details.
		this._usage = options.usage || gl.STATIC_DRAW;

		// @option type: Data type constant = glii.UNSIGNED_SHORT
		// One of `glii.UNSIGNED_BYTE`, `glii.UNSIGNED_SHORT` or `glii.UNSIGNED_INT`.
		// This sets the maximum index that can be referenced by this `IndexBuffer`
		// (but not how many indices this `IndexBuffer` can hold):
		// 2^8, 2^16 or 2^32 respectively.
		// See the documentation of the `usage` parameter at
		// [`gl.drawElements`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawElements)
		// for more details.
		this._type = options.type || gl.UNSIGNED_SHORT;

		if (this._type === gl.UNSIGNED_BYTE) {
			this._bytesPerSlot = 1;
			this._typedArray = Uint8Array;
			this._maxValue = 1 << 8;
		} else if (this._type === gl.UNSIGNED_SHORT) {
			this._bytesPerSlot = 2;
			this._typedArray = Uint16Array;
			this._maxValue = 1 << 16;
		} else if (this._type === gl.UNSIGNED_INT) {
			/// Manually load the relevant GL extension, only needed in WebGL1
			/// contexts.
			gliiFactory.isWebGL2() || gliiFactory.loadExtension("OES_element_index_uint");

			this._bytesPerSlot = 4;
			this._typedArray = Uint32Array;
			this._maxValue = (1 << 16) * (1 << 16); // The JS << operator is clamped to 2^32 :-/
		} else {
			throw new Error(
				"Invalid type for IndexBuffer. Must be one of `gl.UNSIGNED_BYTE`, `gl.UNSIGNED_SHORT` or `gl.UNSIGNED_INT`."
			);
		}
		this._buf = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._buf);
		gl.bufferData(
			gl.ELEMENT_ARRAY_BUFFER,
			this._size * this._bytesPerSlot,
			this._usage
		);

		// Upper bound of many indices in this IndexBuffer are pointing to valid vertices.
		// AKA "highest set slot"
		this._activeIndices = 0;

		if (this._growFactor) {
			// Growable index buffers need to store all the data in a
			// readable data structure, in order to call `bufferData` with
			// the new size without destroying data.
			this._ramData = new this._typedArray(this._size);
		}
	}

	/**
	 * @method set(n: Number, indices: Array of Number): this
	 * Stores the given indices as 1-, 2- or 4-byte integers, starting at the `n`-th
	 * position in this `IndexBuffer` (zero-indexed; the first index slot is at `n`=0).
	 *
	 * The indices passed must exist (and likely, have values) in any
	 * `AttributeBuffer`s being used together with this `IndexBuffer` in a
	 * GL program.
	 */
	set(n, indices) {
		if (indices.length === 0) {
			return this;
		}

		const gl = this._gl;
		this.grow(n + indices.length);

		gl.bufferSubData(
			gl.ELEMENT_ARRAY_BUFFER,
			n * this._bytesPerSlot,
			this._typedArray.from(indices)
		);

		this._setActiveIndices(n + indices.length);

		if (this._ramData) {
			this._ramData.set(indices, n);
		}

		return this;
	}

	/**
	 * @method truncate(n: Number): this
	 * Shrinks the amount of indices to be drawn, so that only the first `n`
	 * indices are considered.
	 */
	truncate(n) {
		this._activeIndices = Math.min(this._activeIndices, n);
		return this;
	}

	/**
	 * @section Internal methods
	 * @uninheritable
	 * @method grow(minimum): undefined
	 * Internal usage only. Grows the size of both the internal buffer, so
	 * it can contain at least `minimum` index slots.
	 */
	grow(minimum) {
		this.bindMe();
		if (this._size >= minimum) {
			return;
		}
		if (!this._growFactor) {
			throw new Error(
				`Tried to set index out of bounds of non-growable IndexBuffer (requested ${minimum} vs size ${this._size})`
			);
		} else {
			this._size = Math.max(minimum + 1, Math.ceil(this._size * this._growFactor));

			const newRamData = new this._typedArray(this._size);
			newRamData.set(this._ramData, 0);
			this._ramData = newRamData;

			const gl = this._gl;
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._ramData, this._usage);
		}
	}

	/**
	 * @method bindMe(): undefined
	 * Internal use only. (Re-)binds itself as the `ELEMENT_ARRAY_BUFFER` of the
	 * `WebGLRenderingContext`.
	 *
	 * In practice, this should happen every time the program changes in the
	 * current context.
	 *
	 * This is expected to be called from `WebGL1Program` only.
	 */
	bindMe() {
		const gl = this._gl;
		//if (gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) !== this._buf) {
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._buf);
		//}
	}

	/**
	 * @method drawMe(): undefined
	 * Internal use only. Does the `WebGLRenderingContext.drawElement()` calls, but
	 * assumes that everyhing else (bound program, textures, attribute name-locations,
	 * uniform name-locations-values) has been set up already.
	 *
	 * This is expected to be called from `WebGL1Program` only.
	 */
	drawMe() {
		this.bindMe();
		this._gl.drawElements(this._drawMode, this._activeIndices, this._type, 0);
	}

	/**
	 * @method drawMePartial(start: Number, count: Number): undefined
	 * Internal use only. As `drawMe()`, but lets the programmer explicitly
	 * set the range of vertex slots to be drawn.
	 *
	 * This is expected to be called from `WebGL1Program` only.
	 */
	drawMePartial(start, count) {
		this.bindMe();
		this._gl.drawElements(
			this._drawMode,
			count,
			this._type,
			start * this._bytesPerSlot
		);
	}

	// Set the number of active indices to either the given number or the number of active indices,
	// whatever is greater.
	_setActiveIndices(n) {
		this._activeIndices = Math.max(this._activeIndices, n);
	}

	/**
	 * @section
	 * @method destroy(): this
	 * Tells WebGL to free resources associated with this `IndexBuffer`. Use
	 * when the `IndexBuffer` won't be used anymore.
	 *
	 * After being destroyed, WebGL programs should not use the destroyed `IndexBuffer`.
	 */
	destroy() {
		this._gl.deleteBuffer(this._buf);
		return this;
	}

	/**
	 * @section Batch update methods
	 *
	 * These methods are a less convenient, but more performant, way of updating
	 * indices data.
	 *
	 * For a `IndexBuffer`, the workflow is:
	 * - Call `asTypedArray()` once
	 * - Update the values in the returned typed array (using typed array offsets,
	 *   avoiding array concatenations)
	 * - Call `commit()`
	 *
	 * These methods need the index buffer to have been created with a `growFactor`
	 * larger than zero.
	 *
	 * @method asTypedarray(minSize?: Number): TypedArray
	 * Returns a view of the internal in-RAM buffer for the index data, able to
	 * contain at least `minSize` indices.
	 */
	asTypedArray(minSize) {
		if (isFinite(minSize)) {
			this.grow(minSize);
		}
		return this._ramData;
	}

	/**
	 * @method commit(start, length): this
	 * Dumps the contents of the data in RAM into GPU memory. Will dump
	 * a contiguous section, for a block of indices starting at `start` and
	 * with the given `length`.
	 */
	commit(start, length) {
		this.bindMe();

		const addr = this._bytesPerSlot * start;
		const data = new this._typedArray(this._ramData.buffer, addr, length);
		const gl = this._gl;

		gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, addr, data);

		this._setActiveIndices(start + length);
	}
}

/**
 * @factory GliiFactory.IndexBuffer(options: IndexBuffer options)
 * @class Glii
 * @section Class wrappers
 * @property IndexBuffer(options: IndexBuffer options): Prototype of IndexBuffer
 * Wrapped `IndexBuffer` class
 */
registerFactory("IndexBuffer", function (gl, gliiFactory) {
	return class WrappedIndexBuffer extends IndexBuffer {
		constructor(options) {
			super(gl, gliiFactory, options);
		}
	};
});

/**
 * @class Allocator
 *
 * The purpose of an `Allocator` is to provide a way to request (and
 * return) blocks of 0-indexed IDs.
 *
 * The general idea is that a user should request N points/linesegments/triangles,
 * and this class would be responsible for creating numeric indices for them.
 * Then, the allocated indices would use up space in a `PointIndices`/
 * `LineSegmentIndices`/`TriangleIndices`.
 *
 * @example
 *
 * The `Allocator` class is `import`ed directly from the `glii` module:
 *
 * ```
 * import { default as Glii, Allocator } from "path_to_glii/index.mjs";
 *
 * const glii = GliiFactory(// etc //);
 *
 * const myAllocator = new Allocator();
 * ```
 *
 * Trying to spawn an `Allocator` from a `GliiFactory` will fail:
 *
 * ```
 * import { default as Glii, Allocator } from "path_to_glii/index.mjs";
 * const glii = GliiFactory(// etc //);
 *
 * const myAllocator = new glii.Allocator();	// BAD!
 * ```
 *
 */

// This is kinda similar to https://github.com/redboltz/number-allocator ,
// but allows allocating a range, and has worse complexity (O(n) instead of
// O(n·log(n)) ).

class Allocator {
	constructor(max = Number.MAX_SAFE_INTEGER) {
		/**
		 * @constructor Allocator(max: Number)
		 * Creates a new `Allocator` instance, given the upper limit
		 * of the allocatable area.
		 */

		this._max = max;
		// The 'points' structure is effectively a linked list of
		// start points of free/allocated regions.
		this._points = new Map();
		this._points.set(0, {
			free: true,
			next: max,
		});
	}

	/**
	 * @method allocateBlock(size:Number): Number
	 * Given the count of IDs to allocate, returns a `Number` with the
	 * first ID of the allocated block (last would be return + count - 1)
	 */
	allocateBlock(size) {
		if (size === 0) {
			return NaN;
		}
		let prev = 0;
		let ptr = 0;

		while (true) {
			const block = this._points.get(ptr);
			const end = ptr + size;

			if (block.free) {
				if (ptr === 0 && end < block.next) {
					// Allocate at the very beginning
					this._points.set(0, { free: false, next: end });
					this._points.set(end, { free: true, next: block.next });
					return 0;
				}
				if (ptr === 0 && end === block.next) {
					// Allocate at the very beginning, merge with next block
					const nextBlock = this._points.get(end);
					this._points.set(0, { free: false, next: nextBlock.next });
					this._points.delete(block.next);
					return 0;
				}
				if (end < block.next) {
					// Increase the size of the previous, used, block
					this._points.set(prev, { free: false, next: end });
					this._points.delete(ptr);
					this._points.set(end, { free: true, next: block.next });
					return ptr;
				}
				if (end === block.next) {
					// Allocate an entire free block,
					// merge neighbouring used blocks
					const nextBlock = this._points.get(end);
					this._points.set(prev, { free: false, next: nextBlock.next });
					this._points.delete(ptr);
					this._points.delete(block.next);
					return ptr;
				}
			}

			prev = ptr;
			ptr = block.next;
			if (ptr <= prev) {
				throw new Error(`Bad allocation map: tried to go backwards`);
			}
			// 			if (ptr === Number.MAX_SAFE_INTEGER) {
			if (ptr >= this._max) {
				throw new Error(`No allocatable space`);
			}
		}
	}

	/**
	 * @method deallocateBlock([Number]): this
	 * Given a starting ID and the size of a block, deallocates that block
	 * (marks it as allocatable again)
	 */
	deallocateBlock(start, size) {
		if (size === 0) {
			return this;
		}
		let prev = 0;
		let ptr = 0;
		const end = start + size;

		while (true) {
			const block = this._points.get(ptr);

			if (!block.free) {
				if (ptr === 0 && start === 0 && end === block.next) {
					// Deallocate entire block at beginning
					const nextBlock = this._points.get(end);
					this._points.set(0, { free: true, next: nextBlock.next });
					this._points.delete(end);
					return this;
				}
				if (ptr === 0 && start === 0 && end < block.next) {
					// Deallocate partial block at beginning,
					// lower next block start
					this._points.set(0, { free: true, next: end });
					this._points.set(end, { free: false, next: block.next });
					return this;
				}

				if (ptr === start && end < block.next) {
					// Deallocate at the beginning of a used block
					// Grow the previous free block
					this._points.set(prev, { free: true, next: end });
					this._points.delete(ptr);
					this._points.set(end, { free: false, next: block.next });
					return this;
				}
				if (ptr === start && end === block.next) {
					// Deallocate the entire block
					// Merge neighbouring free blocks
					const nextBlock = this._points.get(block.next);
					this._points.set(prev, { free: true, next: nextBlock.next });
					this._points.delete(ptr);
					this._points.delete(block.next);
					return this;
				}
				if (ptr < start && end === block.next) {
					// Deallocate the end of the block
					// Grow the next free block
					const nextBlock = this._points.get(block.next);
					this._points.set(ptr, { free: false, next: start });
					this._points.delete(block.next);
					this._points.set(start, { free: true, next: nextBlock.next });
					return this;
				}
				if (ptr < start && end < block.next) {
					// Deallocate middle of a block
					this._points.set(ptr, { free: false, next: start });
					this._points.set(start, { free: true, next: end });
					this._points.set(end, { free: false, next: block.next });
					return;
				}
			}

			prev = ptr;
			ptr = block.next;
			if (ptr <= prev) {
				throw new Error(`Bad allocation map: tried to go backwards`);
			}
			// if (start === Number.MAX_SAFE_INTEGER) {
			if (ptr >= this._max) {
				throw new Error(`Could not deallocate. Sparse?`);
			}
		}
	}

	/**
	 * @method forEachBlock(fn: Function): this
	 * Runs the given callback `Function` `fn`. `fn` receives
	 * the start and length of each allocated block as its two
	 * parameters.
	 */
	forEachBlock(fn) {
		if (this._points.size <= 1) {
			return this;
		}
		let ptr = 0;
		while (true) {
			const block = this._points.get(ptr);
			if (!block) {
				throw new Error(
					`Bad allocation map: was modified inside a forEach() callback`
				);
			}
			if (!block.free) {
				fn(ptr, block.next - ptr);
			}
			if (block.next <= ptr) {
				throw new Error(`Bad allocation map: tried to go backwards`);
			}
			ptr = block.next;
			if (ptr >= this._max) {
				return this;
			}
		}
	}
}

/**
 * @class SparseIndices
 * @inherits IndexBuffer
 * @relationship compositionOf Allocator, 0..1, 1..1
 *
 * A `SparseIndices` is an `IndexBuffer`, plus an `Allocator` of index
 * slots - whenever more index slots for primitives are needed,
 * call `allocateSlots` (and later `deallocateSlots` if needed).
 *
 * (Drawing this `Indices` shall trigger one draw call per contiguous
 * block of used indices. By comparison, the basic `IndexBuffer` triggers
 * just one `drawElements` call, from 0 to number-of-used-indices -1)
 *
 */

class SparseIndices extends IndexBuffer {
	constructor(gl, gliiFactory, options = {}) {
		super(gl, gliiFactory, options);

		// Allocator instance for blocks in self's `ELEMENT_ARRAY_BUFFER`.
		if (this._growFactor) {
			this._slotAllocator = new Allocator();
		} else {
			this._slotAllocator = new Allocator(this._size);
		}
	}

	/**
	 * @method allocateSlots(count: Number): Number
	 * Allocates `count` slots for indices. Returns the offset of the first
	 * slot.
	 *
	 * For `gl.TRIANGLES` (`gl.LINES`), allocate 3 (2) slots per triangle (line).
	 */
	allocateSlots(count) {
		const start = this._slotAllocator.allocateBlock(count);
		this.grow(start + count);
		return start;
	}

	/**
	 * @method deallocateSlots(start: Number, count: Number): this
	 * Deallocates `count` slots for indices, started with the `start`th slot.
	 *
	 * For `gl.TRIANGLES` (`gl.LINES`), allocate 3 (2) slots per triangle (line).
	 */
	deallocateSlots(start, count) {
		this._slotAllocator.deallocateBlock(start, count);
		return this;
	}

	/**
	 * @method allocateSet(indices: Array of Number): Number
	 * Combination of `allocate()` and `set()`. Allocates the neccesary
	 * space for the given indices, and sets their values.
	 *
	 * Returns the offset of the allocation block start.
	 */
	allocateSet(indices) {
		const start = this.allocateSlots(indices.length);
		this.set(start, indices);
		return start;
	}

	/**
	 * @method forEachBlock(fn: Function): this
	 * Runs the given callback `Function` `fn` once per allocated block.
	 *
	 * The callback function shall receive the start and length of each
	 * allocated block. Both figures are given in number of *vertex slots*
	 * and not in primitives (i.e. divide by 3 when working with triangles).
	 */
	forEachBlock(fn) {
		this._slotAllocator.forEachBlock(fn);
		return this;
	}

	truncate(n) {
		return this.deallocateSlots(n, Number.MAX_SAFE_INTEGER);
	}

	// Internal only. Does the GL drawElement() calls, but assumes that everyhing else
	// (bound program, textures, attribute name-locations, uniform name-locations-values)
	// has been set up already.
	drawMe() {
		this.bindMe();
		this._slotAllocator.forEachBlock((start, length) => {
			const startByte = start * this._bytesPerSlot;
			this._gl.drawElements(this._drawMode, length, this._type, startByte);
		});
	}

	// Internal only. Does the GL drawElement() calls, but assumes that everyhing else
	// (bound program, textures, attribute name-locations, uniform name-locations-values)
	// has been set up already.
	drawMePartial(start, count) {
		this.bindMe();
		this._gl.drawElements(
			this._drawMode,
			count,
			this._type,
			start * this._bytesPerSlot
		);
	}
}

/**
 * @factory GliiFactory.SparseIndices(options: SparseIndices options)
 * @class Glii
 * @section Class wrappers
 * @property SparseIndices(options: SparseIndices options): Prototype of SparseIndices
 * Wrapped `SparseIndices` class
 */
registerFactory("SparseIndices", function (gl, gliiFactory) {
	return class WrappedSparseIndices extends SparseIndices {
		constructor(options) {
			super(gl, gliiFactory, options);
		}
	};
});

/**
 * @class SequentialSparseIndices
 * @inherits SequentialIndices
 * @relationship compositionOf Allocator, 0..1, 1..1
 *
 * Works as a `SequentialIndices` in that makes `drawArrays` calls, but one
 * call per allocated block (as per `SparseIndices`).
 */

class SequentialSparseIndices extends SequentialIndices {
	constructor(gl, options = {}) {
		super(gl, options);
		this._slotAllocator = new Allocator();
	}

	/**
	 * @method allocateSlots(count: Number): Number
	 * Allocates `count` slots for indices. Returns the offset of the first
	 * slot.
	 *
	 * For `gl.TRIANGLES` (`gl.LINES`), allocate 3 (2) slots per triangle (line).
	 */
	allocateSlots(count) {
		return this._slotAllocator.allocateBlock(count);
	}

	/**
	 * @method deallocateSlots(start: Number, count: Number): this
	 * Deallocates `count` slots for indices, started with the `start`th slot.
	 *
	 * For `gl.TRIANGLES` (`gl.LINES`), allocate 3 (2) slots per triangle (line).
	 */
	deallocateSlots(start, count) {
		this._slotAllocator.deallocateBlock(start, count);
		return this;
	}

	/**
	 * @method forEachBlock(fn: Function): this
	 * Runs the given callback `Function` `fn` once per allocated block.
	 *
	 * The callback function shall receive the start and length of each
	 * allocated block. Both figures are given in number of *vertex slots*
	 * and not in primitives (i.e. divide by 3 when working with triangles).
	 */
	forEachBlock(fn) {
		this._slotAllocator.forEachBlock(fn);
		return this;
	}

	// Internal only. Does the GL drawElement() calls, but assumes that everyhing else
	// (bound program, textures, attribute name-locations, uniform name-locations-values)
	// has been set up already.
	drawMe() {
		this._slotAllocator.forEachBlock((start, length) => {
			this._gl.drawArrays(this._drawMode, start, length);
		});
	}

	// Internal only. Does the GL drawElement() calls, but assumes that everyhing else
	// (bound program, textures, attribute name-locations, uniform name-locations-values)
	// has been set up already.
	drawMePartial(start, count) {
		this._gl.drawArrays(this._drawMode, start, count);
	}
}

/**
 * @factory GliiFactory.SparseIndices(options: SparseIndices options)
 * @class Glii
 * @section Class wrappers
 * @property SparseIndices(options: SparseIndices options): Prototype of SparseIndices
 * Wrapped `SparseIndices` class
 */
registerFactory("SequentialSparseIndices", function (gl) {
	return class WrappedSequentialSparseIndices extends SequentialSparseIndices {
		constructor(options) {
			super(gl, options);
		}
	};
});

/**
 * @class TriangleIndices
 * @inherits SparseIndices
 * @relationship associated Triangle
 * @relationship associated Quad
 *
 * A decorated flavour of `SparseIndices`. Allows spawning instances of the `Triangle`
 * utility class.
 *
 * The `drawMode` of a `TriangleIndices` is forced to `gl.TRIANGLES`.
 *
 * @example
 *
 * ```
 * const myTriangles = new GliiFactory.TriangleIndices();
 *
 * const trig1 = new myTriangles.Triangle(0,1,2);
 * trig1.setVertices(0,1,2);
 * trig1.destroy();
 * ```
 */

class TriangleIndices extends SparseIndices {
	constructor(gl, gliiFactory, options = {}) {
		/**
		 * @section
		 * @aka TriangleIndices options
		 * @option size: Number = 85; The (initial) amount of triangles (not vertices) to hold
		 */
		options.size = (options.size || 85) * 3;
		super(gl, options);

		const container = this;
		/**
		 * @property Triangle: Triangle prototype
		 * Class prototype for `Triangle`s.
		 */
		this.Triangle = class WrappedTriangle extends Triangle {
			constructor() {
				super(container);
			}
		};

		/**
		 * @property Quad: Quad prototype
		 * Class prototype for `Quad`s.
		 */
		this.Quad = class WrappedQuad extends Quad {
			constructor() {
				super(container);
			}
		};
	}

	/**
	 * @method allocateSlots(count: Number): Number
	 * Allocates `count` slots for indices, `count` must be a multiple of 3.
	 * Returns the offset of the first slot.
	 */
	allocateSlots(count) {
		if (count % 3) {
			throw new Error(
				"Number of vertices to be allocated from a TriangleIndices must be a multiple of 3"
			);
		}
		return super.allocateSlots(count);
	}

	/**
	 * @method deallocateSlots(start, count: Number): this
	 * Deallocates `count` slots for indices, started with the `start`th slot.
	 * Both `start` and `count` must be multiples of 3.
	 */
	deallocateSlots(start, count) {
		if (count % 3) {
			throw new Error(
				"Number of vertices to be deallocated from a TriangleIndices must be a multiple of 3"
			);
		}
		if (start % 3) {
			throw new Error(
				"The starting slot to be deallocated from a TriangleIndices must be a multiple of 3"
			);
		}
		this._slotAllocator.deallocateBlock(start, count);
		return this;
	}

	// Internal only. Does the GL drawElement() calls, but assumes that everyhing else
	// (bound program, textures, attribute name-locations, uniform name-locations-values)
	// has been set up already.
	drawMe() {
		this.bindMe();
		this._slotAllocator.forEachBlock((start, length) => {
			const startByte = start * this._bytesPerSlot;
			this._gl.drawElements(this._gl.TRIANGLES, length, this._type, startByte);
		});
	}
}

/**
 * @class Triangle
 *
 * Sintactic sugar over a triplet of vertex indices.
 *
 * Cannot be instantiated directly; a `TriangleIndices` must be used (since every
 * `Triangle` belongs to one and only one `TriangleIndices`).
 *
 * Instantiating a `Triangle` automativally allocates vertex slots in
 * the `TriangleIndices`.
 *
 * @example
 * ```
 * const trigs = new glii.TriangleIndices( // etc // );
 *
 * let trig1 = new trigs.Triangle();
 * trig1.setVertices(1000,1001,1002);
 * ```
 */

class Triangle {
	constructor(indices) {
		this._container = indices;
		this._idx = indices.allocateSlots(3);
		this._allocated = true;
	}

	/**
	 * @method setVertices(v1: Number, v2: Number, v3: Number): this
	 * Sets the vertex indices for this triangle.
	 *
	 * The indices passed must exist (and likely, have values) in any
	 * `AttributeBuffer`s being used together with the containing `TriangleIndices`
	 * in a GL program.
	 *
	 * Internally, this is akin to calling `IndexBuffer.set(idx, [v1,v2,v3])`,
	 * if `idx` to `idx+2` were allocated manually.
	 */
	setVertices(v1, v2, v3) {
		if (!this._allocated) {
			throw new Error(
				"Cannot set vertices in a `Triangle` which has been destroyed."
			);
		}
		this._container.set(this._idx, [v1, v2, v3]);
		return this;
	}

	/**
	 * @method destroy():this
	 * Signals the containing `TriangleIndices` that this triangle should not
	 * be drawn anymore.
	 *
	 * [`delete`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete)ing
	 * all references to this instances manually, right afterwards, is encouraged.
	 */
	destroy() {
		this._container.deallocateSlots(this._idx, 3);
		this._allocated = false;
		return this;
	}
}

/**
 * @class Quad
 *
 * Sintactic sugar over two triangles forming a quadrangle (hence, "quad").
 *
 * Cannot be instantiated directly; a `TriangleIndices` must be used (since every
 * `Quad` belongs to one and only one `TriangleIndices`).
 *
 * Instantiating a `Quad` automativally allocates vertex slots in
 * the `TriangleIndices` enough for two triangles.
 *
 * @example
 * ```
 * const trigs = new glii.TriangleIndices( // etc // );
 *
 * let quad1 = new trigs.Quad();
 * quad1.setVertices(1000,1001,1002,1003);
 * ```
 */

class Quad {
	constructor(indices) {
		this._container = indices;
		this._idx = indices.allocateSlots(6);
		this._allocated = true;
	}

	/**
	 * @method setVertices(v1: Number, v2: Number, v3: Number, v4: Number): this
	 * Sets the vertex indices for this quad.
	 *
	 * The indices passed must exist (and likely, have values) in any
	 * `AttributeBuffer`s being used together with the containing `TriangleIndices`
	 * in a GL program.
	 *
	 * Internally, this is akin to calling `IndexBuffer.set(idx, [v1,v2,v3])`
	 * and `IndexBuffer.set(idx, [v1,v3,v4])`, if `idx` to `idx+5`
	 * were allocated manually.
	 */
	setVertices(v1, v2, v3, v4) {
		if (!this._allocated) {
			throw new Error("Cannot set vertices in a `Quad` which has been destroyed.");
		}
		this._container.set(this._idx, [v1, v2, v3]);
		this._container.set(this._idx + 3, [v1, v3, v4]);
		return this;
	}

	/**
	 * @method destroy():this
	 * Signals the containing `TriangleIndices` that this triangle should not
	 * be drawn anymore.
	 *
	 * [`delete`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete)ing
	 * all references to this instances manually, right afterwards, is encouraged.
	 */
	destroy() {
		this._container.deallocateSlots(this._idx, 6);
		this._allocated = false;
	}
}

/**
 * @class TriangleIndices
 * @factory GliiFactory.TriangleIndices(options: TriangleIndices options)
 * @class Glii
 * @section Class wrappers
 * @property TriangleIndices(options: TriangleIndices options): Prototype of TriangleIndices
 * Wrapped `TriangleIndices` class
 */
registerFactory("TriangleIndices", function (gl, gliiFactory) {
	return class WrappedTriangleIndices extends TriangleIndices {
		constructor(options) {
			super(gl, gliiFactory, options);
		}
	};
});

/**
 * @class LoDAllocator
 *
 * An expansion of `Allocator`; its purpose is to allocate blocks linked to
 * an identifier; and instead of iterating through allocated blocks, can
 * iterate through a filtered subset of blocks.
 *
 * The idea is to allow for level-of-detail (LoD) triangle meshes. Several
 * meshes with different LoD IDs can be allocated on the same underlying
 * `IndexBuffer`, and then one specific LoD can be filtered out to be drawn.
 *
 * @example
 *
 * The `LoDAllocator` class is `import`ed directly from the `glii` module:
 *
 * ```
 * import { default as Glii } from "path_to_glii/index.mjs";
 * import { default as LoDAllocator } from "path_to_glii/LoDAllocator.mjs";
 *
 * const glii = GliiFactory(// etc //);
 *
 * const myAllocator = new LoDAllocator();
 * ```
 *
 * Trying to spawn an `LoDAllocator` from a `GliiFactory` will fail:
 *
 * ```
 * import { default as Glii, LoDAllocator } from "path_to_glii/index.mjs";
 * const glii = GliiFactory(// etc //);
 *
 * const myAllocator = new glii.LoDAllocator();	// BAD!
 * ```
 *
 */

class LoDAllocator {
	constructor(max = Number.MAX_SAFE_INTEGER) {
		/**
		 * @constructor Allocator(max: Number)
		 * Creates a new `Allocator` instance, given the upper limit
		 * of the allocatable area.
		 */

		this._max = max;
		// The 'points' structure is effectively a linked list of
		// start points of free/allocated regions.
		this._points = new Map();
		this._points.set(0, {
			free: true,
			next: max,
			data: undefined,
		});
	}

	/**
	 * @method allocateBlock(size:Number, data: Number): Number
	 * Given the count of IDs to allocate, returns a `Number` with the
	 * first ID of the allocated block (last would be return + count - 1).
	 *
	 * Receives an numerical `data` parameter that will be attached
	 * internally to the allocation (and shall be used for filtering
	 * allocation blocks later on). This should be the LoD (if the LoD is
	 * numerical)
	 * @alternative
	 * @method allocateBlock(size:Number, data: String): Number
	 * Can take a `String` as the LoD identifier as well.
	 * @method allocateBlock(size:Number, data: Object): Number
	 * Can take any `Object` as the LoD identifier as well. Do note that,
	 * internally, the `===` equality operator is used to check equality
	 * of LoD identifiers among allocation blocks.
	 */
	allocateBlock(size, data) {
		let prev = 0;
		let prevBlock;
		let ptr = 0;

		while (true) {
			const block = this._points.get(ptr);
			const end = ptr + size;

			if (block.free) {
				if (ptr === 0 && end < block.next) {
					// Allocate at the very beginning, leave gap
					this._points.set(0, { free: false, next: end, data });
					this._points.set(end, { free: true, next: block.next });
					return 0;
				}

				const nextBlock = this._points.get(end);

				if (ptr === 0 && end === block.next) {
					if (data === nextBlock.data) {
						// Allocate at the very beginning, merge with next block
						this._points.set(0, { free: false, next: nextBlock.next, data });
						this._points.delete(block.next);
						return 0;
					} else {
						// Allocate at the very beginning, do not merge with next block
						this._points.set(0, { free: false, next: end, data });
						//this._points.set(end, { free: true, next: block.next });
						return 0;
					}
				}
				if (end < block.next) {
					if (prevBlock.data === data) {
						// Increase the size of the previous, used, block
						this._points.set(prev, { free: false, next: end, data });
						this._points.delete(ptr);
						this._points.set(end, { free: true, next: block.next });
						return ptr;
					} else {
						// Allocate next to previous, used, block
						this._points.set(ptr, { free: false, next: end, data });
						this._points.set(end, { free: true, next: block.next });
						return ptr;
					}
				}
				if (end === block.next) {
					if (prevBlock.data === data && nextBlock.data === data) {
						// Allocate an entire free block,
						// merge neighbouring used blocks
						this._points.set(prev, { free: false, next: nextBlock.next });
						this._points.delete(ptr);
						this._points.delete(block.next);
						return ptr;
					} else if (prevBlock.data === data && nextBlock.data !== data) {
						// Merge with the previous block
						this._points.set(prev, { free: false, next: block.next });
						this._points.delete(ptr);
						return ptr;
					} else if (prevBlock.data !== data && nextBlock.data === data) {
						// Merge with the next block
						this._points.set(ptr, {
							free: false,
							next: nextBlock.next,
							data,
						});
						this._points.delete(block.next);
					} else {
						// Set block as allocated, do not merge anything
						this._points.set(ptr, { free: false, next: end, data });
						return ptr;
					}
				}
			}

			prev = ptr;
			prevBlock = block;
			ptr = block.next;
			if (ptr <= prev) {
				throw new Error(`Bad allocation map: tried to go backwards`);
			}
			// 			if (ptr === Number.MAX_SAFE_INTEGER) {
			if (ptr >= this._max) {
				throw new Error(`No allocatable space`);
			}
		}
	}

	/**
	 * @method deallocateBlock(start: Number, size: Number): this
	 * Given a starting ID and the size of a block, deallocates that block
	 * (marks it as allocatable again).
	 *
	 * The given start and size must fall within the same allocation block (i.e.
	 * the deallocation must correspond to just one LoD).
	 */
	deallocateBlock(start, size) {
		let prev = 0;
		let prevBlock;
		let ptr = 0;
		const end = start + size;

		while (true) {
			const block = this._points.get(ptr);

			if (!block.free) {
				const nextBlock = this._points.get(end);

				if (ptr === 0 && start === 0 && end === block.next) {
					if (nextBlock.free) {
						// Deallocate entire block at beginning, grow
						// next free block
						this._points.set(0, { free: true, next: nextBlock.next });
						this._points.delete(end);
						return this;
					} else {
						// Deallocate entire block at beginning, ignore
						// next used block
						this._points.set(0, { free: true, next: block.next });
						return this;
					}
				} else if (ptr === 0 && start === 0 && end < block.next) {
					// Deallocate partial block at beginning,
					// lower next block start
					this._points.set(0, { free: true, next: end });
					this._points.set(end, {
						free: false,
						next: block.next,
						data: block.data,
					});
					return this;
				} else if (ptr === start && end < block.next) {
					if (prevBlock.free) {
						// Deallocate at the beginning of a used block
						// Grow the previous free block
						this._points.set(prev, { free: true, next: end });
						this._points.delete(ptr);
						this._points.set(end, {
							free: false,
							next: block.next,
							data: block.data,
						});
						return this;
					} else {
						// Deallocate at the beginning of a used block,
						// ignore previous free block
						this._points.set(ptr, { free: true, next: end });
						this._points.set(end, {
							free: false,
							next: block.next,
							data: block.data,
						});
						return this;
					}
				} else if (ptr === start && end === block.next) {
					if (prevBlock.free && nextBlock.free) {
						// Deallocate the entire block
						// Merge neighbouring free blocks
						this._points.set(prev, { free: true, next: nextBlock.next });
						this._points.delete(ptr);
						this._points.delete(block.next);
						return this;
					} else if (!prevBlock.free && !nextBlock.free) {
						// Deallocate the entire block
						// Ignore neighbouring used blocks
						this._points.set(ptr, { free: true, next: block.next });
						return this;
					} else if (prevBlock.free && !nextBlock.free) {
						// Deallocate the entire block
						// Merge previous free block
						this._points.set(prev, { free: true, next: block.next });
						this._points.delete(ptr);
						return this;
					} else if (!prevBlock.free && nextBlock.free) {
						// Deallocate the entire block
						// Merge next free block
						this._points.set(ptr, { free: true, next: nextBlock.next });
						this._points.delete(block.next);
						return this;
					}
				} else if (ptr < start && end === block.next) {
					if (nextBlock.free) {
						// Deallocate the end of the block
						// Grow the next free block
						this._points.set(ptr, {
							free: false,
							next: start,
							data: block.data,
						});
						this._points.delete(block.next);
						this._points.set(start, { free: true, next: nextBlock.next });
						return this;
					} else {
						// Deallocate the end of the block
						// Ignore next used block
						this._points.set(ptr, {
							free: false,
							next: start,
							data: block.data,
						});
						this._points.set(start, { free: true, next: block.next });
						return this;
					}
				} else if (ptr < start && end < block.next) {
					// Deallocate middle of a block
					this._points.set(ptr, { free: false, next: start, data: block.data });
					this._points.set(start, { free: true, next: end });
					this._points.set(end, {
						free: false,
						next: block.next,
						data: block.data,
					});
					return this;
				}
			}

			prev = ptr;
			prevBlock = block;
			ptr = block.next;
			if (ptr <= prev) {
				throw new Error(`Bad allocation map: tried to go backwards`);
			}
			// if (start === Number.MAX_SAFE_INTEGER) {
			if (ptr >= this._max) {
				throw new Error(`Could not deallocate. Sparse?`);
			}
		}
	}

	/**
	 * @method forEachBlock(fn: Function, data: Number): this
	 * Runs the given callback `Function` `fn`, only on blocks allocated with
	 * an LoD identifier (`data`) exactly equal (`===`) to the given one. `fn`
	 * receives the start and length of each allocated block as its two
	 * parameters.
	 * @alternative
	 * @method forEachBlock(fn: Function, data: String): this
	 * @alternative
	 * @method forEachBlock(fn: Function, data: undefined): this
	 * Runs the given fallback `Function` `fn` on all allocated blocks.
	 */
	forEachBlock(fn, data) {
		let ptr = 0;
		while (true) {
			const block = this._points.get(ptr);
			if (!block.free && (data === undefined || block.data === data)) {
				fn(ptr, block.next - ptr);
			}
			if (block.next <= ptr) {
				throw new Error(`Bad allocation map: tried to go backwards`);
			}
			ptr = block.next;
			if (ptr >= this._max) {
				return this;
			}
		}
	}
}

/**
 * @class LoDIndices
 * @inherits IndexBuffer
 * @relationship compositionOf LoDAllocator, 0..1, 1..1
 *
 * Similar to `SparseIndices`, a `LoDIndices` allows for allocating and
 * deallocating blocks of primitive slots via `allocateSlots` and `deallocateSlots`.
 *
 * The main difference is that each allocation must be done with a level-of-detail
 * (LoD) identifier, commonly a `Number` or a `String` (but also a `Symbol`).
 *
 * Like `SparseIndices`, calling `drawMe` will make a WebGL draw call per
 * allocation block. Unlike `SparseIndices`, only those blocks with a specific
 * LoD will be drawn.
 *
 */

class LoDIndices extends IndexBuffer {
	constructor(gl, gliiFactory, options = {}) {
		super(gl, gliiFactory, options);

		// Allocator instance for blocks in self's `ELEMENT_ARRAY_BUFFER`.
		if (this._growFactor) {
			this._slotAllocator = new LoDAllocator();
		} else {
			this._slotAllocator = new LoDAllocator(this._size);
		}
	}

	/**
	 * @method allocateSlots(count: Number, lod: Number): Number
	 * Allocates `count` slots for indices. Returns the offset of the first
	 * slot.
	 *
	 * For `gl.TRIANGLES` (`gl.LINES`), allocate 3 (2) slots per triangle (line).
	 * @alternative
	 * @method allocateSlots(count: Number, lod: String): Number
	 */
	allocateSlots(count, lod) {
		return this._slotAllocator.allocateBlock(count, lod);
	}

	/**
	 * @method allocateSet(indices: Array of Number, lod: Number, relative?:Boolean): Number
	 * Combination of `allocate()` and `set()`. Allocates the neccesary
	 * space for the given indices in the given LoD, and sets their values.
	 *
	 * If `relative` is set to `true`, then indices are considered to be
	 * relative to the allocation start (otherwise, they're absolute).
	 *
	 * Returns the offset of the allocation block start.
	 * @alternative
	 * @method allocateSet(indices: Array of Number, lod: String, relative?:Boolean): Number
	 */
	allocateSet(lod, indices, relative = false) {
		const start = this.allocateSlots(indices.length, lod);
		if (relative) {
			this.set(
				start,
				indices.map((i) => start + i)
			);
		} else {
			this.set(start, indices);
		}
		return start;
	}

	/**
	 * @method deallocateSlots(start, count: Number): this
	 * Deallocates `count` slots for indices, started with the `start`th slot.
	 *
	 * For `gl.TRIANGLES` (`gl.LINES`), allocate 3 (2) slots per triangle (line).
	 *
	 * All deallocated slots must belong to the same LoD. Otherwose, behaviour
	 * may be unpredictable.
	 * @alternative
	 * @method deallocateSlots(start, count: Number): this
	 */
	deallocateSlots(start, count) {
		this._slotAllocator.deallocateBlock(start, count);
		return this;
	}

	/**
	 * @method deallocateLoD(lod: Number): this
	 * Deallocates all the slots of the given LoD.
	 * @alternative
	 * @method deallocateLoD(lod: String): this
	 */
	deallocateLoD(lod) {
		return this.forEachBlock(lod, this.deallocateSlots.bind(this));
	}

	/**
	 * @method forEachBlock(lod: Number, fn: Function): this
	 * Runs the given callback `Function` `fn` once per allocated block, but
	 * only for blocks with the given LoD.
	 *
	 * The callback function shall receive the start and length of each
	 * allocated block. Both figures are given in number of *vertex slots*
	 * and not in primitives (i.e. divide by 3 when working with triangles).
	 * @alternative
	 * @method forEachBlock(lod: String, count: Number): Number
	 */
	forEachBlock(fn, lod) {
		this._slotAllocator.forEachBlock(fn, lod);
		return this;
	}

	/**
	 * @method copyWithin(target: Number, start: Number, end: Number): this
	 * Akin to `TypedArray.copyWithin()` copies indices from `start` to `end`
	 * into a section of itself, starting at `target`.
	 *
	 * Unlike `TypedArray.copyWithin()`, it will grow the data structures if needed.
	 *
	 * The typical use case is to copy a portion of a LoD into another LoD.
	 */
	copyWithin(target, start, end) {
		if (!this._ramData) {
			throw new Error("Cannot copyWithin() in a non-growable LoDIndices.");
		}
		this.grow(target + end - start);
		this._ramData.copyWithin(target, start, end);

		this._gl.bufferSubData(
			this._gl.ELEMENT_ARRAY_BUFFER,
			target * this._bytesPerSlot,
			this._ramData.subarray(start, end)
		);
		return this;
	}

	// Internal only. Does the GL drawElement() calls, but assumes that everyhing else
	// (bound program, textures, attribute name-locations, uniform name-locations-values)
	// has been set up already.
	drawMe(lod) {
		this.bindMe();
		this._slotAllocator.forEachBlock((start, length) => {
			const startByte = start * this._bytesPerSlot;
			this._gl.drawElements(this._drawMode, length, this._type, startByte);
		}, lod);
	}

	// Internal only. Does the GL drawElement() calls, but assumes that everyhing else
	// (bound program, textures, attribute name-locations, uniform name-locations-values)
	// has been set up already.
	drawMePartial(start, count) {
		this.bindMe();
		this._gl.drawElements(
			this._drawMode,
			count,
			this._type,
			start * this._bytesPerSlot
		);
	}
}

/**
 * @factory GliiFactory.LoDIndices(options: LoDIndices options)
 * @class Glii
 * @section Class wrappers
 * @property LoDIndices(options: LoDIndices options): Prototype of LoDIndices
 * Wrapped `LoDIndices` class
 */
registerFactory("LoDIndices", function (gl, gliiFactory) {
	return class WrappedLoDIndices extends LoDIndices {
		constructor(options) {
			super(gl, gliiFactory, options);
		}
	};
});

/**
 * @class WireframeTriangleIndices
 * @inherits TriangleIndices
 *
 * A decorated flavour of `TriangleIndices`; draws each triplet of vertices as a
 * `gl.LINE_LOOP` to produce a wireframe result.
 *
 * The width of the wireframe can be configured via the `width` constructor option.
 * Otherwise, this class works as a drop-in replacement for `TriangleIndices`.
 *
 * Note that the available line widths depend on your platform (i.e. graphics card +
 * web browser + OpenGL software stack). You should not assume that line widths
 * greater than 1 are available.
 */

class WireframeTriangleIndices extends TriangleIndices {
	constructor(gl, gliiFactory, options = {}) {
		super(gl, gliiFactory, options);
		/**
		 * @section
		 * @aka WireframeTriangleIndices options
		 * @option width: Number = 1; Width of the wireframe lines, in pixels.
		 */
		this._width = options.width || 1;
	}

	// Internal only. Does the GL drawElement() calls, but assumes that everyhing else
	// (bound program, textures, attribute name-locations, uniform name-locations-values)
	// has been set up already.
	drawMe() {
		this.bindMe();
		this._gl.lineWidth(this._width);
		this._slotAllocator.forEachBlock((start, length) => {
			for (let i = 0; i < length; i += 3) {
				const startByte = (start + i) * this._bytesPerSlot;
				this._gl.drawElements(this._gl.LINE_LOOP, 3, this._type, startByte);
			}
		});
	}

	drawMePartial(start, count) {
		this.bindMe();
		this._gl.lineWidth(this._width);
		for (let i = 0; i < count; i += 3) {
			const startByte = (start + i) * this._bytesPerSlot;
			this._gl.drawElements(this._gl.LINE_LOOP, 3, this._type, startByte);
		}
	}
}

/**
 * @class WireframeTriangleIndices
 * @factory GliiFactory.WireframeTriangleIndices(options: WireframeTriangleIndices options)
 * @class Glii
 * @section Class wrappers
 * @property WireframeTriangleIndices(options: WireframeTriangleIndices options): Prototype of WireframeTriangleIndices
 * Wrapped `WireframeTriangleIndices` class
 */
registerFactory("WireframeTriangleIndices", function (gl, gliiFactory) {
	return class WrappedWireframeTriangleIndices extends WireframeTriangleIndices {
		constructor(options) {
			super(gl, gliiFactory, options);
		}
	};
});

/**
 * @class PointIndices
 * @inherits SparseIndices
 *
 * Represents a set of vertex indices for point primitives (i.e. one vertex per point).
 *
 * The draw mode of a `PointIndices` is forced into being `gl.POINTS`.
 */

class PointIndices extends SparseIndices {
	constructor(gl, gliiFactory, options = {}) {
		options.drawMode = gl.POINTS;
		super(gl, gliiFactory, options);
	}

	/**
	 * @method allocatePoints(count: Number): Number
	 */
	allocatePoints(count) {
		// For points, there shall be one slot per point = vertex.
		return super.allocateSlots(count);
	}

	/**
	 * @method deallocatePoints(start, count: Number): this
	 */
	deallocatePoints(start, count) {
		return super.deallocateSlots(start, count);
	}
}

/**
 * @factory GliiFactory.PointIndices(options: PointIndices options)
 * @class Glii
 * @section Class wrappers
 * @property PointIndices(options: PointIndices options): Prototype of PointIndices
 * Wrapped `PointIndices` class
 */
registerFactory("PointIndices", function (gl, gliiFactory) {
	return class WrappedPointIndices extends PointIndices {
		constructor(options) {
			super(gl, gliiFactory, options);
		}
	};
});

// Akin to typeMap, but in reverse: maps GL constants to TypedArray prototypes intead.

// Includes constants for texture pixel types as well (same kind of mapping, constant
// to corresponding TypedArray prototype able to hold that kind of data).

// prettier-ignore
var reverseTypeMap = new Map([
	[0x1400,	Int8Array   ], // gl.BYTE
	[0x1401,	Uint8Array  ], // gl.UNSIGNED_BYTE
	[0x1402,	Int16Array  ], // gl.SHORT
	[0x1402,	Int16Array  ], // gl.SHORT
	[0x1403,	Uint16Array ], // gl.UNSIGNED_SHORT
	[0x1404,	Int32Array  ], // gl.INT
	[0x1405,	Uint32Array ], // gl.UNSIGNED_INT
	[0x1406,	Float32Array], // gl.FLOAT

	[0x8033,	Uint16Array], // gl.UNSIGNED_SHORT_4_4_4_4
	[0x8034,	Uint16Array], // gl.UNSIGNED_SHORT_5_5_5_1
	[0x8363,	Uint16Array], // gl.UNSIGNED_SHORT_5_6_5

	[0x84FA,	Uint16Array], // ext.UNSIGNED_INT_24_8_WEBGL from WEBGL_depth_texture

	[0x8D61,	Uint16Array], // ext.HALF_FLOAT_OES from OES_texture_half_float
]);

/**
 * @class RenderBuffer
 * @inherits AbstractFrameBufferAttachment
 *
 * Wraps a [`WebGLRenderbuffer`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderbuffer)
 * and offers convenience methods.
 *
 * A `RenderBuffer` is most akin to an image: a rectangular collection of
 * pixels with `width`, `height` and a `internalFormat`. The main difference
 * between a `RenderBuffer` and a 2D `Texture` is the different `internalFormat`s.
 */


class RenderBuffer {
	#width;
	#height;
	#gl;
	#rb;
	#internalFormat;
	#multisample;

	constructor(gl, opts = {}) {
		this.#gl = gl;
		this.#rb = gl.createRenderbuffer();

		// @option size: Array of Number
		// Width and height of this `FrameBuffer`, in pixels, as a 2-component array.
		// If specified, it overrides the `width` and `height` options.
		if ("size" in opts) {
			if ("width" in opts || "height" in opts) {
				throw new Error(
					'Expected either "size" or "width"/"height", but both were provided'
				);
			}
			this.#width = opts.size[0];
			this.#height = opts.size[1];
		} else {
			// @option width: Number = 256
			// Width of this `RenderBuffer`, in pixels.
			this.#width = opts.width || 256;

			// @option height: Number = 256
			// Height of this `RenderBuffer`, in pixels.
			this.#height = opts.height || 256;
		}

		// @option internalFormat: Renderbuffer format constant = gl.RGBA4
		// Internal format of this `RenderBuffer`, as per [`renderBufferStorage`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/renderbufferStorage).
		this.#internalFormat = opts.internalFormat || gl.RGBA4;

		// @option multisample: Number = 0
		// Number of samples to be used in the `RenderBuffer`. Set to higher values
		// for smoother antialiasing. Only has effect if the Glii context is WebGL2.
		this.#multisample = opts.multisample || 0;

		this.resize(this.#width, this.#height);
	}

	/**
	 * @property rb: WebGLRenderbuffer
	 * The underlying instance of `WebGLRenderBuffer`. Read-only.
	 */
	get rb() {
		if (!this.#rb) {
			throw new Error("RenderBuffer has been destroyed and cannot be used");
		}
		return this.#rb;
	}

	/**
	 * @method resize(x: Number, y: Number): this
	 * Sets a new size for the renderbuffer (destroying its data in the process).
	 */
	resize(x, y) {
		this.#width = x;
		this.#height = y;
		const gl = this.#gl;

		gl.bindRenderbuffer(gl.RENDERBUFFER, this.#rb);

		if ("renderbufferStorageMultisample" in gl && this.#multisample > 1) {
			gl.renderbufferStorageMultisample(
				gl.RENDERBUFFER,
				this.#multisample,
				this.#internalFormat,
				this.#width,
				this.#height
			);
		} else {
			gl.renderbufferStorage(
				gl.RENDERBUFFER,
				this.#internalFormat,
				this.#width,
				this.#height
			);
		}
		return this;
	}

	/**
	 * @method destroy(): this
	 * Tells WebGL to free resources associated with this `RenderBuffer`. Use
	 * when the `RenderBuffer` won't be used anymore.
	 *
	 * After being destroyed, WebGL programs should not use any `FrameBuffer` which
	 * points to the destroyed `RenderBuffer`.
	 */
	destroy() {
		this.#gl.deleteRenderbuffer(this.#rb);
		this.#rb = undefined;
	}
}

/**
 * @factory GliiFactory.RenderBuffer(options: RenderBuffer options)
 * @class Glii
 * @section Class wrappers
 * @property RenderBuffer(options: RenderBuffer options): Prototype of RenderBuffer
 * Wrapped `RenderBuffer` class
 */
registerFactory("RenderBuffer", function (gl) {
	return class WrappedRenderBuffer extends RenderBuffer {
		constructor(opts) {
			super(gl, opts);
		}
	};
});

class FrameBuffer {
	#gl;
	#fb;

	#width;
	#height;

	#colourAttachs;
	#depth;
	#stencil;

	constructor(gl, opts = {}) {
		this.#gl = gl;
		this.#fb = gl.createFramebuffer();

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.#fb);

		// @section
		// @aka FrameBuffer options
		// @option size: Array of Number
		// Width and height of this `FrameBuffer`, in pixels, as a 2-component array.
		// If specified, it overrides the `width` and `height` options.
		if ("size" in opts) {
			if ("width" in opts || "height" in opts) {
				throw new Error(
					'Expected either "size" or "width"/"height", but both were provided'
				);
			}
			this.#width = opts.size[0];
			this.#height = opts.size[1];
		} else {
			// @option width: Number = 256
			// Width of this `RenderBuffer`, in pixels.
			this.#width = opts.width || 256;

			// @option height: Number = 256
			// Height of this `RenderBuffer`, in pixels.
			this.#height = opts.height || 256;
		}

		// @option colour: Array of AbstractFrameBufferAttachment = []
		// An array of colour attachment(s) (either `Texture`s or `RenderBuffer`s)
		this.#colourAttachs = opts.colour || opts.color || [];
		// 		this.colourAttachZero = colourAttachs[0];
		this.#colourAttachs.forEach((att, i) => {
			if (att instanceof Texture) {
				att.getUnit();
				if (!att.isLoaded()) {
					// If the texture is empty (which means, no width/height set),
					// init it to a blank texture the same size as this FB.
					/// TODO: This will fail for pixel types UNSIGNED_SHORT_5_5_5_1 *et al*,
					/// since the size of the arrays and the components per pixel do not match.
					/// There is a need for an additional utility function to instantiate
					/// this kind of typed array.
					att.texArray(
						this.#width,
						this.#height,
						new (reverseTypeMap.get(att.type))(
							this.#width * this.#height * att.getComponentsPerTexel()
						)
					);

					// gl.texImage2D(gl.TEXTURE_2D, 0, this.internalFormat,this.#width, this.#height, 0, this.format, this.type, null);
				}
				gl.framebufferTexture2D(
					gl.FRAMEBUFFER,
					gl.COLOR_ATTACHMENT0 + i,
					gl.TEXTURE_2D,
					att.tex,
					0
				);
			} else if (att instanceof RenderBuffer) {
				gl.framebufferRenderbuffer(
					gl.FRAMEBUFFER,
					gl.COLOR_ATTACHMENT0 + i,
					gl.RENDERBUFFER,
					att.rb
				);
			}
		});

		// @option depth: RenderBuffer = false
		// A `RenderBuffer` for the depth attachment. Must have a depth-compatible `internalformat`.
		if (opts.depth && opts.depth instanceof RenderBuffer) {
			this.#depth = opts.depth;
			gl.framebufferRenderbuffer(
				gl.FRAMEBUFFER,
				gl.DEPTH_ATTACHMENT,
				gl.RENDERBUFFER,
				opts.depth.rb
			);
		}

		// @option stencil: RenderBuffer = false
		// A `RenderBuffer` for the stencil attachment. Must have a stencil-compatible `internalformat`.
		if (opts.stencil && opts.stencil instanceof RenderBuffer) {
			this.#stencil = opts.stencil;
			gl.framebufferRenderbuffer(
				gl.FRAMEBUFFER,
				gl.STENCIL_ATTACHMENT,
				gl.RENDERBUFFER,
				opts.stencil.rb
			);
		}

		this.#checkStatus();
	}

	/**
	 * @property fb: WebGLFramebuffer
	 * The underlying instance of `WebGLFramebuffer`. Read-only.
	 */
	get fb() {
		return this.#fb;
	}

	/**
	 * @property width: Number
	 * The width of the framebuffer (and all its attachments), in pixels. Read-only.
	 */
	get width() {
		return this.#width;
	}

	/**
	 * @property height: Number
	 * The height of the framebuffer (and all its attachments), in pixels. Read-only.
	 */
	get height() {
		return this.#height;
	}

	/**
	 * @method resize(x: Number, y: Number): this
	 * Sets a new size for the framebuffer's attachments (textures/renderbuffers),
	 * destroying their data in the process.
	 */
	resize(x, y) {
		this.#height = y;
		this.#width = x;

		this.#colourAttachs.forEach((att, _) => {
			att.getUnit();
			att.texArray(
				x,
				y,
				new (reverseTypeMap.get(att.type))(
					this.#width * this.#height * att.getComponentsPerTexel()
				)
			);
		});

		if (this.#depth && this.#depth instanceof RenderBuffer) {
			this.#depth.resize(x, y);
		}

		if (this.#stencil && this.#stencil instanceof RenderBuffer) {
			this.#depth.resize(x, y);
		}
		this.#checkStatus();

		return this;
	}

	/**
	 * @method destroy(): this
	 * Tells WebGL to free resources associated with this framebuffer. Use
	 * when the framebuffer won't be used anymore.
	 *
	 * After being destroyed, the framebuffer should not be used in a program.
	 * Does not destroy any associated textures or renderbuffers.
	 */
	destroy() {
		this.#gl.deleteFramebuffer(this.#fb);
	}

	#checkStatus() {
		const gl = this.#gl;
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status === gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT) {
			// One reason for this is colour attachment being textures of a format/type
			// different than RGBA/UNSIGNED_BYTE. See
			// https://www.khronos.org/registry/webgl/extensions/WEBGL_draw_buffers/
			throw new Error(
				`The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete.
For valid format/type combinations of framebuffer attachments, see https://www.khronos.org/registry/webgl/specs/1.0/#6.6 and https://www.khronos.org/registry/webgl/extensions/WEBGL_draw_buffers/`
			);
		} else if (status === gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT) {
			throw new Error("There is no attachment.");
		} else if (status === gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS) {
			throw new Error("Height and width of the attachment are not the same.");
		} else if (status === gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT) {
			throw new Error("There is no attachment.");
		} else if (status === gl.FRAMEBUFFER_UNSUPPORTED) {
			throw new Error(
				"The format of the attachment is not supported, or depth and stencil attachments are not the same renderbuffer."
			);
		} else if (status !== gl.FRAMEBUFFER_COMPLETE) {
			throw new Error("FrameBuffer invalid " + status);
		}
	}

	/**
	 * @method readPixels: TypedArray
	 * @param x?: Number
	 * @param y?: Number
	 * @param width?: Number
	 * @return TypedArray
	 *
	 * Reads pixels from the colour attachment of the framebuffer, and returns a `TypedArray`
	 * (e.g. a `Uint8Array` for 8-bit RGBA textures) with the data.
	 *
	 * Defaults to reading the entire colour attachment (from `0,0` to its witdh-height),
	 * handles the datatypes, and creates a new `TypedArray` of the appropriate kind.
	 *
	 */
	/// TODO: How are float32 readbacks handled?? It seems that they neccesarily need an extension,
	/// but the documentation is scarce about the issue.

	readPixels(x, y, w, h) {
		const gl = this.#gl;

		x = x || 0;
		y = y || 0;
		w = w || this.#width;
		h = h || this.#height;

		const attach = this.#colourAttachs[0];
		let format, type, arrClass;
		let itemsPerPx = 1;

		if (attach instanceof Texture) {
			if (
				attach.internalFormat === gl.RGBA ||
				attach.internalFormat === gl.RGB ||
				attach.internalFormat === gl.ALPHA
			) {
				format = attach.internalFormat;
				itemsPerPx = attach.getComponentsPerTexel();
			} else if (attach.internalFormat === gl.LUMINANCE) {
				/// Untested!!!
				format = gl.RGB;
				itemsPerPx = 3;
			} else if (attach.internalFormat === gl.R32F) {
				// Needs WebGL2, or float texture extensions
				// This reads 4 floats instead of 1 float per pixel. But works.
				// Using gl.RED fails for whatever reason.
				format = gl.RGBA;
				itemsPerPx = 4;
			} else if (attach.internalFormat === gl.RG32F) {
				// As the R32F case.
				format = gl.RGBA;
				itemsPerPx = 4;
			} else {
				throw new Error(
					"Pixels cannot be read back from texture: texture internal format must be R32F, RGB, RGBA, ALPHA, LUMINANCE or LUMINANCE_ALPHA (all other formats yet unsupported by glii)"
				);
			}

			type = attach.type || gl.UNSIGNED_BYTE;
			arrClass = reverseTypeMap.get(type);

			if (!arrClass) {
				throw new Error("Unknown texture pixel type");
			}
		} else {
			// attach instanceof RenderBuffer
			if (attach.internalFormat === gl.RGBA4) {
				format = gl.RGBA;
				type = gl.UNSIGNED_SHORT_4_4_4_4;
				arrClass = Uint16Array;
			} else if (attach.internalFormat === gl.RGB565) {
				format = gl.RGB565;
				type = gl.UNSIGNED_SHORT_5_6_5;
				arrClass = Uint16Array;
			} else if (attach.internalFormat === gl.RGB5_A1) {
				format = gl.RGB5_A1;
				type = gl.UNSIGNED_SHORT_5_5_5_1;
				arrClass = Uint16Array;
			} else {
				throw new Error(
					"Pixels cannot be read back from renderbuffer: renderbuffer internal format must be RGBA4, RGB565 or RGB5_A1"
				);
			}
		}

		const pixelCount = w * h;

		const out = new arrClass(pixelCount * itemsPerPx);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.#fb);

		gl.readPixels(x, y, w, h, format, type, out);
		return out;
	}

	/**
	 * @method debugIntoConsole(): this
	 *
	 * Dumps the contents of the (first) colour attachment into the developer
	 * tools' console, with some `<canvas>` and `console.log("%c")` trickery.
	 *
	 * This is an expensive operation and is meant only for debugging purposes.
	 */
	debugIntoConsole() {
		let canvas = document.createElement("canvas");
		const data = this.#colourAttachs[0].asImageData();
		canvas.width = this.width;
		canvas.height = this.height;
		canvas.getContext("2d").putImageData(data, 0, 0);
		let url = canvas.toDataURL();

		console.log(
			"%c+",
			`
		font-size: 1px;
		border: 1px solid black;
		padding: 0px ${Math.floor(this.width / 4)}px;
		line-height: ${this.height / 2}px;
		height: ${this.height}px;
		background: url(${url});
		background-size: ${this.width / 2}px ${this.height / 2}px;
		color: transparent;
		transform: scale(0.3, -0.3);
		`
		);

		return this;
	}
}

/**
 * @factory GliiFactory.FrameBuffer(options: FrameBuffer options)
 * @class Glii
 * @section Class wrappers
 * @property FrameBuffer(options: FrameBuffer options): Prototype of FrameBuffer
 * Wrapped `FrameBuffer` class
 */
registerFactory("FrameBuffer", function (gl) {
	return class WrappedFrameBuffer extends FrameBuffer {
		constructor(opts) {
			super(gl, opts);
		}
	};
});

class Texture {
	#gl;
	#tex;

	constructor(gl, opts = {}) {
		this.#gl = gl;
		this.#tex = gl.createTexture();

		/**
		 * @section
		 * @aka Texture options
		 * @option minFilter: Texture interpolation constant = gl.NEAREST
		 * Initial value of the `minFilter` property
		 * @option magFilter: Texture interpolation constant = gl.NEAREST
		 * Initial value of the `magFilter` property
		 * @option wrapS: Texture wrapping constant = gl.CLAMP_TO_EDGE
		 * Initial value for the `wrapS` property
		 * @option wrapT: Texture wrapping constant = gl.CLAMP_TO_EDGE
		 * Initial value for the `wrapS` property
		 * @option internalFormat: Texture format constant = gl.RGBA
		 * Initial value for the `internalFormat` property
		 * @option format: Texture format constant = gl.RGBA
		 * Initial value for the `format` property
		 * @option type: Texture type constant = gl.UNSIGNED_BYTE
		 * Initial value for the `type` property
		 */

		// Helper for caching bound textures and their active texture unit
		this._unit = undefined;

		// Helper for LRU-ing texture units. Shall be (re-)set every time
		// this texture is promoted to an available unit
		this._lastActive = performance.now();

		// @property minFilter: Texture interpolation constant = glii.NEAREST
		// Texture minification filter (or "what to do when pixels in the texture
		// are smaller than pixels in the output image")
		this.minFilter = opts.minFilter || gl.NEAREST;

		// @property magFilter: Texture interpolation constant = glii.NEAREST
		// Texture magification filter (or "what to do when pixels in the texture
		// are bigger than pixels in the output image"). Cannot use mipmaps (as
		// mipmaps are always smaller than the texture).
		this.magFilter = opts.magFilter || gl.NEAREST;

		// @property wrapS: Texture wrapping constant
		// Value for the `TEXTURE_WRAP_S` [texture parameter](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter) for any subsequent texture full updates
		this.wrapS = opts.wrapS || gl.CLAMP_TO_EDGE;

		// @property wrapT: Texture wrapping constant
		// Value for the `TEXTURE_WRAP_T` [texture parameter](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter) for any subsequent texture full updates
		this.wrapT = opts.wrapT || gl.CLAMP_TO_EDGE;

		// @property internalFormat: Texture format constant
		// Value for the `internalFormat` parameter for `texImage2D` calls.
		this.internalFormat = opts.internalFormat || gl.RGBA;

		// @property format: Texture format constant
		// Value for the `format` parameter for `texImage2D` calls. in WebGL1, this must
		// be equal to `internalFormat`. For WebGL2, see
		// https://registry.khronos.org/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
		this.format = opts.format || gl.RGBA;

		// @property type: Texture pixel type constant
		// Value for the `type` parameter for `texImage2D` calls.
		this.type = opts.type || gl.UNSIGNED_BYTE;

		// Loaded flag, to let `FrameBuffer` know when the texture has to be init'd
		// with a specific width/height
		this._isLoaded = false;

		this.width = undefined;
		this.height = undefined;
	}

	// Each element of this `WeakMap` is keyed by a `WebGLRenderingContext`, and its value
	// is a plain `Array` of `Texture`s.
	static _boundUnits = new WeakMap();

	/**
	 * @property tex: WebGLTexture
	 * The underlying instance of `WebGLTexture`. Read-only.
	 */
	get tex() {
		if (!this.#tex) {
			throw new Error("Texture has been destroyed and cannot be used");
		}
		return this.#tex;
	}

	/**
	 * @section Internal methods
	 * @method getUnit(): Number
	 * Returns a the texture unit index (or "name" in GL parlance) that this texture
	 * is bound to.
	 *
	 * Calling this method guarantees that the texture is bound into a valid unit,
	 * and that that unit is the active one (until a number of other `Texture`s
	 * call `getUnit()`, at least `MAX_COMBINED_TEXTURE_IMAGE_UNITS`)
	 *
	 * This might expel (unbind) the texture which was used the longest ago.
	 */
	getUnit() {
		this._lastActive = performance.now();
		const gl = this.#gl;
		if (this._unit !== undefined) {
			gl.activeTexture(gl.TEXTURE0 + this._unit);
			// 			console.log("Texture already bound to unit", this._unit);
			return this._unit;
		}

		if (!Texture._boundUnits.has(this.#gl)) {
			const maxUnits = this.#gl.getParameter(
				this.#gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS
			);
			Texture._boundUnits.set(this.#gl, new Array(maxUnits));
		}
		const units = Texture._boundUnits.get(this.#gl);

		let oldestUnit = -1;
		let oldestTime = Infinity;
		for (let i = 0, l = units.length; i < l; i++) {
			if (units[i] === undefined) {
				// 				console.log("Texture newly bound to unit", i);
				gl.activeTexture(gl.TEXTURE0 + i);
				gl.bindTexture(gl.TEXTURE_2D, this.#tex);
				units[i] = this;
				return (this._unit = i);
			}
			if (units[i]._lastActive < oldestTime) {
				oldestUnit = i;
				oldestTime = units[i]._lastActive;
			}
		}
		// 		console.log("Expelled texture to bound to unit", oldestUnit);
		gl.activeTexture(gl.TEXTURE0 + oldestUnit);
		gl.bindTexture(gl.TEXTURE_2D, this.#tex);
		units[oldestUnit]._unit = undefined;
		units[oldestUnit] = this;
		return (this._unit = oldestUnit);
	}

	/**
	 * @method unbind(): this
	 * Forcefully unbinds the texture
	 */
	unbind() {
		if (this._unit === undefined) {
			return;
		}
		const units = Texture._boundUnits.get(this.#gl);
		units[this._unit] = undefined;
		this.#gl.activeTexture(this.#gl.TEXTURE0 + this._unit);
		this.#gl.bindTexture(this.#gl.TEXTURE_2D, undefined);
		this._unit = undefined;
		return this;
	}

	_resetParameters() {
		const gl = this.#gl;

		gl.bindTexture(gl.TEXTURE_2D, this.#tex);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.minFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrapT);
	}

	/**
	 * @section
	 * @method setParameters: this
	 * @param minFilter?: Texture interpolation constant
	 * @param maxFilter?: Texture interpolation constant
	 * @param wrapS?: Texture wrapping constant
	 * @param wrapT?: Texture wrapping constant
	 * Resets the interpolation and wrapping parameters to the given ones.
	 * Any value can be `undefined` (and if so, won't be updated)
	 */
	setParameters(minFilter, maxFilter, wrapS, wrapT) {
		this.minFilter = minFilter ?? this.minFilter;
		this.maxFilter = maxFilter ?? this.maxFilter;
		this.wrapS = wrapS ?? this.wrapS;
		this.wrapT = wrapT ?? this.wrapT;

		this._resetParameters();
		return this;
	}

	/**
	 * @section
	 * @method texImage2D(img: HTMLImageElement): this
	 * (Re-)sets the texture contents to a copy of the given image. This is considered a "full update" of the texture.
	 *
	 * If the texture's format is other than `RGBA`, some data might be dropped (e.g.
	 * putting an RGBA `HTMLImageElement` with an alpha channel into a texture with `RGB`
	 * format shall drop the alpha channel).
	 * @alternative
	 * @method texImage2D(img: HTMLCanvasElement): this
	 * @alternative
	 * @method texImage2D(img: ImageData): this
	 * @alternative
	 * @method texImage2D(img: HTMLVideoElement): this
	 * @alternative
	 * @method texImage2D(img: ImageBitmap): this
	 */
	texImage2D(img) {
		/// TODO: set as dirty (?)
		/// TODO: notify programs using this texture that they're dirty now
		/// TODO: Read width/height from the image?? Then set as .width / .height
		const gl = this.#gl;
		this._isLoaded = true;
		this.width = img.width;
		this.height = img.height;
		this.getUnit();
		gl.texImage2D(gl.TEXTURE_2D, 0, this.internalFormat, this.format, this.type, img);
		this._resetParameters();

		this.#generateMipmap();
		return this;
	}

	/**
	 * @section
	 * @method texSubImage2D(img: HTMLImageElement, x: Number, y: Number): this
	 * (Re-)sets a portion of the texture contents to a copy of the given image. The portion
	 * starts at the given `x` and `y` coordinates, and is as big as the image.
	 *
	 * Otherwise, same as `texImage2D`.
	 * @alternative
	 * @method texSubImage2D(img: HTMLCanvasElement, x: Number, y: Number): this
	 * @alternative
	 * @method texSubImage2D(img: ImageData, x: Number, y: Number): this
	 * @alternative
	 * @method texSubImage2D(img: HTMLVideoElement, x: Number, y: Number): this
	 * @alternative
	 * @method texSubImage2D(img: ImageBitmap, x: Number, y: Number): this
	 */
	texSubImage2D(img, x, y) {
		const gl = this.#gl;
		this._isLoaded = true;

		this.getUnit();
		gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, this.internalFormat, this.type, img);
		this._resetParameters();

		this.#generateMipmap();
		return this;
	}

	/**
	 * @method texArray(w: Number, h: Number, arr: ArrayBufferView): this
	 * (Re-)sets the texture contents to a copy of the given `ArrayBufferView`
	 * (typically a `TypedArray` fitting this texture's `type`/`format`).
	 * Must be given width and height as well.
	 * @alternative
	 * @method texArray(w: Number, h: Number, arr: null): this
	 * Zeroes out the texture.
	 */
	texArray(w, h, arr) {
		this.getUnit();
		const gl = this.#gl;

		this._isLoaded = true;
		this.width = w;
		this.height = h;

		// 		gl.texImage2D(target, level, internalformat, width, height, border, format, type, ArrayBufferView? pixels);

		if (arr === null || reverseTypeMap.get(this.type) !== arr.constructor) {
			throw new Error("Passed TypedArray doesn't match the texture's pixel type ");
		}

		gl.texImage2D(
			gl.TEXTURE_2D,
			0,	// level
			this.internalFormat,
			w,
			h,
			0,	// border
			this.format,
			this.type,
			arr
		);
		this._resetParameters();

		this.#generateMipmap();
		return this;
	}


	/**
	 * @method texSubArray(w: Number, h: Number, arr: ArrayBufferView, x: Number, y:Number): this
	 *
	 * (Re-)sets a portion of the texture contents to a copy of the given
	 * `ArrayBufferView` (typically a `TypedArray` fitting this texture's
	 * `type`/`format`).
	 *
	 * Must be given width and height as well.
	 */
	texSubArray(w, h, arr, x, y) {
		this.getUnit();
		const gl = this.#gl;

		this._isLoaded = true;

		if (arr === null || reverseTypeMap.get(this.type) !== arr.constructor) {
			throw new Error("Passed TypedArray doesn't match the texture's pixel type ");
		}

		gl.texSubImage2D(
			gl.TEXTURE_2D,
			0,	// level
			x,
			y,
			w,
			h,
			this.format,
			this.type,
			arr
		);
		this._resetParameters();

		this.#generateMipmap();
		return this;
	}





	#generateMipmap() {
		const gl = this.#gl;
		if (
			(this.minFilter === gl.NEAREST || this.minFilter === gl.LINEAR) &&
			(this.magFilter === gl.NEAREST || this.magFilter === gl.LINEAR)
		) {
			return;
		}
		gl.generateMipmap(gl.TEXTURE_2D);
	}

	/**
	 * @method isLoaded(): Boolean
	 * Returns whether the texture has been initialized with any data at all. `true` after `texImage2D()` and the like.
	 */
	isLoaded() {
		return this._isLoaded;
	}

	/**
	 * @method getComponentsPerTexel(): Number
	 * Returns the number of components per texel, based on the `format` property.
	 * (e.g. 3 for `RGB`, 4 for `RGBA`, etc).
	 */
	getComponentsPerTexel() {
		const gl = this.#gl;
		switch (this.format) {
			case gl.RGBA:
			case gl.RGBA_INTEGER:
				return 4;
			case gl.RGB:
			case gl.RGB_INTEGER:
				return 3;
			case gl.LUMINANCE_ALPHA:
			case gl.RG:
			case gl.RG_INTEGER:
				return 2;
			case gl.LUMINANCE:
			case gl.ALPHA:
			case gl.RED:
			case gl.RED_INTEGER:
				return 1;
			default:
				throw new Error("Unknown texel data format");
		}
	}

	/**
	 * @method asImageData(x:Number, y:Number, w:Number, h:Number): ImageData
	 * Returns an instance of `ImageData` with a copy of the current contents
	 * of the texture.
	 *
	 * Note this is **not** a performant method call (it creates and destroys
	 * an interim `FrameBuffer`) and is meant for debugging purposes only (i.e.
	 * dumping a texture to a `HTMLCanvasElement` via [`putImageData()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData.html)).
	 *
	 * `x` and `y` specify the start of the dump (in texels); `w` and `h` specify
	 * the width and height of the dump. When not specified, the whole texture is
	 * dumped.
	 */
	asImageData(x, y, w, h) {
		if (!this._isLoaded) {
			throw new Error(
				"Must load something into the Texture before calling asImageData()"
			);
		}
		const gl = this.#gl;
		if (this.format !== gl.RGBA && this.internalFormat !== gl.R32F) {
			throw new Error(
				"asImageData() only available for textures with RGBA8 or R32F format"
			);
		}

		const fb = new FrameBuffer(gl, {
			width: this.width,
			height: this.height,
			colour: [this],
		});

		let pixels = fb.readPixels(x, y, w, h);

		if (this.internalFormat === gl.R32F) {
			// Due to WebGL shenanigans, reading a R32F texture has to create
			// a RGBA32F texture. Filter the GBA components to leave just the R
			// component.
			const size = this.width * this.height;
			const redComponent = new Float32Array(size);
			for (let i = 0; i < size; i++) {
				redComponent[i] = pixels[i * 4];
			}
			pixels = redComponent;
		}

		const imagedata = new ImageData(
			new Uint8ClampedArray(pixels.buffer),
			w ?? this.width,
			h ?? this.height
		);
		fb.destroy();

		return imagedata;
	}

	/**
	 * @method debugIntoCanvas(canvas: HTMLCanvasElement): this
	 *
	 * Convenience wrapper around `asImageData()`. Automates fetching a 2D context
	 * from the given `HTMLCanvasElement`, resizing it, and running `putImageData()`.
	 *
	 * The texture might be inverted in the Y-axis (see `UNPACK_FLIP_Y_WEBGL`), it is
	 * suggested to flip the destination canvas as well with a `transform:scaleY(-1)`
	 * CSS rule.
	 */
	debugIntoCanvas(canvas) {
		const data = this.asImageData();
		canvas.width = this.width;
		canvas.height = this.height;
		canvas.getContext("2d").putImageData(data, 0, 0);
		return this;
	}

	/**
	 * @method destroy(): this
	 * Tells WebGL to free resources associated with this `Texture`. Use
	 * when the `Texture` won't be used anymore.
	 *
	 * After being destroyed, WebGL programs should not use the destroyed `Texture`,
	 * not any `FrameBuffer` pointing to the destroyed texture.
	 */
	destroy() {
		this.#gl.deleteTexture(this.#tex);
		this.#tex = undefined;
	}
}

/**
 * @factory GliiFactory.Texture(options: Texture options)
 *
 * @class Glii
 * @section Class wrappers
 * @property Texture(options: Texture options): Prototype of Texture
 * Wrapped `Texture` class
 */
registerFactory("Texture", function (gl, glii) {

	/**
	 * @class Glii
	 * @section
	 * @method flushTextureUnits(): this
	 * Removes the cached data about texture units, forcing all textures to
	 * re-bind their units.
	 *
	 * Useful when the WebGL context is shared with some other library that *may*
	 * move texture units around.
	 */
	glii.flushTextureUnits = function forgetTextureUnits() {
		// Texture._boundUnits.delete(gl);
		if (!Texture._boundUnits.has(this.gl)) {
			return;
		}

		let units = Texture._boundUnits.get(this.gl);
		units.forEach((tex, unit)=>{
			tex?.unbind();
		});
		return this;
	};

	return class WrappedTexture extends Texture {
		constructor(opts) {
			super(gl, opts);
		}

		/**
		 * @class Texture
		 * @function getMaxSize(): Number
		 * Returns the maximum width/height that a `Texture` instance can have.
		 */
		static getMaxSize() {
			return gl.getParameter(gl.MAX_TEXTURE_SIZE);
		}
	};
});

const errRegexp = /ERROR: 0:([0-9]+):(.*)\n/;

/**
 * Internal helper function
 *
 * Tries to parse the (first) error from a shader compile log (from a
 * getShaderInfoLog() call), extracts the corresponding (offset) line
 * from the given source, and throws an error containing that information.
 */
function prettifyGlslError(log, header, src, type, lineOffset) {
	const match = errRegexp.exec(log);
	if (match) {
		let lineNumber = match[1];
		const msg = match[2];

		if (lineNumber < lineOffset) {
			const line = header.split("\n")[lineNumber - 1];
			throw new Error(
				`Could not compile ${type} shader, reason:\n${msg}\nError lies in injected GLSL headers (check inputs like attributes and uniforms)\nAround line ${lineNumber}: ${line}`
			);
		} else {
			lineNumber -= lineOffset;
			const line = src.split("\n")[lineNumber - 1];
			throw new Error(
				`Could not compile ${type} shader, reason:\n${msg}\nAround line ${lineNumber}: ${line}`
			);
		}
	}

	throw new Error(`Could not compile ${type} shader, reason in unknown line:\n${log}`);
}

/**
 * @class WebGL1Program
 *
 * Represents a draw call using only WebGL1 APIs.
 *
 * A `WebGL1Program` compiles the shader strings and binding textures,
 * indices, attributes and the framebuffer together (even though most
 * functionality is delegated).
 *
 * @relationship compositionOf SequentialIndices, 1..1, 0..n
 * @relationship compositionOf BindableAttribute, 0..n, 0..n
 * @relationship compositionOf Texture, 0..n, 0..n
 * @relationship compositionOf FrameBuffer, 0..1, 0..n
 */

class WebGL1Program {
	// TODO: alias "vertexShaderSource" to "vert"?
	// TODO: alias "fragmentShaderSource" to "frag"?
	// TODO: alias "indexBuffer" to "indices"?
	// TODO: alias "attributeBuffers" to "attributes" to "attrs"?

	// TODO: Stuff from REGL https://regl.party/api :
	// * Stencil
	// * Polygon offset
	// * Culling - IndexBuffer ?
	// * Front face - IndexBuffer ?
	// * Dithering
	// * Line width - IndexBuffer ?
	// * Color mask
	// * Sample coverage
	// * Scissor
	// * Viewport

	constructor(
		gl,
		gliiFactory,
		{
			/**
			 * @section
			 * @aka WebGL1Program options
			 * @option vertexShaderSource: String; GLSL v1.00 source code for the vertex shader
			 */
			vertexShaderSource,
			/**
			 * @option varyings: [Object]; A key-value map of varying names and their GLSL v1.00 types
			 */
			varyings = {},
			/**
			 * @option fragmentShaderSource: String; GLSL v1.00 source code for the fragment shader
			 */
			fragmentShaderSource,
			/**
			 * @option indexBuffer: IndexBuffer
			 * The `IndexBuffer` containing which vertices to draw.
			 */
			indexBuffer,
			/**
			 * @option attributes: Object = {}; A key-value map of attribute names and their `BindableAttribute`
			 */
			attributes = {},
			/**
			 * @option uniforms: Object = {}; A key-value map of uniform names and their GLSL v1.00 types
			 */
			uniforms = {},
			/**
			 * @option textures: Object = {}; A key-value map of texture names and their `Texture` counterpart
			 */
			textures = {},
			/**
			 * @option target: FrameBuffer = null
			 * When `target` is null or not specified, the program
			 * will draw to the default framebuffer (the one attached to the `<canvas>` being used).		 * @alternative
			 * @option target: FrameBuffer = null; The `FrameBuffer` to draw to.
			 */
			target = null,
			/**
			 * @option depth: Comparison constant = glii.ALWAYS
			 * Initial value for the `depth` property.
			 * @property depth: Comparison constant = glii.ALWAYS
			 * Whether this program performs depth testing, and how. Can be changed during runtime.
			 *
			 * `gl.ALWAYS` is the same as disabling depth testing.
			 *
			 * Has no effect if the `FrameBuffer` for this program has no depth attachment.
			 */
			depth = 0x0207, /// 0x207 = gl.ALWAYS
			/**
			 * @option blend: Boolean = false
			 * Disables fragment blending
			 * @alternative
			 * @option blend: BlendDefinition
			 * Enables fragment blending, with the provided configuration.
			 */
			blend = false,

			/**
			 * @option unusedWarning: Boolean = true
			 * Whether to display warnings in the browser's console about
			 * unused attributes, unused textures and unused uniforms.
			 */
			unusedWarning = true,
		}
	) {
		this._gl = gl;

		// The factory that spawned this program is important for fetching the
		// size of the default framebuffer, in order to prevent blinking when a
		// <canvas> is resized.
		this._gliiFactory = gliiFactory;

		// Loop through attribute buffers to fetch defined attribute names and their types
		// to build up a header for the fragment shader.
		let attribDefs = "";

		for (let attribName in attributes) {
			const type = attributes[attribName].getGlslType();
			attribDefs += `attribute ${type} ${attribName};\n`;
		}

		// Loop through uniform and texture definitions to get their names and types
		// to build up a header common for both the vertex and the fragment shader
		let uniformDefs = "";
		this._unifSetters = {};
		for (let uName in uniforms) {
			const uniformType = uniforms[uName];
			const [_, glslType] = parseGlslUniformType(uniformType);
			switch (glslType) {
				case "float":
					this._unifSetters[uName] = gl.uniform1f.bind(gl);
					break;
				case "vec2":
					this._unifSetters[uName] = gl.uniform2fv.bind(gl);
					break;
				case "vec3":
					this._unifSetters[uName] = gl.uniform3fv.bind(gl);
					break;
				case "vec4":
					this._unifSetters[uName] = gl.uniform4fv.bind(gl);
					break;
				case "int":
				case "bool":
					this._unifSetters[uName] = gl.uniform1i.bind(gl);
					break;
				case "ivec2":
				case "bvec2":
					this._unifSetters[uName] = gl.uniform2iv.bind(gl);
					break;
				case "ivec3":
				case "bvec3":
					this._unifSetters[uName] = gl.uniform3iv.bind(gl);
					break;
				case "ivec4":
				case "bvec4":
					this._unifSetters[uName] = gl.uniform4iv.bind(gl);
					break;
				case "mat2":
					this._unifSetters[uName] = (p, v) => gl.uniformMatrix2fv(p, false, v);
					break;
				case "mat3":
					this._unifSetters[uName] = (p, v) => gl.uniformMatrix3fv(p, false, v);
					break;
				case "mat4":
					this._unifSetters[uName] = (p, v) => gl.uniformMatrix4fv(p, false, v);
					break;
				default:
					throw new Error(`Unknown uniform GLSL type "${uniformType}"`);
			}

			uniformDefs += `uniform ${uniformType} ${uName};\n`;
		}
		for (let texName in textures) {
			uniformDefs += "uniform sampler2D " + texName + ";\n";
		}

		let varyingDefs = Object.entries(varyings)
			.map(([n, t]) => {
				parseGlslVaryingType(t);
				return `varying ${t} ${n};\n`;
			})
			.join("");

		/// TODO: allow the dev to change this
		const precisionHeader = "precision highp float;\n";

		const program = (this._program = gl.createProgram());
		const vertexShader = this._compileShader(
			gl.VERTEX_SHADER,
			// "#version 100\n" +
			precisionHeader + attribDefs + varyingDefs + uniformDefs,
			vertexShaderSource
		);
		const fragmtShader = this._compileShader(
			gl.FRAGMENT_SHADER,
			// "#version 100\n" +
			precisionHeader + varyingDefs + uniformDefs,
			fragmentShaderSource
		);
		gl.linkProgram(program);
		var success = gl.getProgramParameter(program, gl.LINK_STATUS);
		if (!success) {
			console.warn(gl.getProgramInfoLog(program));
			gl.deleteProgram(program);
			throw new Error("Could not compile shaders into a WebGL1 program");
		}

		// According to a note in
		// https://webglfundamentals.org/webgl/lessons/resources/webgl-state-diagram.html ,
		// it is safe to detach and delete shaders once the program is linked.
		gl.detachShader(program, vertexShader);
		gl.deleteShader(vertexShader);
		gl.detachShader(program, fragmtShader);
		gl.deleteShader(fragmtShader);

		if (!(indexBuffer instanceof SequentialIndices)) {
			throw new Error(
				"The WebGL1Program constructor needs a valid `IndexBuffer` to be passed as an option."
			);
		}
		this._indexBuff = indexBuffer;

		this._attrs = attributes;
		this._attribsMap = {};

		for (let attribName in attributes) {
			const loc = gl.getAttribLocation(this._program, attribName);
			if (loc === -1) {
				if (unusedWarning)
					console.warn(
						`Attribute "${attribName}" is not used in the shaders and will be ignored`
					);
				delete this._attrs[attribName];
			} else {
				this._attribsMap[attribName] = loc;
			}
		}

		this._unifsMap = {};
		this._texs = textures;
		this._unifs = uniforms;
		for (let unifName in uniforms) {
			const loc = gl.getUniformLocation(this._program, unifName);
			if (unusedWarning && loc === -1) {
				console.warn(`Uniform "${unifName}" is not being used in the shaders.`);
			}
			this._unifsMap[unifName] = loc;
		}
		for (let texName in textures) {
			if (texName in this._unifsMap) {
				throw new Error(
					`Texture name "${texName}" conflicts with already defined (non-texture) uniform.`
				);
			}
			const loc = gl.getUniformLocation(this._program, texName);
			if (unusedWarning && loc === -1) {
				console.warn(`Texture "${texName}" is not being used in the shaders.`);
			}
			this._unifsMap[texName] = loc;
		}

		this._target = target;
		this.depth = depth;
		this.blend = blend;
		// console.log("attrib map: ", this._attribsMap);
		// console.log("unifs map: ", this._unifsMap);
	}

	_compileShader(type, header, src) {
		const gl = this._gl;
		/// FIXME: Running on puppeteer, `shader` is not a `WebGLShader` instance,
		/// which throws an error when trying to set the source.
		// See also: https://github.com/mapbox/mapbox-gl-js/pull/9017
		const shader = gl.createShader(type);
		// 		try {
		gl.shaderSource(shader, "#line 1\n" + header + "#line 10001\n" + src);
		// 		} catch(ex) {
		// 			console.warn("Context lost?");
		// 			console.log(shader);
		// 			debugger;
		// 		}
		gl.compileShader(shader);
		const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
		if (success) {
			// console.warn(addLineNumbers(gl.getShaderSource(shader)));
			gl.attachShader(this._program, shader);
			return shader;
		}

		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);

		// Try to throw a pretty error message
		const readableType = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
		prettifyGlslError(log, header, src, readableType, 10000);

		// console.warn(gl.getSupportedExtensions());
		// console.warn(addLineNumbers(gl.getShaderSource(shader)));
		// console.warn(gl.getShaderInfoLog(shader));
		throw new Error("Could not compile shader.");
	}

	_preRun() {
		const gl = this._gl;

		// TODO: Double- and triple-check that viewport and clear are needed at this stage
		// TODO: handle explicit viewports.
		// TODO: Allow the dev to override the following defaults:
		if (!this._target) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			// const [width, height] = this._gliiFactory.getDrawingBufferSize();
			// gl.viewport(0, 0, width, height);
			this._gliiFactory.refreshDrawingBufferSize();
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		} else {
			gl.bindFramebuffer(gl.FRAMEBUFFER, this._target.fb);
			gl.viewport(0, 0, this._target.width, this._target.height);
		}

		if (this.blend) {
			gl.enable(gl.BLEND);
			gl.blendEquationSeparate(this.blend.equationRGB, this.blend.equationAlpha);
			gl.blendFuncSeparate(
				this.blend.srcRGB,
				this.blend.dstRGB,
				this.blend.srcAlpha,
				this.blend.dstAlpha
			);
			if (this.blend.colour) {
				gl.blendColor(
					this.blend.colour[0],
					this.blend.colour[1],
					this.blend.colour[2],
					this.blend.colour[3]
				);
			}
		} else {
			gl.disable(gl.BLEND);
		}

		/// TODO: Consider caching the loaded program somehow. Maybe copy
		/// the technique from the Texture's WeakMap?
		gl.useProgram(this._program);

		if (this.depth === gl.ALWAYS) {
			gl.disable(gl.DEPTH_TEST);
		} else {
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(this.depth);
		}

		for (let attribName in this._attrs) {
			const location = this._attribsMap[attribName];
			this._attrs[attribName].bindWebGL1(location);
		}

		for (let texName in this._texs) {
			if (this._texs[texName]) {
				gl.uniform1i(this._unifsMap[texName], this._texs[texName].getUnit());
			}
		}
	}

	/**
	 * @section Draw methods
	 * @method run():this
	 * Runs the draw call for this program
	 * @alternative
	 * @method run(lod: Number): this
	 * If the program's index buffer is a `LodIndices`, then this runs the
	 * draw call for this program, but only for the primitives in the given LoD.
	 * @alternative
	 * @method run(lod: String): this
	 * Idem, but for `String` LoD identifiers.
	 */
	run(lod) {
		this._preRun();
		this._indexBuff.drawMe(lod);
		return this;
	}

	/**
	 * @method runPartial(start: Number, count: Number):this
	 * Runs the draw call for this program, but explicitly only for
	 * the slots given as parameter (instead of using the information
	 * of slots in use from the `IndexBuffer` of this program).
	 *
	 * Beware that `runPartial` does not perform any validity checks
	 * on the given range. This should only be used when the programmer
	 * is really really sure of what vertex slots to draw.
	 */
	runPartial(start, count) {
		this._preRun();
		this._indexBuff.drawMePartial(start, count);
		return this;
	}

	/**
	 * @section Mutation methods
	 *
	 * The following methods allow changing some of the components of a program
	 * during runtime.
	 *
	 * @method setUniform(name: String, value: Number): this
	 * (Re-)sets the value of a uniform in this program, for `float`/`int` uniforms.
	 * @alternative
	 * @method setUniform(name: String, value: [Number]): this
	 * (Re-)sets the value of a uniform in this program, for `vecN`/`ivecN`/`matN` uniforms.
	 */
	setUniform(name, value) {
		// TODO: mark self as dirty
		this._gl.useProgram(this._program);

		if (name in this._unifSetters) {
			this._unifSetters[name](this._unifsMap[name], value);
			return this;
		} else {
			throw new Error(`Uniform name ${name} is unknown in this WebGL1Program.`);
		}
	}

	/**
	 * @method getUniform(name: String): *
	 * Returns the value of the uniform with the given name. Return value will
	 * be a `Number` or a `TypedArray` depending on the uniform's type.
	 */
	getUniform(name) {
		const location = this._unifsMap[name];
		if (location) {
			return this._gl.getUniform(this._program, location);
		} else {
			throw new Error(
				`Uniform name ${name} is unknown or unused in this WebGL1Program.`
			);
		}
	}

	/**
	 * @method setTexture(name: String, texture: Texture): this
	 * (Re-)sets the value of a texture in this program.
	 */
	setTexture(name, texture) {
		this._texs[name] = texture;
		return this;
	}

	/**
	 * @method setIndexBuffer(buf: IndexBuffer): this
	 * Changes the index buffer that this program uses.
	 */
	setIndexBuffer(buf) {
		this._indexBuff = buf;
		return this;
	}

	/**
	 * @method setAttribute(name: Stringattr: BindableAttribute): this
	 * (Re-)sets one of the named attributes to a new `BindableAttribute`.
	 *
	 * The GLSL type of the new attribute must match the old one.
	 */
	setAttribute(name, attr) {
		if (this._attrs[name].getGlslType() !== attr.getGlslType()) {
			throw new Error(
				`Bindable attribute named ${name} expected to be of type ${this._attrs[
					name
				].getGlslType()}, but instead got ${attr.getGlslType()}`
			);
		}
		this._attrs[name] = attr;
		return this;
	}

	/**
	 * @method setTarget(target: FrameBuffer): this
	 * Sets the `FrameBuffer` that this program should draw into.
	 * @alternative
	 * @method setTarget(target: null): this
	 * Setting the draw target to `null` (or a falsy value) will make the program
	 * draw to the default framebuffer (the one attached to the `<canvas>` used
	 * to spawn the Glii instance).
	 */
	setTarget(target) {
		this._target = target;
		return this;
	}

	/**
	 * @section Lifetime methods
	 *
	 * @method destroy(): this
	 * Tells WebGL to free resources associated with this `WebGL1Program`. Use
	 * when the `WebGL1Program` won't be used anymore.
	 */
	destroy() {
		this._gl.deleteProgram(this._program);
	}

	/**
	 * @section
	 * @method debugDumpAttributes(): Array of Object of TypedArray
	 * Returns a readable representation of the current attribute values. This is
	 * only possible when all attribute storages are growable (i.e. those defined with
	 * a `growFactor` greater than zero).
	 *
	 * This is a costly operation, and should be only used for manual debugging purposes.	 */
	debugDumpAttributes(start, length) {

		const attrValues = {};

		for (const [name, bound] of Object.entries(this._attrs)) {
			attrValues[name] = bound.debugDump();
		}
		// Reorganize data, so it's ordered by vertex index first,
		// attribute name second.

		let maxLength = 0;
		for (let values of Object.values(attrValues)) {
			maxLength = Math.max(maxLength, values.length);
		}

		start ??= 0;
		length ??= maxLength;
		const end = start +length;

		const result = new Array(maxLength);

		for (let i=start; i<end; i++) {
			const obj = {};
			for (const [name, values] of Object.entries(attrValues)) {
				obj[name] = values[i];
			}
			result[i] = obj;
		}		return result;
	}
}

/**
 * @factory GliiFactory.WebGL1Program(options: WebGL1Program options)
 * @class Glii
 * @section Class wrappers
 * @property WebGL1Program(options: WebGL1Program options): Prototype of WebGL1Program
 * Wrapped `WebGL1Program` class
 */
registerFactory("WebGL1Program", function (gl, gliiFactory) {
	return class WrappedWebGL1Program extends WebGL1Program {
		constructor(opts) {
			super(gl, gliiFactory, opts);
		}
	};
});

/**
 * @class MultiProgram
 * @relationship compositionOf WebGL1Program, 0..n, 1..n
 *
 * Represents a bundle of several `WebGL1Program`s. Sets their uniforms and
 * runs them all at once.
 *
 */
class MultiProgram {
	constructor(gl, gliiFactory, programs) {
		this._gl = gl;

		this._programs = programs || [];
	}

	/**
	 * @section
	 * @method addProgram(program: WebGL1Program): this
	 * Adds another program to the bundle.
	 */
	addProgram(program) {
		this._programs.push(program);
	}


	/**
	 * @method removeProgram(program: WebGL1Program): this
	 * Removes a program from the bundle
	 */
	removeProgram(program) {
		const i = this._programs.indexOf(program);
		if (i < 0) {
			throw new Error("Tried to remove a GL program that is not in a MultiProgram.");
		}
		this._programs.splice(i, 1);
		return this;
	}

	/**
	 * @method replaceProgram(oldProgram: WebGL1Program, newProgram: WebGL1Program): this
	 * Replaces a program, ensuring that the execution order of the rest of
	 * programs in the bundle will stay the same.
	 */
	replaceProgram(oldProgram, newProgram) {
		const i = this._programs.indexOf(oldProgram);
		if (i < 0) {
			throw new Error("Tried to remove a GL program that is not in a MultiProgram.");
		}
		this._programs.splice(i, 1, newProgram);
		return this;
	}

	/**
	 * @section Draw methods
	 * @method run():this
	 * Runs the draw call for all the bundled programs
	 * @alternative
	 * @method run(lod: Number):this
	 * Runs the draw call for all the bundled programs, passing a LoD for
	 * those programs which use a `LoDIndices`
	 * @alternative
	 * @method run(lod: String):this
	 * Idem, but for `String` LoD identifiers
	 */
	run(lod) {
		this._programs.forEach((p) => p.run(lod));
		return this;
	}

	/**
	 * @method runPartial(start: Number, count: Number):this
	 * Runs a partial draw call for all the bundled programs.
	 *
	 * This should be used only when all the bundled programs share the same `IndexBuffer`.
	 */
	runPartial(start, count) {
		this._programs.forEach((p) => p.runPartial(start, count));
		return this;
	}

	/**
	 * @section Mutation methods
	 * The following methods allow changing some of the components (uniforms/textures/bindable
	 * attributes) of the bundled programs during runtime. These change the components of all
	 * bundled programs, but will fail silently *if* a program doesn't have a given component.
	 *
	 * Note that `setTarget` is missing from the set of methods - there is no (known) use
	 * case where that would be useful, since `run()`ning all bundled programs at the same time
	 * would mean overwriting their outputs, defeating the purpose.
	 *
	 * @method setUniform(name: String, value: Number): this
	 * (Re-)sets the value of a uniform in the bundled programs, for `float`/`int` uniforms.
	 * @alternative
	 * @method setUniform(name: String, value: [Number]): this
	 * (Re-)sets the value of a uniform in the bundled programs, for `vecN`/`ivecN`/`matN` uniforms.
	 */
	setUniform(name, value) {
		this._programs.forEach((p) => {
			if (name in p._unifSetters) {
				p.setUniform(name, value);
			}
		});
		return this;
	}

	/**
	 * @method setTexture(name: String, texture: Texture): this
	 * (Re-)sets the value of a texture in the bundled programs.
	 */
	setTexture(name, texture) {
		this._programs.forEach((p) => {
			if (name in p._texs) {
				p.setTexture(name, texture);
			}
		});
		return this;
	}

	/**
	 * @method setIndexBuffer(buf: IndexBuffer): this
	 * Changes the index buffer that the bundled programs use.
	 */
	setIndexBuffer(buf) {
		this._programs.forEach((p) => p.setIndexBuffer(buf));
		return this;
	}

	/**
	 * @method setAttribute(name: Stringattr: BindableAttribute): this
	 * (Re-)sets one of the named attributes to a new `BindableAttribute`.
	 *
	 * The GLSL type of the new attribute must match the old one.
	 */
	setAttribute(name, attr) {
		this._programs.forEach((p) => {
			if (name in p._attrs) {
				p.setAttribute(name, attr);
			}
		});
		return this;
	}

	/**
	 * @section Lifetime methods
	 *
	 * @method destroy(): this
	 * Tells WebGL to free resources associated with **all** the programs
	 * in this `MultiProgram`. Use when **none** of the programs
	 * will be used anymore.
	 */
	destroy() {
		this._programs.forEach((p) => p.destroy());
	}
}

/**
 * @factory GliiFactory.MultiProgram(programs: [WebGL1Program])
 * @class Glii
 * @section Class wrappers
 * @property MultiProgram(programs: [WebGL1Program]): Prototype of MultiProgram
 * Wrapped `MultiProgram` class
 */
registerFactory("MultiProgram", function (gl, gliiFactory) {
	return class WrappedMultiProgram extends MultiProgram {
		constructor(opts) {
			super(gl, gliiFactory, opts);
		}
	};
});

/**
 * @class WebGL1Clear
 * @relationship compositionOf FrameBuffer, 0..1, 0..n
 *
 * Represents a clear call using only WebGL1 APIs.
 *
 * Optionally specify a target `FrameBuffer` and values to clear the depth and
 * stencil parts of said framebuffer. Specify `false` values to *not* clear
 * colour, depth or stencil parts of a framebuffer.
 *
 * A `WebGL1Clear` operation is not needed when the `target` is `null` and the
 * `WebGLRenderingContext` has been instantiated with `preserveDrawingBuffer`
 * set to `false` (the default); in this case, an implicit clear operation is
 * performed prior to every draw call (i.e. every time a `WebGL1Program` `run()`s).
 */

class WebGL1Clear {
	constructor(
		gl,
		{
			// @section
			// @aka WebGL1Clear options
			// @option color: Array of Number = [0.5, 0.5, 0.5, 0.0]; RGBA colour to clear with.
			// @alternative
			// @option color: false; When `false`, the colour part of the framebuffer is not cleared.
			color = [0.5, 0.5, 0.5, 0.0],
			// @option depth: Number = 1; The value to clear the depth part of the framebuffer with.
			// @alternative
			// @option depth: false; When `false`, the depth part of the framebuffer is not cleared.
			depth = 1,
			// @option stencil: Number = 0.5; The value to clear the stencil part of the framebuffer with.
			// @alternative
			// @option stencil: false; When `false`, the stencil part of the framebuffer is not cleared.
			stencil = 0,
			// @option target: null; When `target` is null or not specified) the default
			// framebuffer is cleared (the one attached to the `<canvas>` being used).
			// @alternative
			// @option target: FrameBuffer; The `FrameBuffer` to clear.
			target,
		}
	) {
		/// TODO: This needs a draw target - which canvas/RenderBuffer to use??!!
		/// i.e. make a call like gl.bindFrameBuffer(gl.FRAMEBUFFER, this._renderBuffer)
		this._gl = gl;
		this.color = color;
		this.depth = depth;
		this.stencil = stencil;
		this.target = target || null;
	}

	/**
	 * @method run(): this
	 * Runs the clear call
	 */
	run() {
		const gl = this._gl;

		if (!this.target) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		} else {
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.fb);
			gl.viewport(0, 0, this.target.width, this.target.height);
		}

		let bitmask = 0;
		if (this.color !== false) {
			gl.clearColor(...this.color);
			bitmask |= gl.COLOR_BUFFER_BIT;
		}
		if (this.depth !== false) {
			gl.clearDepth(this.depth);
			bitmask |= gl.DEPTH_BUFFER_BIT;
		}
		if (this.stencil !== false) {
			gl.clearStencil(this.stencil);
			bitmask |= gl.STENCIL_BUFFER_BIT;
		}
		gl.clear(bitmask);
		return this;
	}
}

/**
 * @factory GliiFactory.WebGL1Clear(options: WebGL1Clear options)
 * @class Glii
 * @section Class wrappers
 * @property WebGL1Clear(options: WebGL1Clear options): Prototype of WebGL1Clear
 * Wrapped `WebGL1Clear` class
 */
registerFactory("WebGL1Clear", function (gl) {
	return class WrappedWebGL1Clear extends WebGL1Clear {
		constructor(opts) {
			super(gl, opts);
		}
	};
});

/**
 * @namespace knownCRSs
 * @relationship aggregationOf BaseCRS, 1..1, 0..n
 *
 * Holds a list of `BaseCRS`s globally known to Gleo, keyed by their OGC URI.
 */

const knownCRSs = new Map();

// This is a super-simplistic CURIE parser that doesn't take into account
// the full spec (the full list of valid characters), instead parses only
// the brackets, double colon and non-whitespace. See https://www.w3.org/TR/curie/ .
const curieRegexp = /^\[(\S+):(\S+)\]$/;

/**
 * @function getCRS(ogcUri: String): BaseCRS
 * Returns the known `BaseCRS` with the given OGC URI. Accepts the URI in CURIE
 * form (e.g. `[EPSG:4326]`) as well. Throws an error if not found.
 * @alternative
 * @function getCRS(name: String): BaseCRS
 * Returns the known `BaseCRS` with the given internal name (e.g. "EPSG:4326",
 * "cartesian"). Throws an error if not found.
 */
function getCRS(ogcUri) {
	const match = curieRegexp.exec(ogcUri);
	let uri = ogcUri;
	if (match) {
		const [_, authority, code] = match;
		uri = `http://www.opengis.net/def/crs/${authority}/0/${code}`;
	}
	const crs = knownCRSs.get(uri);
	if (!crs) {
		throw new Error(
			"There is no known Gleo CRS for the given name/OGC URI: " + ogcUri
		);
	}
	return crs;
}

/**
 * @function registerCRS(crs: BaseCRS, overrideUri: undefined): undefined
 * Registers the given CRS. Meant for internal use only. Trying to register
 * a CRS twice (or two CRSs with the same OGC URI) will throw an error.
 * @alternative
 * @function registerCRS(crs: BaseCRS, overrideUri: String): undefined
 * Registers the given CRS, but with an alternate OGC URI. Meant for internal
 * use only, for pointing both `EPSG:4326` and `OGC:WGS84` to the same object.
 */
function registerCRS(crs, overrideUri) {
	const uri = overrideUri ?? crs.ogcUri;
	if (uri) {
		if (knownCRSs.has(uri)) {
			throw new Error("CRS has been defined twice for the given OGC URL: " + uri);
		}
		knownCRSs.set(uri, crs);
	}
	knownCRSs.set(crs.name, crs);
}

/**
 * @namespace projector
 *
 * The `projector` is the piece of code in charge of transforming ("reprojecting")
 * coordinates (from either `Coord` or `CoordNest`) into a different `BaseCRS`.
 *
 * By default, Gleo only supports projecting from/to `EPSG:4326` and `EPSG:3857`.
 * The intended way to support any other projections is to inject the
 * `proj4`/`proj4js` dependency via `enableProj()`.
 *
 * `projector` works as a Singleton pattern, and cannot be instanced.
 *
 * @example
 * ```
 * import proj4 from 'proj';
 * import {enableProj, project} from 'gleo/src/crs/projector.mjs';
 *
 * enableProj(Proj4js);
 *
 * proj4.defs("EPSG:3995","+proj=stere +lat_0=90 +lat_ts=71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs");
 *
 * const epsg3995 = new BaseCRS("EPSG:3995", Infinity, Infinity);
 *
 * map.crs = epsg3995;
 * ```
 */

function gleoProject(sCRS, dCRS, xy) {
	if (sCRS === "EPSG:4326" && dCRS === "EPSG:3857") {
		return lnglat2webmercator(xy);
	} else if (sCRS === "EPSG:3857" && dCRS === "EPSG:4326") {
		return webmercator2lnglat(xy);
	} else {
		throw new Error(`Unsupported coordinate reprojection ${sCRS}→${dCRS}`);
	}
}

gleoProject.defs = function noop() {};

/**
 * @function project(sCRS: String, dCRS: String, xy: Array of Number): Array of Number
 * Projects the given `Array` of two `Number`s from the source CRS `sCRS` into
 * the destination `dCRS`, returning a new `Array` of two `Number`s.
 */
let project = gleoProject;

const R$1 = 6378137; // Earth's radius as per spherical mercator
const D = Math.PI / 180; // One degree, in radians
const rad$1 = 180 / Math.PI; // One radian, in degrees
const halfPi = Math.PI / 2;

function lnglat2webmercator([lng, lat]) {
	const sin = Math.sin(lat * D);
	return [R$1 * D * lng, (R$1 * Math.log((1 + sin) / (1 - sin))) / 2];
}

function webmercator2lnglat([x, y]) {
	return [(x * rad$1) / R$1, (2 * Math.atan(Math.exp(y / R$1)) - halfPi) * rad$1];
}

/**
 * @class BaseCRS
 *
 * Represents a Coordinate Reference System.
 *
 * A `CRS` is identified by:
 * - Its well-known name (e.g. "EPSG:4326" or "cartesian")
 * - A wrapping delta vector (the `wrapPeriodX` and `wrapPeriodY` options)
 * - A way to calculate distance, either
 *   - A distance function that takes two points in the CRS, *or*
 *   - An instance of a different CRS that will perform the distance
 *     calculations after reprojecting the points
 * - An bounding box (in the `[minX, minY, maxX, maxY]` form)
 *   informative of the area in which the CRS makes sense; this is mostly to
 *   prevent users from setting the platina's center too far away.
 * - An informative set of minimum and maximum span; this is mostly to
 *   prevent users from zooming in/out foo far.
 *
 * Members of bounding boxes, as well as the minimum/maximum span, can have
 * values of `Infinity` or `-Infinity` (or `Number.POSITIVE_INFINITY`/`Number.NEGATIVE_INFINITY`).
 *
 * The wrapping delta vector is meant to draw `Acetate`s multiple times, offsetting
 * by that value. Also used to wrap coordinates when their X (or Y) component is larger
 * than *half* the X (or Y) component of the wrapping delta vector.
 *
 * It's important to note that the the wrapping vector does **not** mean that
 * coordinates wrap, but rather that the *display* of the coordinates wrap.
 * Thus, a point at a position `P` and another point at `P+wrap` are different,
 * but will be displayed at the same pixel. (Idem for `P+2*wrap`, `P-wrap` and
 * in general, for `P+n*wrap` for all natural numbers `n`).
 *
 * For geographical CRSs, it's highly recommended to use names that match
 * a Proj definition. Other functionality, such as the `ConformalWMS` loader,
 * depends on the CRS names.
 */

class BaseCRS {
	/**
	 * @constructor BaseCRS(name: String, opts: BaseCRS Options)
	 */
	constructor(
		name,
		{
			/**
			 * @section
			 * @aka BaseCRS Options
			 * @uninheritable
			 * @option wrapPeriodX: Number = Infinity
			 * The horizontal length, in CRS units, of the display wrapping.
			 * @option wrapPeriodY: Number = Infinity
			 * The vertical length, in CRS units, of the display wrapping.
			 *
			 * @option distance: Function
			 * A distance function, that should take two point `Geometry`s as arguments
			 * and return the distance between them (when given non-point `Geometry`s,
			 * it shall return the distance between the first coordinate pair of each
			 * `Geometry`). The units of distance depend on the CRS. They **should**
			 * be meters for geographical CRSs, and unitless for `cartesian`.
			 * @alternative
			 * @option distance: BaseCRS
			 * Whenever it's not trivial or convenient to calculate distances,
			 * calculations can be proxied to another CRS (which must have a `distance`
			 * function defined). This is useful for geographical CRSs where a CRS
			 * represents a geoid (e.g. the `EPSG:4326` CRS represents the `WGS84` geoid)
			 * and all CRSs for that geoid use one common distance calculation.
			 *
			 * @option flipAxes: Boolean = false
			 * Used **only** for OGC services (WMS, WFS, etc). The default `false` works
			 * for CRSs with an X-Y axis order (or easting-northing, or longitude-latitude).
			 *
			 * This should be set to `true` whenever the CRS definition specifies that
			 * the axes should be in Y-X order (or northing-easting, or latitude-longitude)
			 * (e.g. EPSG:4326 and EPSG:3035).
			 *
			 * Gleo `Geometry`s always store data in X-Y (or easting-northing, or
			 * lng-lat) order, regardless of this setting.
			 *
			 * @option ogcUri: String = ""
			 * Used **only** for OGC API services (OGC API Tiles, etc). This
			 * should be a URI string like `"https://www.opengis.net/def/crs/EPSG/0/4326"`
			 * that will be used to match metadata.
			 *
			 * @option minSpan: Number = 0
			 * The minimum span of a map/platina using the CRS, expressed in CRS units
			 * (meters/degrees/etc) across the diagonal of a platina.
			 *
			 * This is an informative value that actuators use to prevent the user from
			 * zooming in too far.
			 *
			 * @option maxSpan: Number = Infinity
			 * The maximum span of a map/platina using the CRS, expressed in CRS units
			 * (meters/degrees/etc) across the diagonal of a platina.
			 *
			 * This is an informative value that actuators use to prevent the user from
			 * zooming out too far.
			 *
			 * @option viewableBounds: Array of Number = [-Infinity, -Infinity, Infinity, Infinity]
			 * The *practical* viewable bounds of the CRS, as an array of the form
			 * `[x1, y1, x2, y2]`.
			 *
			 * This is an informative value that actuators use to prevent the user
			 * from moving away from areas where the CRS makes sense.
			 *
			 * Values are absolute, not relative to the CRS's offset (important
			 * for instances of `offsetCRS`).
			 */
			wrapPeriodX = Infinity,
			wrapPeriodY = Infinity,
			distance,
			flipAxes = false,
			ogcUri = "",
			minSpan = 0,
			maxSpan = Infinity,
			viewableBounds = [-Infinity, -Infinity, Infinity, Infinity],
		} = {}
	) {
		Object.defineProperty(this, "name", { value: name, writable: false });
		this.wrapPeriodX = wrapPeriodX;
		this.wrapPeriodY = wrapPeriodY;
		this.halfPeriodX = wrapPeriodX / 2;
		this.halfPeriodY = wrapPeriodY / 2;

		if (wrapPeriodX === Infinity && wrapPeriodY === Infinity) {
			this.wrap = this._wrapNone;
			this.wrapString = this._wrapNone;
		} else if (wrapPeriodX !== Infinity && wrapPeriodY === Infinity) {
			this.wrap = this._wrapX;
		} else if (wrapPeriodX === Infinity && wrapPeriodY !== Infinity) {
			this.wrap = this._wrapY;
		} else {
			this.wrap = this._wrapXY;
		}

		if (distance instanceof Function) {
			// Ensure both parameters are in the desired CRS before going on
			this.distance = function assertedDistance(a, b) {
				return distance(a.toCRS(this), b.toCRS(this));
			}.bind(this);
		} else if (distance instanceof BaseCRS) {
			const proxiedCRS = distance;
			// Proxy to the distance calculation of the given CRS
			// The CRS that this calculation is ultimately proxied to
			// will assert geometries are reprojected.
			this.distance = function proxiedDistance(a, b) {
				return proxiedCRS.distance(a, b);
			};
		} else {
			this.distance = function noDistance() {
				throw new Error("CRS cannot calculate distances");
			};
		}

		this.flipAxes = flipAxes;
		this.minSpan = minSpan;
		this.maxSpan = maxSpan;
		this.viewableBounds = viewableBounds;
		// console.log("Instantiated CRS", this.name, this.wrapPeriodX, this.wrapPeriodY);
		this.ogcUri = ogcUri;

		if (ogcUri && this.constructor === BaseCRS) {
			registerCRS(this);
		}
	}

	/**
	 * @method offsetToBase(xy: Array of Number): Array of Number
	 * Identity function (all coordinates represented in a Base CRS are already
	 * relative to the 0,0 origin of coordinates).
	 */
	offsetToBase(xy) {
		return xy;
	}

	/**
	 * @method offsetFromBase(xy: Array of Number): Array of Number
	 * Identity function (all coordinates represented in a Base CRS are already
	 * relative to the 0,0 origin of coordinates).
	 */
	offsetFromBase(xy) {
		return xy;
	}

	/**
	 * @method wrap(xy: Array of Number, ref: Array of Number): Array of Number
	 * Wraps the given coordinate if it's further away from the reference `ref`
	 * than half the wrap period. This guarantees that the return value is less than
	 * half a period away from the reference.
	 */

	_wrapNone(xy) {
		return xy;
	}

	_wrapX([x, y], [refX, refY]) {
		return [
			modulo(x - refX + this.halfPeriodX, this.wrapPeriodX) +
				refX -
				this.halfPeriodX,
			y,
		];
	}

	_wrapY([x, y], [refX, refY]) {
		return [
			x,
			modulo(y - refY + this.halfPeriodY, this.wrapPeriodY) +
				refY -
				this.halfPeriodY,
		];
	}

	_wrapXY([x, y], [refX, refY]) {
		return [
			modulo(x - refX + this.halfPeriodX, this.wrapPeriodX) +
				refX -
				this.halfPeriodX,
			modulo(y - refY + this.halfPeriodY, this.wrapPeriodY) +
				refY -
				this.halfPeriodY,
		];
	}

	/**
	 * @method wrapString(xys: Array of Number): Array of Number
	 * Given a linestring array of the form `[x1,y2, x2,y2, ... xn,yn],
	 * runs `wrap()` on every `x,y` pair. This ensures that the first point of
	 * the linestring is less than half a period away from the CRS' origin, and
	 * idem with each pair of consecutive points.
	 */
	wrapString(xys) {
		const l = xys.length / 2;
		const dest = new Array(l);
		let ref = this.offset || [0, 0];
		for (let i = 0; i < l; i++) {
			const j = i * 2;
			const xy = xys.slice(j, j + 2);
			dest[i] = this.wrap(xy, ref);
			if (Number.isFinite(xy[0]) && Number.isFinite(xy[1])) {
				ref = dest[i];
			}
		}
		return dest.flat();
	}

	/**
	 * @function guessFromCode(crs: String): Promise to BaseCRS
	 *
	 * Factory method. Expects a string like `"EPSG:12345"`.
	 *
	 * Fetches information from https://crs-explorer.proj.org/ and
	 * tries to build a Gleo CRS on a best-effort basis. Registers it via `proj4js`
	 * as well, assuming `enableProj()` has been called.
	 *
	 * The resulting CRS might lack information such as wrap periods or min/max spans.
	 */
	static async guessFromCode(code) {
		try {
			return getCRS(code);
		} catch (ex) {
			const [_, org, number] = /(\w+):(\d+)/.exec(code);

			let wkt;
			try {
				wkt = await (
					await fetch(`https://crs-explorer.proj.org/wkt1/${org}/${number}.txt`)
				).text();
			} catch (ex) {
				wkt = await (
					await fetch(
						`https://spatialreference.org/ref/${org}/${number}/ogcwkt/`
					)
				).text();
			}

			project.defs(code, wkt);

			// Assume that all EPSG CRSs are earth-based, and therefore can rely
			// on distance calculation via reprojection to EPSG:4326 and haversine
			// formula.
			const distance =
				org === "EPSG"
					? (await Promise.resolve().then(function () { return epsg4326$1; })).default.distance
					: undefined;

			return new BaseCRS(code, { distance });
		}
	}
}

function modulo(a, n) {
	// As per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder
	// return ((a % n ) + n ) % n;

	return a === n ? a : ((a % n) + n) % n;
}

/**
 * @class OffsetCRS
 * @inherits BaseCRS
 *
 * Represents a Coordinate Reference System, with the same properties than a
 * `BaseCRS`, but with the `[0,0]` center of coordinates being offset.
 *
 * The rationale is the difference of precision between numbers.
 * A Gleo coordinate is a floating point number, which typically
 * will be represented by:
 * - 8 bytes / 64 bits (`Number`) when defined by the programmer or red by an API
 * - 4 bytes / 32 bits (`Float32Array`) when stored in a WebGL-friendly typed array
 * - 3 bytes / 24 bits (`highp float`) when running inside a GLSL 1.00 shader
 *
 * In order to keep the numerical precision, it's important to keep the numbers low
 * (so the mantissa has a precision of less than one screen pixel).
 *
 * The way to do so is to offset the coordinates. A system based on vector tiles
 * does this implicitly (coordinates inside a typical vector tile range from 0 to 4096,
 * and the CRS coordinate of each tile's corner is the implicit CRS offset).
 *
 * Gleo does this explicitly, translating coordinates to a `offsetCRS` which has a center
 * relatively near the screen center. In other words, when the user pans or zooms the map
 * far enough from the CRS' origin, then Gleo shall establish a new origin near
 * the updated user's viewport, and translate (AKA "offset") all `Geometry`s.
 * This doesn't lose (significant) precision since numbers are originally stored
 * in 64-bit floats (`Number`s).
 *
 */

class OffsetCRS extends BaseCRS {
	/**
	 * @section
	 * Build a new offset CRS, given a point `Geometry`. The CRS name, wrap
	 * periods and other `BaseCRS Options` are taken from the `Geometry`'s CRS,
	 * and the offset is the *absolute* value of the `Geometry`'s coordinates.
	 * @constructor OffsetCRS(offset: Geometry)
	 */
	constructor(offset) {
		super(offset.crs.name, {
			wrapPeriodX: offset.crs.wrapPeriodX,
			wrapPeriodY: offset.crs.wrapPeriodY,
			distance: offset.crs.distance,
			flipAxes: offset.crs.flipAxes,
			minSpan: offset.crs.minSpan,
			maxSpan: offset.crs.maxSpan,
			viewableBounds: offset.crs.viewableBounds,
		});

		if (offset.coords.length !== offset.dimension) {
			throw new Error("Offset geometry must be a point");
		}

		this.offset = offset.coords;
		this.offset[0] %= offset.crs.wrapPeriodX;
		this.offset[1] %= offset.crs.wrapPeriodY;

		/// TODO: Decide whether to:
		/// Change this so that the `offset.crs`'s own offset is added to the
		/// offset absolute value - that is, offsets are accumulated.
		///  or
		/// Keep it this way and ensure that all offsets are relative to the base,
		/// i.e. `offsetToBase()` is applied.
	}

	/**
	 * @method offsetToBase(xys: Array of Number): Array of Number
	 * Given a set of coordinates `[x1, y1, x2, y2, ... xn, yn]`, returns
	 * those coordinates as if they were using the `BaseCRS`'s (0,0) origin
	 * of coordinates.
	 */
	offsetToBase(xys) {
		const l = xys.length;
		const out = new Array(l);
		const ox = this.offset[0];
		const oy = this.offset[1];
		for (let i = 0; i < l; i += 2) {
			out[i] = xys[i] + ox;
			out[i + 1] = xys[i + 1] + oy;
		}
		return out;
	}

	/**
	 * @method offsetFromBase(xy: Array of Number): Array of Number
	 * Given a set of coordinates `[x1, y1, x2, y2, ... xn, yn]` in the
	 * `BaseCRS` of this CRS, returns those coordinates as if they were using
	 * the origin of coordinates of this offset CRS.
	 */
	offsetFromBase(xys) {
		const l = xys.length;
		const out = new Array(l);
		const ox = this.offset[0];
		const oy = this.offset[1];
		for (let i = 0; i < l; i += 2) {
			out[i] = xys[i] - ox;
			out[i + 1] = xys[i + 1] - oy;
		}
		return out;
	}
}

/*
 * TODO: store the exponent of the (x,y) offset(s) somehow. There should be some way
 * to map the full exponent resolution of float64s into float24s.
 *
 * In other words, float24 only has 7 bits of exponent, so how to represent things
 * in the order of e.g. 2^-129 (smaller than 2^-128), which can be represented in float64 ?
 *
 * The exponent of the scale delta (i.e. how many CRS units per *one* pixel) should be
 * used here as well.
 *
 * For now, I'll just assume that using numbers with magnitudes smaller than 2^-127
 * or larger than 2^127 is not a foreseeable use case.
 */

/**
 * @class ExpandBox
 *
 * Minimalistic, simplistic, 2-dimensional, *expanding* bounding box implementation.
 *
 * This class is needed only when there's a need to calculate a bbox that covers
 * a given set of points. Bounding boxes that can be trivially calculated are best
 * handled manually as 4-element arrays.
 *
 * This implementation also assumes that the bounds are parallel to the CRS's axes,
 * and is not suitable for boundign boxes whenever there's a yaw rotation involved.
 */

class ExpandBox {
	constructor() {
		this.reset();
	}

	/**
	 * @method reset(): this
	 * Resets all properties to their `Infinity`/`-Infinity` default values.
	 */
	reset() {
		/**
		 * @property minX: Number = Infinity
		 * @property maxX: Number = -Infinity
		 * @property minY: Number = Infinity
		 * @property maxY: Number = -Infinity
		 */
		this.minX = this.minY = Infinity;
		this.maxX = this.maxY = -Infinity;
		return this;
	}

	/**
	 * @method clone(): ExpandBox
	 * Returns a cloned copy of this box.
	 */
	clone() {
		const newBox = new ExpandBox();
		newBox.minX = this.minX;
		newBox.minY = this.minY;
		newBox.maxX = this.maxX;
		newBox.maxY = this.maxY;
		return newBox;
	}

	/**
	 * @method expandPair(xy: Array of Number): this
	 *
	 * Expands the bounding box to cover the given coordinate pair. The coordinate
	 * pair is expected to have the form `[x, y]`.
	 */
	expandPair([x, y]) {
		this.minX = Math.min(this.minX, x);
		this.maxX = Math.max(this.maxX, x);
		this.minY = Math.min(this.minY, y);
		this.maxY = Math.max(this.maxY, y);
		return this;
	}

	/**
	 * @method expandXY(x: Number, y: Number): this
	 *
	 * Expands the bounding box to cover the given coordinate pair.
	 */
	expandXY(x, y) {
		this.minX = Math.min(this.minX, x);
		this.maxX = Math.max(this.maxX, x);
		this.minY = Math.min(this.minY, y);
		this.maxY = Math.max(this.maxY, y);
		return this;
	}

	/**
	 * @method expandGeometry(geom: RawGeometry): this
	 * Expands the bounding box to cover all points of the given `Geometry`.
	 * Note that no reprojection is performed, and that an `ExpandBox` is
	 * CRS-agnostic.
	 */
	expandGeometry(geom) {
		const coords = geom.coords;
		for (let i = 0, l = coords.length; i < l; i += 2) {
			this.expandXY(coords[i], coords[i + 1]);
		}
		return this;
	}

	/**
	 * @method expandPercentage(p: Number): this
	 *
	 * Expand the bounding box by the given percentage **on four sides**.
	 *
	 * e.g. a value of `0.1` will raise the top by 10%, lower
	 * the bottom by 10% (idem for left & right), increasing the height
	 * by 20% (idem for width).
	 */
	expandPercentage(p) {
		const h = this.maxX - this.minX;
		const w = this.maxY - this.minY;
		if (isFinite(w)) {
			this.minX -= w * p;
			this.maxX += w * p;
		}
		if (isFinite(h)) {
			this.minY -= h * p;
			this.maxY += h * p;
		}

		return this;
	}

	/**
	 * @method expandPercentages(px: Number, py: Number): this
	 *
	 * Expand the bounding box by the given percentages, to the left and right by
	 * `px`, and to the top and bottom by `py`
	 */
	expandPercentages(px, py) {
		const h = this.maxX - this.minX;
		const w = this.maxY - this.minY;
		if (isFinite(w)) {
			this.minX -= w * px;
			this.maxX += w * px;
		}
		if (isFinite(h)) {
			this.minY -= h * py;
			this.maxY += h * py;
		}

		return this;
	}

	/**
	 * @method intersectsBox(b: ExpandBox): Boolean
	 * Returns `true` if the given `ExpandBox` has at least one point in
	 * common.
	 */
	intersectsBox(b) {
		return (
			b.maxX > this.minX &&
			b.minX < this.maxX &&
			b.maxY > this.minY &&
			b.minY < this.maxY
		);
	}

	/**
	 * @method containsBox(b: ExpandBox): Boolean
	 * Returns `true` if the given `ExpandBox` completely fits.
	 */
	containsBox(b) {
		return (
			b.maxX < this.maxX &&
			b.minX > this.minX &&
			b.maxY < this.maxY &&
			b.minY > this.minY
		);
	}
}

/**
 * @class RawGeometry
 * @relationship compositionOf BaseCRS, 1..1, 0..n
 * @relationship associated projector
 * @relationship dependsOn knownCRSs
 *
 * Like `Geometry`, but expects the "raw" flattened coordinate array,
 * rings array, hulls array, and skips the assertions.
 *
 */

class RawGeometry {
	/**
	 * @constructor RawGeometry(crs: BaseCRS, coords: Array of Number, rings: Array of Number, hulls: Array of Number, options: RawGeometry Options)
	 */
	constructor(
		crs,
		coords,
		rings = [],
		hulls = [],
		{ wrap = true, dimension = 2 } = {}
	) {
		/**
		 * @section RawGeometry Options
		 * @option wrap: Boolean = true
		 * Whether antimeridian-wrap functionality should be enabled for this geometry.
		 *
		 * Only works for 2-dimensional `Geometry`s.
		 *
		 * @option dimension: Number = 2
		 * The dimension of each coordinate. 2 for X-Y, 3 for X-Y-Z, 4 for X-Y-Z-M.
		 */
		this.wrap = wrap;
		this.dimension = dimension;
		this.crs = crs;

		/**
		 * @property coords: Array of Number
		 * A flat `Array` containing the CRS-relative coordinates or the
		 * geometry, in `[x1, y1, x2, y2, ..., xn, yn]` form.
		 */
		this.coords = this.wrap ? crs.wrapString(coords) : coords;
		/**
		 * @property rings: Array of Number
		 * A flat `Array` containing indices (0-indexed) of the coordinate
		 * pairs that start a new ring.
		 */
		this.rings = rings;
		/**
		 * @property hulls: Array of Number
		 * A flat `Array` containing indices (0-indexed) of the coordinate
		 * pairs that start a new hull.
		 */
		this.hulls = hulls;
	}

	/**
	 * @method toCRS(newCRS: CRS): Geometry
	 * Returns the `Geometry`, translated/projected to the given CRS, as a new instance.
	 *
	 * If the CRS is exactly the same, `this` is returned instead.
	 * @alternative
	 * @method toCRS(newCRS: String): Geometry
	 * Idem, but takes a `String` containing the name (e.g. "EPSG:4326", "cartesian")
	 * or the OGC URI of a CRS. The corresponding CRS instance will be looked up.
	 */
	toCRS(newCRS) {
		if (newCRS === this.crs) {
			return this;
		} else if (typeof newCRS === "string") {
			return this.toCRS(getCRS(newCRS));
		} else if (newCRS.name === this.crs.name) {
			// Return a new Geometry mapping an offset to all xy pairs.
			return new RawGeometry(
				newCRS,
				newCRS.offsetFromBase(this.crs.offsetToBase(this.coords)),
				this.rings,
				this.hulls,
				{ wrap: this.wrap, dimension: 2 }
			);

			/// TODO: For wrapping CRSs, wrap the coordinate... with the original CRS
			/// wrapping limit/dimension/span, but using the offset center.
			/// So e.g. epsg:4326 offset to +170 longitude would wrap -175 to relative
			/// +15; this pushes the antimeridian opposite to the offset center.
		} else {
			// Reproject
			return new RawGeometry(
				newCRS,
				this.mapCoords((xy) =>
					newCRS.offsetFromBase(
						project(this.crs.name, newCRS.name, this.crs.offsetToBase(xy))
					)
				),
				this.rings,
				this.hulls,
				{ wrap: this.wrap, dimension: 2 }
			);
		}
	}

	/**
	 * @method asLatLng(): Array of Number
	 *
	 * Returns a **flat** array of latitude-longitude (Y-X) representing this geometry,
	 * in the form `[lat1, lng1, lat2, lng2, ... latN, lngN]`.
	 *
	 * Will throw an error if the geometry cannot be converted to latitude-longitude
	 * (i.e. is in a CRS that cannot be reprojected to EPSG:4326).
	 *
	 */
	asLatLng() {
		const xys = this.asLngLat();

		const yxs = new Array(xys.length);
		for (let i = 0, l = xys.length; i < l; i += 2) {
			yxs[i] = xys[i + 1];
			yxs[i + 1] = xys[i];
		}
		return yxs;
		/*
		return new Array(xys,(_,i)=> xys[
			(i >> 1 << 1) + // Get rid of the least significant bit
			!(i % 2) // Reverse of modulo 2
		]);*/
	}

	/**
	 * @method asLngLat(): Array of Number
	 *
	 * Returns a **flat** array of longitude-latitude (X-Y) representing this geometry,
	 * in the form `[lng1, lat1, lng2, lat2, ... lngN, latN]`.
	 *
	 * Will throw an error if the geometry cannot be converted to latitude-longitude
	 * (i.e. is in a CRS that cannot be reprojected to EPSG:4326).
	 *
	 */
	asLngLat() {
		return this.toCRS("EPSG:4326").coords;
	}

	#loops;
	/**
	 * @property loops: Array of Boolean
	 * A read-only `Array` with one `Boolean` values per ring. The value is
	 * `true` for those rings which forms loops (the first coordinate pair
	 * equals the last one).
	 */
	get loops() {
		if (this.#loops) {
			return this.#loops;
		}

		/// NOTE: This implementation only works for dimension 2 (XY) geometries.
		/// Ideally t should cover XYZ/XYM/ZYZM geometries.

		/// FIXME: Logic when the linestring loops across the antimridian.
		/// Compare start and end points, **taking into account CRS wrapping**.
		return (this.#loops = this.mapRings((start, end) => {
			const start2 = start * 2;
			const end2 = 2 * (end - 1);
			return (
				this.coords[start2 + 0] === this.coords[end2 + 0] &&
				this.coords[start2 + 1] === this.coords[end2 + 1]
			);
		}));
	}

	/**
	 * @property loops: Array of Boolean
	 * A read-only containing the starts (inclusive) and ends (exclusive)
	 * of all rings.
	 *
	 * Contains, at least, `0` and the amount of coordinate pairs (for
	 * geometries with just one ring)
	 */
	#stops;
	get stops() {
		if (this.#stops) {
			return this.#stops;
		}
		return (this.#stops = [
			0,
			...this.rings,
			...this.hulls,
			this.coords.length / this.dimension,
		].sort((a, b) => a - b));
	}

	/**
	 * @method mapCoords(fn: Function): Array of Number
	 * Returns a new array of the form `[x1,y1, ... xn,yn]`, having run the given
	 * `Function` on every `x,y` pair of coordinates from self. The `Function`
	 * must take an `Array` of 2 `Number`s as its first parameter (the coordinate
	 * pair), a `Number` as its second parameter (the index of the current
	 * coordinate pair, 0-indexed), and must return an `Array` of 2 `Number`s as well.
	 *
	 * Takes into account the dimension (dimension 3 works for `x,y,z` and dimension 4
	 * works for `x,y,z,m`)
	 *
	 */
	mapCoords(fn) {
		const d = this.dimension;
		const l = this.coords.length / d;
		const result = new Array(l);

		for (let i = 0; i < l; i++) {
			const j = i * d;
			result[i] = fn(this.coords.slice(j, j + d), i);
		}

		return result.flat();
	}

	/**
	 * @method mapRings(fn: Function): Array
	 * Runs the given `Function` once per ring (including each ring in each hull, if
	 * applicable), and returns an `Array` containing the return values.
	 *
	 * The given `Function` can expect four parameters:
	 * * `start` coordinate (0-indexed, inclusive)
	 * * `end` coordinate (0-indexed, exclusive)
	 * * `length` of the ring (how many coordinates in that ring, also `end-start`)
	 * * `i`, index of the current ring (0-indexed)
	 */
	mapRings(fn) {
		// I'm sure this can be done more efficiently in a C-like fashion
		// (i.e. pulling a value from either this.rings or this.hulls at
		// each pass of the loop, no array sorting/concat'ing), but this
		// should do for now.

		let stops = this.stops;

		const result = new Array(stops.length - 1);

		for (let i = 0, l = stops.length - 1; i < l; i++) {
			const start = stops[i];
			const end = stops[i + 1];
			result[i] = fn(start, end, end - start, i);
		}

		return result;
	}

	#cachedBBox;

	/**
	 * @method bbox(): ExpandBox
	 * Calculates and returns the bounding box of the geometry. The coordinates
	 * of the resulting will implicitly be in the geometry's CRS.
	 */
	bbox() {
		return (this.#cachedBBox ??= new ExpandBox().expandGeometry(this)).clone();
	}
}

/**
 * @class Geometry
 * @inherits RawGeometry
 *
 * A Gleo `Geometry` is akin to geometries in the OGC Simple Features Specification:
 * points, linestrings, polygons and multipolygons.
 *
 * Internally, `Geometry`s are represented as a flat array of coordinates, in the form
 * `[x1,y2, x2,y2, x3,y3 ... xn,yn]` for 2-dimensional geometries; plus a list of
 * offsets specifying the n-th coordinate where a hull starts and a ring starts (0th
 * hulls and rings are ommitted).
 *
 * (About nomenclature: a multipolygon has one or more hulls, and each hull
 * has an outer ring and zero or more inner rings. Hulls tell apart polygons
 * within a multipolygon, and rings tell apart inner/outer boundaries of a
 * polygon).
 *
 * (TODO: [x1,y1,z1, ... xn,yn,zn] for 3-dimensional, and [x1,y1,z1,m1, ... xn,yn,zn,mn]
 * for 4-dimensional)
 *
 * @example
 *
 * ```
 * let point = new Geometry(crs, [x,y]);
 *
 * let linestring = new Geometry(crs, [[x1,y1],[x2,y2]]);
 * ```
 *
 **/

/*

Depths:

0  Point
1  Multipoint Linestring
2             Multilinestring Polygon
3                             Multipolygon

 */

class Geometry extends RawGeometry {
	/**
	 * @section
	 * The constructor for a `Geometry` can take either a `BaseCRS` instance, or
	 * its name.
	 *
	 * The geometry can be:
	 * - An `Array` of two `Number`s (for points)
	 * - An `Array` of `Array`s of two `Number`s (for multipoints or linestrings)
	 * - An `Array` of `Array`s of `Array`s of two `Number`s (for multilinestrings or polygons)
	 * - An `Array` of `Array`s of `Array`s of `Array`s of two `Number`s (for multipolygons)
	 *
	 * @constructor Geometry(crs: BaseCRS, coords: Array of Number, opts: Geometry Options)
	 * @alternative
	 * @constructor Geometry(crs: String, coords: Array of Number, opts: Geometry Options)
	 * @alternative
	 * @constructor Geometry(crs: BaseCRS, coords: Array of Array of Number, opts: Geometry Options)
	 * @alternative
	 * @constructor Geometry(crs: BaseCRS, coords: Array of Array of Array of Number, opts: Geometry Options)
	 * @alternative
	 * @constructor Geometry(crs: BaseCRS, coords: Array of Array of Array of Array of Number, opts: Geometry Options)
	 */
	constructor(
		crs,
		coords,
		{
			wrap,
			dimension = 2,
			/**
			 * @section Geometry Options
			 * @option deduplicate: Boolean = true
			 * Whether to detect and remove duplicated consecutive coordinates. Prevents
			 * graphical artefacts on some edge cases of topologically malformed data.
			 */
			deduplicate = true,
		} = {}
	) {
		let rings = [];
		let hulls = [];
		let depth;
		if (typeof coords[0] === "number") {
			depth = 0;
		} else {
			if (deduplicate) {
				coords = deduplicateConsecutives(coords);
			}

			if (typeof coords[0][0] === "number") {
				depth = 1;
			} else if (typeof coords[0][0][0] === "number") {
				depth = 2;
				// Calculate rings
				let ringOffset = 0;
				for (let r = 0, l = coords.length - 1; r < l; r++) {
					rings.push((ringOffset += coords[r].length));
				}
			} else if (typeof coords[0][0][0][0] === "number") {
				depth = 3;
				// hulls and rings
				let hullOffset = 0;
				let ringOffset = 0;
				for (let h = 0, l = coords.length; h < l; h++) {
					let hullSize = 0;
					for (let r = 0, ll = coords[h].length; r < ll; r++) {
						const ringLength = coords[h][r].length;
						ringOffset += ringLength;
						if (r !== ll - 1) {
							rings.push(ringOffset);
						}
						hullSize += ringLength;
					}

					if (h !== l - 1) {
						hulls.push((hullOffset += hullSize));
					}
				}
			} else {
				throw new Error(
					"Coordinate array passed to Geometry constructor has too many levels of array nesting."
				);
			}
		}

		// Assert dimension
		if (depth) {
			if (!coords.flat(depth - 1).every((v) => v.length === dimension)) {
				throw new Error(
					`While instancing Geometry, expected all coordinates to be of dimension ${dimension}`
				);
			}
		} else {
			if (coords.length !== dimension) {
				throw new Error(
					`While instancing point Geometry, expected all coordinates to be of dimension ${dimension}`
				);
			}
		}

		if (!(crs instanceof BaseCRS)) {
			crs = getCRS(crs);
		}

		super(crs, coords.flat(depth), rings, hulls, { wrap, dimension });
	}
}

function deduplicateConsecutives(coords) {
	if (typeof coords[0][0] !== "number") {
		return coords.map(deduplicateConsecutives);
	}

	const l = coords.length - 1;
	return coords.filter(
		(c, i) => i === l || c[0] !== coords[i + 1][0] || c[1] !== coords[i + 1][1]
	);
}

/**
 * @class Evented
 * @inherits EventTarget
 *
 * Lightweight utility wrapper around `EventTarget`.
 */

class Evented extends EventTarget {
	/**
	 * @section Event Methods
	 * @method on(eventName: String, handler: Function): this
	 * Alias to `EventTarget`'s `addEventListener`.
	 * @method off(eventName: String, handler: Function): this
	 * Alias to `EventTarget`'s `removeEventListener`.
	 */
	on() {
		this.addEventListener.apply(this, arguments);
		return this;
	}
	off() {
		this.removeEventListener.apply(this, arguments);
		return this;
	}

	/**
	 * @method once(eventName: String, handler?: Function): Promise
	 * As `on()`, but the handler function will only be called once (it'll be
	 * detached after the first fired event). Returns a `Promise` that resolves
	 * to the event when that event is fired.
	 */
	once(eventName, handler) {
		return new Promise((resolve) => {
			if (handler) {
				this.on(eventName, handler, { once: true });
			}
			this.on(eventName, resolve, { once: true });
		});
	}

	/**
	 * @method fire(eventName: String, detail: Object): Boolean
	 *
	 * Wrapper over `EventTarget`'s `dispatchEvent`. Creates a new instance of
	 * `CustomEvent`, dispatches it, and returns `true` if some event handler
	 * did `preventDefault` the event.
	 */
	fire(eventName, detail) {
		return this.dispatchEvent(new CustomEvent(eventName, { detail }));
	}
}

/**
 * @class Loader
 * @inherits Evented
 *
 * A `Loader` loads/unloads symbols as needed.
 *
 * Some `Loader`s might watch for changes in the map's (or the `Platina`s)
 * state (center, scale, etc) and load/unload symbols based on that.
 *
 * Some other `Loader`s work with data formats, making network requests and
 * parsing data.
 *
 *
 * @event symbolsadded
 * Fired whenever the loader reports new symbols. Even details include such symbols.
 * @event symbolsremoved
 * Fired whenever the loader forgets or unloads old symbols. Event details include such symbols.
 */

class Loader extends Evented {
	#target;
	#platina;

	constructor({ attribution } = {}) {
		super();
		/**
		 * @option attribution: String = undefined
		 * The HTML attribution to be shown in the `AttributionControl`, if any.
		 */
		this.attribution = attribution;
	}

	/**
	 * @method addTo(target: GleoMap): this
	 * Adds the `Loader` to the given `GleoMap`
	 * @alternative
	 * @method addTo(target: Platina): this
	 * Adds the `Loader` to the given `Platina`
	 * @alternative addTo(target: SymbolGroup
	 * Adds the `Loader` to the given `SymbolGroup`
	 */
	addTo(target) {
		if (!this.#target && target.has(this)) {
			// This loader is in the process of being added to a SymbolGroup
			this.#target = target;
		} else {
			this.#target = target;
			target.add(this);
		}

		if (target.platina) {
			this._addToPlatina(target.platina);
		} else if (target instanceof Platina) {
			this._addToPlatina(target);
		}
		return this;
	}

	/**
	 * @property target: GleoMap
	 * The target where the loader was added to. Might be a `GleoMap`, a `Platina`
	 * or a `SymbolGroup`. Read-only.
	 * @alternative
	 * @property target: Platina
	 * @alternative
	 * @property target: SymbolGroup
	 */
	get target() {
		return this.#target;
	}

	/**
	 * @property platina
	 * The `Platina` where symbols from this loader will be drawn into. Read-only.
	 */
	get platina() {
		return this.#platina;
	}

	/**
	 * @class Loader
	 * @method remove(): this
	 * Removes the `Loader` from the map/platina it was in.
	 */
	remove() {
		if (!this.#target) {
			throw new Error("Cannot remove Loader: is already removed");
		}

		this.#platina = this.#target = undefined;
		return this;
	}

	// Internal use only.
	// Called when the loader gets attached to a platina. Might not happen
	// immediately, in cases like a loader gets added to a SymbolGroup, and later
	// that SymbolGroup gets added to a Platina.
	// Subclasses may extend this method.
	_addToPlatina(platina) {
		this.#platina = platina;
		this.#target ||= platina;
	}
}

/**
 * Common utilities
 * @module glMatrix
 */
// Configuration Constants
var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

/**
 * Transpose the values of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the source matrix
 * @returns {mat3} out
 */

function transpose(out, a) {
  // If we are transposing ourselves we can skip a few steps but have to cache some values
  if (out === a) {
    var a01 = a[1],
        a02 = a[2],
        a12 = a[5];
    out[1] = a[3];
    out[2] = a[6];
    out[3] = a01;
    out[5] = a[7];
    out[6] = a02;
    out[7] = a12;
  } else {
    out[0] = a[0];
    out[1] = a[3];
    out[2] = a[6];
    out[3] = a[1];
    out[4] = a[4];
    out[5] = a[7];
    out[6] = a[2];
    out[7] = a[5];
    out[8] = a[8];
  }

  return out;
}
/**
 * Inverts a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the source matrix
 * @returns {mat3} out
 */

function invert(out, a) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2];
  var a10 = a[3],
      a11 = a[4],
      a12 = a[5];
  var a20 = a[6],
      a21 = a[7],
      a22 = a[8];
  var b01 = a22 * a11 - a12 * a21;
  var b11 = -a22 * a10 + a12 * a20;
  var b21 = a21 * a10 - a11 * a20; // Calculate the determinant

  var det = a00 * b01 + a01 * b11 + a02 * b21;

  if (!det) {
    return null;
  }

  det = 1.0 / det;
  out[0] = b01 * det;
  out[1] = (-a22 * a01 + a02 * a21) * det;
  out[2] = (a12 * a01 - a02 * a11) * det;
  out[3] = b11 * det;
  out[4] = (a22 * a00 - a02 * a20) * det;
  out[5] = (-a12 * a00 + a02 * a10) * det;
  out[6] = b21 * det;
  out[7] = (-a21 * a00 + a01 * a20) * det;
  out[8] = (a11 * a00 - a01 * a10) * det;
  return out;
}
/**
 * Multiplies two mat3's
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the first operand
 * @param {ReadonlyMat3} b the second operand
 * @returns {mat3} out
 */

function multiply(out, a, b) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2];
  var a10 = a[3],
      a11 = a[4],
      a12 = a[5];
  var a20 = a[6],
      a21 = a[7],
      a22 = a[8];
  var b00 = b[0],
      b01 = b[1],
      b02 = b[2];
  var b10 = b[3],
      b11 = b[4],
      b12 = b[5];
  var b20 = b[6],
      b21 = b[7],
      b22 = b[8];
  out[0] = b00 * a00 + b01 * a10 + b02 * a20;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22;
  out[3] = b10 * a00 + b11 * a10 + b12 * a20;
  out[4] = b10 * a01 + b11 * a11 + b12 * a21;
  out[5] = b10 * a02 + b11 * a12 + b12 * a22;
  out[6] = b20 * a00 + b21 * a10 + b22 * a20;
  out[7] = b20 * a01 + b21 * a11 + b22 * a21;
  out[8] = b20 * a02 + b21 * a12 + b22 * a22;
  return out;
}
/**
 * Creates a matrix from a vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat3.identity(dest);
 *     mat3.translate(dest, dest, vec);
 *
 * @param {mat3} out mat3 receiving operation result
 * @param {ReadonlyVec2} v Translation vector
 * @returns {mat3} out
 */

function fromTranslation(out, v) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 1;
  out[5] = 0;
  out[6] = v[0];
  out[7] = v[1];
  out[8] = 1;
  return out;
}

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */

function create() {
  var out = new ARRAY_TYPE(3);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}
/**
 * Transforms the vec3 with a mat3.
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat3} m the 3x3 matrix to transform with
 * @returns {vec3} out
 */

function transformMat3(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];
  return out;
}
/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 3;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }

    return a;
  };
})();

// @namespace dom

// Pretty much ripped off Leaflet's `L.DomEvent.getMousePosition`

// @function getMousePosition(ev: MouseEvent, element?: HTMLElement): Array of Number
// Gets normalized mouse position from a DOM mouse/pointer event relative to the
// `element` (border excluded) or to the whole page if not specified.
//
// The return value is an array of the form `[x, y]`, in CSS pixels
function getMousePosition(ev, element) {
	if (!element) {
		return [ev.clientX, ev.clientY];
	}

	var scale = getScale(element),
		offset = scale.boundingClientRect; // left and top  values are in page scale (like the event clientX/Y)

	return [
		// offset.left/top values are in page scale (like clientX/Y),
		// whereas clientLeft/Top (border width) values are the original values (before CSS scale applies).
		(ev.clientX - offset.left) / scale.x - element.clientLeft,
		(ev.clientY - offset.top) / scale.y - element.clientTop,
	];
}

// Pretty much ripped off Leaflet's `L.DomUtil.getScale`

// @function getScale(el: HTMLElement): Object
// Computes the CSS scale currently applied on the element.
// Returns an object with `x` and `y` members as horizontal and vertical scales respectively,
// and `boundingClientRect` as the result of [`getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).
function getScale(element) {
	var rect = element.getBoundingClientRect(); // Read-only in old browsers.

	return {
		x: rect.width / element.offsetWidth || 1,
		y: rect.height / element.offsetHeight || 1,
		boundingClientRect: rect,
	};
}

// ES6-style class mixin (see
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes#mix-ins )
// for both `GleoMouseEvent` and `GleoPointerEvent`

/**
 * @class GleoEvent
 *
 * [Class mix-in](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes#mix-ins)
 * for functionality common to `GleoPointerEvent` and `GleoMouseEvent`.
 */

function GleofyEventClass(Base) {
	return class GleoEvent extends Base {
		constructor(type, init) {
			super(type, init);

			/**
			 * @property geometry: Geometry
			 * A point `Geometry`, containing the coordinates in map's CRS where the
			 * event took place.
			 * This is akin to Leaflet's `latlng` event property.
			 *
			 * @property canvasX: Number
			 * Akin to `clientX`, but relative to the map's `<canvas>` element.
			 *
			 * @property canvasY: Number
			 * Akin to `clientY`, but relative to the map's `<canvas>` element.
			 */
			this.geometry = init.geometry;
			this.canvasX = init.canvasX;
			this.canvasY = init.canvasY;

			/**
			 * @property colour: Array of Number
			 * For `Acetate`s set as "queryable" (and `GleoSymbol`s being
			 * drawn in such acetates), this contains the colour of the pixel
			 * the event took place over, as a 4-element array of the form
			 * `[r, g, b, a]`, with values between 0 and 255.
			 * @alternative
			 * @property colour: undefined
			 * For `Acetate`s **not** set as "queryable" (and `GleoSymbol`s
			 * being drawn in such acetates), and for event that happened outside
			 * of the map (e.g. `pointerout` events), this value will always
			 * be `undefined`)
			 */
			this.colour = init.colour;

			this._canPropagate = true;
		}

		stopPropagation() {
			this._canPropagate = false;
			return super.stopPropagation();
		}
	};
}

/**
 *
 * @class GleoMouseEvent
 * @inherits MouseEvent
 * @inherits GleoEvent
 *
 * Akin to `GleoPointerEvent`, but only used for `click` events (since `click` events are
 * instances of `MouseEvent`, not `PointerEvent`).
 *
 * Note that Gleo **does not handle** any other `MouseEvent`s. Trying to do something like
 * `map.on('mousedown', fn)` will do nothing.
 *
 * @example
 *
 * ```js
 * map.on('click', function(ev) {
 * 	console.log(ev.geom);
 * });
 * ```
 *
 */

class GleoMouseEvent extends GleofyEventClass(MouseEvent) {}

/**
 *
 * @class GleoPointerEvent
 * @inherits PointerEvent
 * @inherits GleoEvent
 *
 * Gleo maps handle pointer events - such as `pointerdown`. All pointer
 * events fired by a map instance are not instances of `PointerEvent`, but of
 * `GleoPointerEvent`.
 *
 * This means that a map's pointer events have extra properties - most notably
 * a geometry with the CRS coordinates where the pointer event happened.
 *
 * For the `click` event, see `GleoMouseEvent`.
 *
 * @example
 *
 * ```js
 * map.on('pointerdown', function(ev) {
 * 	console.log(ev.geom);
 * });
 * ```
 */

class GleoPointerEvent extends GleofyEventClass(PointerEvent) {}

const nullGeometry = new RawGeometry({ name: "null" }, [], [], [], { wrap: false });

/**
 * @namespace DefaultGeometry
 * @relationship associated Geometry
 *
 * This module contains facilities for easing the task of defining geometries
 * when a well-known CRS is used for all input coordinates.
 *
 * Note that this functionality is **global to all maps** since it must work for
 * stuff which does not belong to any map, or belongs to more than one map at
 * the same time.
 *
 * @example
 * ```
 * import { setFactory, factory } from `gleo/src/coords/DefaultGeometry.mjs`;
 *
 * setFactory(function(coords, opts) {
 * 	return new Geometry( myFavouriteCRS, coords, opts);
 * }
 *
 * map.center = [100, -500]; // These stand-alone coordinates will internally
 *                           // be converted into a `Geometry` of `myFavouriteCRS`
 * ```
 *
 * Calling `setFactory` more than once (either manually or by importing `MercatorMap`)
 * is highly discouraged.
 */

let currentFactory = function uninitializedDefaultGeometry() {
	throw new Error(
		`A way to spawn geometries without an explicit CRS has not been defined`
	);
};

/**
 * @function setFactory(fn: Function): undefined
 * Sets the factory function for transforming stand-alone coordinates into
 * geometries with a specific CRS.
 *
 * The function must take a single `coordinates` argument, and return a `Geometry`
 * instance.
 */
function setFactory(fn) {
	currentFactory = fn;
}

/**
 * @function factory(coords: Array of Number, opts?: Geometry Options): RawGeometry
 * The factory function that takes coordinates and returns `Geometry`s.
 *
 * All Gleo functionality that can take geometries as input **must** pass it
 * through this factory function.
 *
 * In some cases, geometry constructor options (such as `deduplicate` or `wrap`)
 * will be passed. The factory function should honour these.
 * @alternative
 * @function factory(geom: RawGeometry, opts?: Geometry Options): RawGeometry
 * When the factory function receives a `Geometry`, it is returned as is.
 *
 * In this way, all Gleo functionality that uses this factory will be able to
 * take as input either stand-alone coordinates, or fully-defined `Geometry`s,
 * in a transparent way.
 *
 * This check is performed by the `DefaultGeometry` module; users do **not** need
 * to check whether the input is a `RawGeometry` instance when using `setFactory()`.
 * @alternative
 * @function factory(geom: undefined): RawGeometry
 * A "null" geometry, containing zero vertices, will be returned.
 */
function factory(coords, opts) {
	if (coords instanceof RawGeometry) {
		return coords;
	}
	if (coords === undefined) {
		return nullGeometry;
	}
	return currentFactory(coords, opts);
}

// © Dean McNamee <dean@gmail.com>, 2012.
// © Iván Sánchez Ortega <ivan@sanchezortega, 2017.
//
// See:
//  https://github.com/deanm/css-color-parser-js
//  https://github.com/IvanSanchez/css-color-parser-js
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.

// http://www.w3.org/TR/css3-color/
var kCSSColorTable = {
	transparent: [0, 0, 0, 0],
	aliceblue: [240, 248, 255, 255],
	antiquewhite: [250, 235, 215, 255],
	aqua: [0, 255, 255, 255],
	aquamarine: [127, 255, 212, 255],
	azure: [240, 255, 255, 255],
	beige: [245, 245, 220, 255],
	bisque: [255, 228, 196, 255],
	black: [0, 0, 0, 255],
	blanchedalmond: [255, 235, 205, 255],
	blue: [0, 0, 255, 255],
	blueviolet: [138, 43, 226, 255],
	brown: [165, 42, 42, 255],
	burlywood: [222, 184, 135, 255],
	cadetblue: [95, 158, 160, 255],
	chartreuse: [127, 255, 0, 255],
	chocolate: [210, 105, 30, 255],
	coral: [255, 127, 80, 255],
	cornflowerblue: [100, 149, 237, 255],
	cornsilk: [255, 248, 220, 255],
	crimson: [220, 20, 60, 255],
	cyan: [0, 255, 255, 255],
	darkblue: [0, 0, 139, 255],
	darkcyan: [0, 139, 139, 255],
	darkgoldenrod: [184, 134, 11, 255],
	darkgray: [169, 169, 169, 255],
	darkgreen: [0, 100, 0, 255],
	darkgrey: [169, 169, 169, 255],
	darkkhaki: [189, 183, 107, 255],
	darkmagenta: [139, 0, 139, 255],
	darkolivegreen: [85, 107, 47, 255],
	darkorange: [255, 140, 0, 255],
	darkorchid: [153, 50, 204, 255],
	darkred: [139, 0, 0, 255],
	darksalmon: [233, 150, 122, 255],
	darkseagreen: [143, 188, 143, 255],
	darkslateblue: [72, 61, 139, 255],
	darkslategray: [47, 79, 79, 255],
	darkslategrey: [47, 79, 79, 255],
	darkturquoise: [0, 206, 209, 255],
	darkviolet: [148, 0, 211, 255],
	deeppink: [255, 20, 147, 255],
	deepskyblue: [0, 191, 255, 255],
	dimgray: [105, 105, 105, 255],
	dimgrey: [105, 105, 105, 255],
	dodgerblue: [30, 144, 255, 255],
	firebrick: [178, 34, 34, 255],
	floralwhite: [255, 250, 240, 255],
	forestgreen: [34, 139, 34, 255],
	fuchsia: [255, 0, 255, 255],
	gainsboro: [220, 220, 220, 255],
	ghostwhite: [248, 248, 255, 255],
	gold: [255, 215, 0, 255],
	goldenrod: [218, 165, 32, 255],
	gray: [128, 128, 128, 255],
	green: [0, 128, 0, 255],
	greenyellow: [173, 255, 47, 255],
	grey: [128, 128, 128, 255],
	honeydew: [240, 255, 240, 255],
	hotpink: [255, 105, 180, 255],
	indianred: [205, 92, 92, 255],
	indigo: [75, 0, 130, 255],
	ivory: [255, 255, 240, 255],
	khaki: [240, 230, 140, 255],
	lavender: [230, 230, 250, 255],
	lavenderblush: [255, 240, 245, 255],
	lawngreen: [124, 252, 0, 255],
	lemonchiffon: [255, 250, 205, 255],
	lightblue: [173, 216, 230, 255],
	lightcoral: [240, 128, 128, 255],
	lightcyan: [224, 255, 255, 255],
	lightgoldenrodyellow: [250, 250, 210, 255],
	lightgray: [211, 211, 211, 255],
	lightgreen: [144, 238, 144, 255],
	lightgrey: [211, 211, 211, 255],
	lightpink: [255, 182, 193, 255],
	lightsalmon: [255, 160, 122, 255],
	lightseagreen: [32, 178, 170, 255],
	lightskyblue: [135, 206, 250, 255],
	lightslategray: [119, 136, 153, 255],
	lightslategrey: [119, 136, 153, 255],
	lightsteelblue: [176, 196, 222, 255],
	lightyellow: [255, 255, 224, 255],
	lime: [0, 255, 0, 255],
	limegreen: [50, 205, 50, 255],
	linen: [250, 240, 230, 255],
	magenta: [255, 0, 255, 255],
	maroon: [128, 0, 0, 255],
	mediumaquamarine: [102, 205, 170, 255],
	mediumblue: [0, 0, 205, 255],
	mediumorchid: [186, 85, 211, 255],
	mediumpurple: [147, 112, 219, 255],
	mediumseagreen: [60, 179, 113, 255],
	mediumslateblue: [123, 104, 238, 255],
	mediumspringgreen: [0, 250, 154, 255],
	mediumturquoise: [72, 209, 204, 255],
	mediumvioletred: [199, 21, 133, 255],
	midnightblue: [25, 25, 112, 255],
	mintcream: [245, 255, 250, 255],
	mistyrose: [255, 228, 225, 255],
	moccasin: [255, 228, 181, 255],
	navajowhite: [255, 222, 173, 255],
	navy: [0, 0, 128, 255],
	oldlace: [253, 245, 230, 255],
	olive: [128, 128, 0, 255],
	olivedrab: [107, 142, 35, 255],
	orange: [255, 165, 0, 255],
	orangered: [255, 69, 0, 255],
	orchid: [218, 112, 214, 255],
	palegoldenrod: [238, 232, 170, 255],
	palegreen: [152, 251, 152, 255],
	paleturquoise: [175, 238, 238, 255],
	palevioletred: [219, 112, 147, 255],
	papayawhip: [255, 239, 213, 255],
	peachpuff: [255, 218, 185, 255],
	peru: [205, 133, 63, 255],
	pink: [255, 192, 203, 255],
	plum: [221, 160, 221, 255],
	powderblue: [176, 224, 230, 255],
	purple: [128, 0, 128, 255],
	rebeccapurple: [102, 51, 153, 255],
	red: [255, 0, 0, 255],
	rosybrown: [188, 143, 143, 255],
	royalblue: [65, 105, 225, 255],
	saddlebrown: [139, 69, 19, 255],
	salmon: [250, 128, 114, 255],
	sandybrown: [244, 164, 96, 255],
	seagreen: [46, 139, 87, 255],
	seashell: [255, 245, 238, 255],
	sienna: [160, 82, 45, 255],
	silver: [192, 192, 192, 255],
	skyblue: [135, 206, 235, 255],
	slateblue: [106, 90, 205, 255],
	slategray: [112, 128, 144, 255],
	slategrey: [112, 128, 144, 255],
	snow: [255, 250, 250, 255],
	springgreen: [0, 255, 127, 255],
	steelblue: [70, 130, 180, 255],
	tan: [210, 180, 140, 255],
	teal: [0, 128, 128, 255],
	thistle: [216, 191, 216, 255],
	tomato: [255, 99, 71, 255],
	turquoise: [64, 224, 208, 255],
	violet: [238, 130, 238, 255],
	wheat: [245, 222, 179, 255],
	white: [255, 255, 255, 255],
	whitesmoke: [245, 245, 245, 255],
	yellow: [255, 255, 0, 255],
	yellowgreen: [154, 205, 50, 255],
};

function clamp_css_byte(i) {
	// Clamp to integer 0 .. 255.
	i = Math.round(i); // Seems to be what Chrome does (vs truncation).
	return i < 0 ? 0 : i > 255 ? 255 : i;
}

function clamp_css_float(f) {
	// Clamp to float 0.0 .. 1.0.
	return f < 0 ? 0 : f > 1 ? 1 : f;
}

function parse_css_int(str) {
	// int or percentage.
	if (str[str.length - 1] === "%") return clamp_css_byte((parseFloat(str) / 100) * 255);
	return clamp_css_byte(parseInt(str));
}

function parse_css_float(str) {
	// float or percentage.
	if (str[str.length - 1] === "%") return clamp_css_float(parseFloat(str) / 100);
	return clamp_css_float(parseFloat(str));
}

function css_hue_to_rgb(m1, m2, h) {
	if (h < 0) h += 1;
	else if (h > 1) h -= 1;

	if (h * 6 < 1) return m1 + (m2 - m1) * h * 6;
	if (h * 2 < 1) return m2;
	if (h * 3 < 2) return m1 + (m2 - m1) * (2 / 3 - h) * 6;
	return m1;
}

function parseCSSColor(css_str) {
	if (
		css_str instanceof Array ||
		css_str instanceof Uint8Array ||
		css_str instanceof Uint8ClampedArray
	) {
		if (typeof css_str[0] === "number") {
			if (css_str.length === 4) {
				return css_str;
			} else if (css_str.length === 3) {
				return [...css_str, 255];
			}
		} else {
			return null;
		}
	}

	// Remove all whitespace, not compliant, but should just be more accepting.
	var str = css_str.replace(/ /g, "").toLowerCase();

	// Color keywords (and transparent) lookup.
	if (str in kCSSColorTable) return kCSSColorTable[str].slice(); // dup.

	// #abc and #abc123 syntax.
	if (str[0] === "#") {
		var iv = parseInt(str.substr(1), 16); // TODO(deanm): Stricter parsing.
		if (str.length === 4) {
			// #rgb
			if (!(iv >= 0 && iv <= 0xfff)) return null; // Covers NaN.
			return [
				((iv & 0xf00) >> 4) | ((iv & 0xf00) >> 8),
				(iv & 0x0f0) | ((iv & 0x0f0) >> 4),
				((iv & 0x00f) << 4) | (iv & 0x00f),
				255,
			];
		} else if (str.length === 7) {
			// #rrggbb
			if (!(iv >= 0 && iv <= 0xffffff)) return null; // Covers NaN.
			return [(iv & 0xff0000) >> 16, (iv & 0x00ff00) >> 8, iv & 0x0000ff, 255];
		} else if (str.length === 5) {
			// #rgba
			if (!(iv >= 0 && iv <= 0xffff)) return null; // Covers NaN.
			return [
				((iv & 0xf000) >> 8) | ((iv & 0xf000) >> 12),
				((iv & 0x0f00) >> 4) | ((iv & 0x0f00) >> 8),
				(iv & 0x00f0) | ((iv & 0x00f0) >> 4),
				((iv & 0x000f) << 4) | (iv & 0x000f),
			];
		} else if (str.length === 9) {
			// #rrggbbaa
			if (!(iv >= 0 && iv <= 0xffffffff)) return null; // Covers NaN.
			return [
				((iv & 0xff000000) >> 24) & 0xff,
				(iv & 0x00ff0000) >> 16,
				(iv & 0x0000ff00) >> 8,
				iv & 0x000000ff,
			];
		}

		return null;
	}

	var op = str.indexOf("("),
		ep = str.indexOf(")");
	if (op !== -1 && ep + 1 === str.length) {
		var fname = str.substr(0, op);
		var params = str.substr(op + 1, ep - (op + 1)).split(",");
		var alpha = 255; // To allow case fallthrough.
		switch (fname) {
			case "rgba":
				if (params.length !== 4) return null;
				alpha = parse_css_int(params.pop());
			// Fall through.
			case "rgb":
				if (params.length !== 3) return null;
				return [
					parse_css_int(params[0]),
					parse_css_int(params[1]),
					parse_css_int(params[2]),
					alpha,
				];
			case "hsla":
				if (params.length !== 4) return null;
				alpha = Math.round(parse_css_float(params.pop()) * 255);
			// Fall through.
			case "hsl":
				if (params.length !== 3) return null;
				var h = (((parseFloat(params[0]) % 360) + 360) % 360) / 360; // 0 .. 1
				// NOTE(deanm): According to the CSS spec s/l should only be
				// percentages, but we don't bother and let float or percentage.
				var s = parse_css_float(params[1]);
				var l = parse_css_float(params[2]);
				var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
				var m1 = l * 2 - m2;
				return [
					clamp_css_byte(css_hue_to_rgb(m1, m2, h + 1 / 3) * 255),
					clamp_css_byte(css_hue_to_rgb(m1, m2, h) * 255),
					clamp_css_byte(css_hue_to_rgb(m1, m2, h - 1 / 3) * 255),
					alpha,
				];
			default:
				return null;
		}
	}

	return null;
}

/**
 * @class AbstractSymbolGroup
 * @inherits Loader
 * @relationship aggregationOf GleoSymbol, 0..1, 0..n
 *
 * Abstract base class for `Loader`s that can have `GleoSymbol`s added to them
 * (e.g. symbols can be added to a `Clusterer` loader instead of a `Platina` or
 * `GleoMap`).
 *
 */

/// TODO: Should this have events for symbols added / removed??

class AbstractSymbolGroup extends Loader {
	constructor(opts) {
		super(opts);

		/**
		 * @section Subclass interface
		 * @uninheritable
		 * @property symbols: Set of GleoSymbol
		 * The `GleoSymbol`s added to this group.
		 * @property loaders: Array of Loader
		 * The `Loader`s added to this group. These can be loaders that spawn symbols,
		 * or
		 */
		this.symbols = new Set();

		// this.#boundAddSymbols = this._addSymbols.bind(this);
		this.#boundAddSymbols = (ev) => {
			this._addSymbols(ev.detail.symbols);
		};
		// this.#boundRemoveSymbols = this._removeSymbols.bind(this);
		this.#boundRemoveSymbols = (ev) => {
			this._removeSymbols(ev.detail.symbols);
		};
	}

	#boundAddSymbols;
	#boundRemoveSymbols;
	#loaders = [];

	/**
	 * @section
	 * @method add(symbol: GleoSymbol): this
	 * Adds the given symbol to this symbol group.
	 * @alternative
	 * @method add(loader: Loader): this
	 * Adds the given loader to this symbol group. Symbols from that loader will
	 * be put into this group.
	 */
	add(symbol) {
		if (symbol instanceof Loader) {
			this._addLoaders([symbol]);
		} else {
			this._addSymbols([symbol]);
		}
		return this;
	}

	/**
	 * @section Subclass interface
	 * @method _addSymbols(Array of GleoSymbol)
	 * Tracks the given symbols. Can be overriden by subclasses.
	 */
	_addSymbols(symbols) {
		for (const s of symbols) {
			this.symbols.add(s);
		}
	}

	/**
	 * @section Subclass interface
	 * @method _addLoaders(Array of Loader)
	 * Tracks the given loaders. Can be overriden by subclasses.
	 */
	_addLoaders(loaders) {
		this.#loaders = this.#loaders.concat(loaders);
		loaders.forEach((l) => {
			l.on("symbolsadded", this.#boundAddSymbols);
			l.on("symbolsremoved", this.#boundRemoveSymbols);
			if (l.target !== this) {
				if (!l.target) {
					l.addTo(this);
				} else {
					throw new Error("Cannot add a Loader that already has a target");
				}
			}
			// l.addTo(this);
		});
	}

	/**
	 * @section Subclass interface
	 * @method _removeSymbols(Array of GleoSymbol)
	 * Stops tracking the given symbols. Can be overriden by subclasses.
	 */
	_removeSymbols(symbols) {
		for (const s of symbols) {
			this.symbols.delete(s);
		}
	}

	/**
	 * @section Subclass interface
	 * @method _removeLoaders(Array of Loader)
	 * Stops tracking the given loaders. Can be overriden by subclasses.
	 */
	_removeLoaders(loaders) {
		loaders.forEach((l) => {
			if (l.target !== this) {
				throw new Error("Cannot remove a Loader that hasn't been added here");
			}
			l.remove();
			l.off("symbolsadded", this.#boundAddSymbols);
			l.off("symbolsremoved", this.#boundRemoveSymbols);
		});
		this.#loaders = this.#loaders.filter((l) => !loaders.includes(l));
	}

	_addToPlatina(platina) {
		super._addToPlatina(platina);
		this.#loaders.forEach((l) => l._addToPlatina(platina));
	}

	/**
	 * @section
	 * @method multiAdd(symbols: Array of GleoSymbol): this
	 * Adds the given symbols to this group loader
	 * @alternative
	 * @method multiAdd(loaders: Array of Loader): this
	 * Adds the given loaders to this group loader
	 */
	multiAdd(symbols) {
		/// This implementations is probably inefficient, but ensures that the
		/// a `multiAdd()` call will call the `add()` method from the right subclass.
		this._addLoaders(
			symbols.filter((s) => s instanceof Loader && !this.#loaders.includes(s))
		);
		this._addSymbols(
			symbols.filter((s) => !(s instanceof Loader) && !this.symbols.has(s))
		);
		return this;
	}

	/**
	 * @method remove(): this
	 * Removes the `Loader` from the map/platina it was in.
	 * @alternative
	 * @method remove(symbol: GleoSymbol): this
	 * Removes the given symbol from this group loader.
	 * @alternative
	 * @method remove(loader: Loader): this
	 * Removes the given `Loader` from this group loader.
	 */
	remove(symbol) {
		if (symbol) {
			if (symbol instanceof Loader) {
				this._removeLoaders([symbol]);
			} else if (this.symbols.includes(symbol)) {
				this._removeSymbols([symbol]);
			}

			return this;
		} else {
			return super.remove();
		}
	}

	/**
	 * @method multiRemove(symbols): this
	 * Removes the given symbols from this group loader
	 */
	multiRemove(symbols) {
		this._removeLoaders(symbols.filter((s) => s instanceof Loader));
		this._removeSymbols(symbols.filter((s) => !(s instanceof Loader)));

		return this;
	}

	/**
	 * @method empty(): this
	 * Empties the symbol group, by removing all known symbols and loaders in it.
	 */
	empty() {
		this.symbols.clear();
		this.#loaders.length = 0;
		return this;
	}

	/**
	 * @method has(symbol: GleoSymbol): Boolean
	 * Returns `true` if this loader contains the given symbol, false otherwise.
	 * @alternative
	 * @method has(symbol: Loader): Boolean
	 * Returns `true` if this loader contains the given loader, false otherwise.
	 */
	has(s) {
		return this.symbols.has(s) || this.#loaders.includes(s);
	}
}

/**
 * @class GleoSymbol
 * @inherits Evented
 *
 * @relationship compositionOf RawGeometry, 0..n, 1..1
 *
 * An abstract base graphical symbol.
 *
 * (This would ideally called `Symbol`, but that's a reserved word in ES6 Javascript).
 *
 * A `GleoSymbol` is closely coupled to a matching `Acetate`. The `Acetate` defines
 * the WebGL program that will render symbols in the GPU; whereas `GleoSymbol`s hook
 * to an acetate, and fill up some data structures provided by it.
 *
 */

class GleoSymbol extends Evented {
	#attribution;
	#interactive;
	#geometry;
	#cursor;
	#allocationPromise;

	/**
	 * @constructor GleoSymbol(geom: RawGeometry, opts: GleoSymbol Options)
	 * @alternative
	 * @constructor GleoSymbol(geom: Array of Number, opts: GleoSymbol Options)
	 */
	constructor(
		geom,
		{
			/**
			 * @section
			 * @aka GleoSymbol Options
			 * @option attribution: String = undefined
			 * The HTML attribution to be shown in the `AttributionControl`, if any.
			 */
			attribution,
			/**
			 * @option interactive: Boolean = false
			 * Whether this `GleoSymbol` should fire mouse/pointer events (or not).
			 *
			 * Needs the symbol to be drawn in an appropriate `Acetate`.
			 */
			interactive = false,
			/**
			 * @option cursor: String = undefined
			 * The pointer cursor to be used when the primary is hovering over
			 * this symbol.
			 *
			 * Possible values are the keywords for the [`cursor` CSS property](https://developer.mozilla.org/docs/Web/CSS/cursor.html)
			 * (e.g. `"pointer"`, `"wait"`, `"move"`, etc).
			 *
			 * Needs `interactive` to be `true`.
			 */
			cursor,
		} = {}
	) {
		super();

		// The acetate instance this symbol is being drawn in:
		this._inAcetate = undefined;

		if (geom) {
			this.geometry = geom;
		}
		this.#attribution = attribution;
		this.#interactive = interactive;
		this.#cursor = cursor;

		// Used by `MultiSymbol` and such. Events dispatched to this symbol
		// will also be dispatched to all the event parents.
		this._eventParents = [];

		/**
		 * @section Acetate interface
		 * @uninheritable
		 *
		 * `GleoSymbol`s must expose the following information, so that `Acetate`s can
		 * allocate resources properly.
		 *
		 * `GleoSymbol`s can be thought as a collection of GL vertices (with attributes)
		 * and primitive slots (i.e. three vertex indices per triangle). A `GleoSymbol`
		 * must expose the amount of attribute and index slots needed, so that `Acetate`
		 * functionality can allocate space for attributes and for primitive indices.
		 *
		 * Note that `Dot`s and `AcetateDot`s ignore `idxBase` and `idxLength`, because
		 * they have no need for keeping track of how primitives must be drawn (because of
		 * the `POINTS` GL draw mode).
		 *
		 * @property attrBase: Number = undefined
		 * The (0-indexed) base offset for vertex attributes of this symbol. Set
		 * by `Acetate`. This is `undefined` until the `Acetate` allocates the
		 * GPU resources (vertices) for this symbol.
		 * @property idxBase: Number = undefined
		 * The (0-indexed) base offset for primitive slots of this symbol. Set
		 * by `AcetateVertices`. This is `undefined` until the `AcetateVertices`
		 * allocates the GPU resources (triangle primitive indices) for this symbol.
		 * @property attrLength: Number
		 * The amount of vertex attribute slots this symbol needs. Must be set by the symbol
		 * during construction time.
		 * @property idxLength: Number
		 * The amount of primitive slots this symbol needs. Must be set by the symbol
		 * during construction time.
		 *
		 * @property _id: Number
		 * The interactive ID of the symbol, to let `AcetateInteractive`
		 * functionality find it to dispatch pointer events.
		 */

		this.attrBase = undefined;
		this.idxBase = undefined;
		this.attrLength = undefined;
		this.idxLength = undefined;

		this.#allocationPromise = new Promise((res, _rej) => {
			this.#resolveAllocation = res;
		});
	}

	/**
	 * @section
	 * @property geometry: Geometry
	 * The symbol's (unprojected) geometry. Can be updated with a new `Geometry`
	 * or nested `Array`s of `Number`s.
	 * @property attribution: String; The symbol's attribution. Read-only.
	 * @property interactive: Boolean
	 * Whether the symbol should be interactive. Read-only.
	 * @property cursor: String
	 * The runtime value of the `cursor` option. Can only be updated when not
	 * being drawn.
	 */

	get attribution() {
		return this.#attribution;
	}
	get interactive() {
		return this.#interactive;
	}
	get cursor() {
		return this.#cursor;
	}
	set cursor(c) {
		if (this._inAcetate) {
			throw new Error(
				"Cannot update the `cursor` of a Symbol that is in an acetate. Remove it from the map first."
			);
		}
		this.#cursor = c;
	}

	get geometry() {
		return this.#geometry;
	}
	set geometry(geom) {
		this.#geometry = factory(geom);
	}

	// Compatibility alias
	get geom() {
		return this.geometry;
	}

	/**
	 * @section Static properties
	 * Any subclasses must implement the following static property.
	 * @property Acetate: Prototype of Acetate
	 * The `Acetate` prototype related to the symbol - the one that fits this class
	 * of symbol by default.
	 *
	 * This is implemented as a static property, i.e. a property of the `Dot` prototype,
	 * not of the `Dot` instances.
	 *
	 * This shall be used when adding a symbol to a map, in order
	 * to detect the default acetate it has to be added to.
	 */
	static Acetate = undefined;

	/**
	 * @section Lifecycle Methods
	 * @method addTo(map: GleoMap): this
	 * Adds this symbol to the map.
	 *
	 * The symbol will be added to the appropriate default acetate.
	 *
	 * @alternative
	 * @method addTo(acetate: Acetate): this
	 * Adds this symbol to the given `Acetate` (as long as the acetate fits the symbol).
	 *
	 * @alternative
	 * @method addTo(loader: AbstractSymbolGroup): this
	 * Adds this symbol to a `Loader` that accepts symbols.
	 */
	addTo(target) {
		const proto = this.constructor.Acetate;
		let acet, group;
		if (target instanceof proto) {
			acet = target;
		} else if (
			this.constructor.Acetate.PostAcetate &&
			target instanceof this.constructor.Acetate.PostAcetate
		) {
			acet = target.getAcetateOfClass(proto);
		} else if (target instanceof Platina) {
			acet = target.getAcetateOfClass(proto);
		} else if (target.platina instanceof Platina) {
			acet = target.platina.getAcetateOfClass(proto);
		} else if (target instanceof AbstractSymbolGroup) {
			group = target;
		}

		if (this._inAcetate) {
			if (acet === this._inAcetate) {
				return this;
			}
			throw new Error(
				`Could not add Symbol to ${target}, since symbol is already being drawn elsewhere.`
			);
		}
		if (acet) {
			acet.add(this);
		} else if (group) {
			group.add(this);
		} else {
			throw new Error(`Could not add Symbol to ${target}.`);
		}
		return this;
	}

	/**
	 * @method remove(): this
	 * Removes this symbol from its containing `Acetate` (and, therefore, from the
	 * containing `GleoMap`).
	 */
	remove() {
		if (!this._inAcetate) {
			throw new Error("Cannot remove Symbol: it's not being drawn already.");
		}
		this._inAcetate.remove(this);
		this._inAcetate = undefined;
		this.attrBase = undefined;
		this.idxBase = undefined;
		return this;
	}

	/**
	 * @method isActive(): Boolean
	 * Returns whether the symbol is "active": being drawn in any `Acetate`. In
	 * other words, it has correctly allocated all GPU resources needed for it
	 * to be drawn.
	 *
	 * Note that some symbols can take time to allocate their resources, so
	 * they can be "inactive" after they've been added to an acetate/platina/map.
	 * (e.g. `Sprite`s when they refer to an image from the network that hasn't
	 * finished loading)
	 *
	 * Note that this returns `true` for transparent or otherwise allocated yet
	 * invisible symbols.
	 */
	isActive() {
		return this._inAcetate && this.attrBase !== undefined;
	}

	/**
	 * @property allocation: Promise to Array of Number
	 * A `Promise` that resolves when the symbol has been allocated into an
	 * acetate (not just *added* to it). Before this promise resolves,
	 * the values of `attrBase` and `idxBase` are either `undefined` or
	 * not reliable.
	 */
	get allocation() {
		return this.#allocationPromise;
	}

	#resolveAllocation = function () {};
	#allocated = false;

	/**
	 * @section Acetate Interface
	 * @uninheritable
	 * @method updateRefs(ac: Acetate, atb: Number, idx: Number): this
	 * Internal usage only, called from a corresponding `Acetate`. Updates
	 * the acetate that this symbol is being currently drawn on, the base vertex
	 * attribute slot (`atb`), and the base vertex index slot (`idx`).
	 */
	updateRefs(ac, atb, idx) {
		this._inAcetate = ac;
		this.attrBase = atb;
		this.idxBase = idx;
		if (!this.#allocated && atb !== undefined && idx !== undefined) {
			// Symbol has just been allocated, resolve allocation promise
			this.#resolveAllocation([atb, idx]);
			this.#allocated = true;
		} else if (this.#allocated && (atb === undefined || idx === undefined)) {
			// Symbol has ust been deallocated, reset allocation promise
			this.#allocationPromise = new Promise((res, _rej) => {
				this.#resolveAllocation = res;
			});
			this.#allocated = false;
		}
		return this;
	}

	/**
	 * @method _setGlobalStrides(...): this
	 *
	 * OBSOLETE: use `_setGlobalStrides`/`_setGeometryStrides`/`_setPerPointStrides` instead.
	 *
	 * Should be implemented by subclasses. Acetates shall call this method
	 * with one `StridedTypedArray` per attribute, plus a `TypedArray` for the
	 * index buffer, plus any extra data they need.
	 *
	 * A symbol shall fill up values in the given strided arrays (based on
	 * the `attrBase` property) as well as in the typed array for the index
	 * buffer (based on the `idxBase` property).
	 *
	 *
	 * @method _setGlobalStrides(...): this
	 * Shall be implemented by subclasses. Acetates shall call this method
	 * with any number of `StridedTypedArray`s plus a `TypedArray` fir the
	 * index buffer, plus any extra data they need.
	 *
	 * The acetate shall call this method *once*, when the symbol is allocated.
	 *
	 * @method _setGeometryStrides(geom: Geometry, perPointStrides: Array of StridedArray, ...): this
	 * As `_setGlobalStrides`, but the acetate may call this whenever the
	 * geometry of the symbol changes. It receives the projected geometry and the
	 * per-point strides.
	 *
	 * This is needed for e.g. recalculation of line joins in `Stroke` (and
	 * updating the attribute buffer(s) where the line join data is in).
	 *
	 * @method _setPerPointStrides(n: Number, pointType: Symbol, vtx: Number, geom: Geometry, vtxCount: Number ...): this
	 * As `_setGlobalStrides`, but the acetate shall call this once per each
	 * point in the symbol's geometry.
	 *
	 * This method will receive the index of the point within the geometry
	 * (0-indexed), the type of point (whether the point is a line join, or
	 * line end, or a standalone point, or part of a mesh), the vertex index
	 * for this point, the amount of vertices spawned for that point,
	 * plus any strided arrays.
	 *
	 */

	// TODO: Consider having a _setGlobalStridesGeom, that shall run whenever
	// the geometry changes. Some attributes depend on the geometry (e.g.
	// the extrusion in `Stroke`), as do the indices of `Fill`.

	/**
	 * @section Pointer events
	 *
	 * All `GleoSymbol`s (set as `interactive`, and being drawn in an appropriate
	 * acetate) fire pointer events, in a way similar to how `HTMLElement`s fire
	 * [DOM `PointerEvent`s](https://developer.mozilla.org/docs/Web/API/Pointer_events).
	 *
	 * Gleo adds the `Geometry` corresponding to the pixel the event took place in.
	 *
	 * Most events are `GleoPointerEvent`s, but some browsers fire
	 * exclusively `MouseEvent`s for `click`/`auxclick`/`contextmenu`. In
	 * that case, expect a `GleoMouseEvent` instead.
	 *
	 * @event click: GleoPointerEvent
	 * Akin to the [DOM `click` event](https://developer.mozilla.org/docs/Web/API/Element/click_event)
	 * @event dblclick: GleoPointerEvent
	 * Akin to the [DOM `dblclick` event](https://developer.mozilla.org/docs/Web/API/Element/dblclick_event)
	 * @event auxclick: GleoPointerEvent
	 * Akin to the [DOM `auxclick` event](https://developer.mozilla.org/docs/Web/API/Element/auxclick_event)
	 * @event contextmenu: GleoPointerEvent
	 * Akin to the [DOM `contextmenu` event](https://developer.mozilla.org/docs/Web/API/Element/contextmenu_event)
	 * @event pointerover: GleoPointerEvent
	 * Akin to the [DOM `pointerover` event](https://developer.mozilla.org/docs/Web/API/HTMLElement/pointerover_event)
	 * @event pointerenter: GleoPointerEvent
	 * Akin to the [DOM `pointerenter` event](https://developer.mozilla.org/docs/Web/API/HTMLElement/pointerenter_event)
	 * @event pointerdown: GleoPointerEvent
	 * Akin to the [DOM `pointerdown` event](https://developer.mozilla.org/docs/Web/API/HTMLElement/pointerdown_event)
	 * @event pointermove: GleoPointerEvent
	 * Akin to the [DOM `pointermove` event](https://developer.mozilla.org/docs/Web/API/HTMLElement/pointermove_event)
	 * @event pointerup: GleoPointerEvent
	 * Akin to the [DOM `pointerup` event](https://developer.mozilla.org/docs/Web/API/HTMLElement/pointerup_event)
	 * @event pointercancel: GleoPointerEvent
	 * Akin to the [DOM `pointercancel` event](https://developer.mozilla.org/docs/Web/API/HTMLElement/pointercancel_event)
	 * @event pointerout: GleoPointerEvent
	 * Akin to the [DOM `pointerout` event](https://developer.mozilla.org/docs/Web/API/HTMLElement/pointerout_event)
	 * @event pointerleave: GleoPointerEvent
	 * Akin to the [DOM `pointerleave` event](https://developer.mozilla.org/docs/Web/API/HTMLElement/pointerleave_event)
	 */

	/**
	 * @section Pointer methods
	 * @method setPointerCapture(pointerId: Number): this
	 * Akin to [`Element.setPointerCapture()`](https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture)
	 * @method releasePointerCapture(pointerId: Number): this
	 * Akin to [`Element.releasePointerCapture()`](https://developer.mozilla.org/docs/Web/API/Element/releasePointerCapture)
	 */
	setPointerCapture(pointerId) {
		this._inAcetate?.setPointerCapture(pointerId, this);
		return this;
	}
	releasePointerCapture(pointerId) {
		this._inAcetate?.releasePointerCapture(pointerId);
	}

	/**
	 * @section
	 * @method debugDump(): Object
	 *
	 * Returns a verbose, human-understandable representation of the underlying
	 * WebGL data (vertex attributes and triangle primitives) for this symbol.
	 *
	 * This is an computationally expensive operation and should only be used for
	 * debugging purposes. Note that this functions just retuns a value, so make
	 * sure to `console.log()` or likewise.
	 */
	debugDump() {
		if (!this._inAcetate) {
			throw new Error(
				"Cannot dump debug info for symbol since it's not being drawn in any acetate"
			);
		}
		if (!this._inAcetate._program) {
			throw new Error(
				"Cannot dump debug info for symbol since it's being drawn on an acetate that has not yet linked its WebGL program"
			);
		}

		return {
			idxBase: this.idxBase,
			idxLength: this.idxLength,
			attrBase: this.attrBase,
			attrLength: this.attrLength,
			attrs: this._inAcetate._program.debugDumpAttributes(
				this.attrBase,
				this.attrLength
			),
			idxs: this._inAcetate._program._indexBuff._ramData.slice(
				this.idxBase,
				this.idxBase + this.idxLength
			),
		};
	}
}

/**
 * @class Acetate
 * @inherits Evented
 * @relationship associated ExpandBox
 *
 * The name `Acetate` refers to the nickname given to transparent foil sheets
 * used in old-school projectors.
 *
 * The end result for the user is a stack of acetates (after they pass through a
 * image composition keeping alpha, etc).
 *
 * In `Gleo`/`Glii` terms, an `Acetate` is a collection of:
 * - A `Framebuffer`
 *   - Including a `Texture` that can (and should/will) be used for composing
 * - A `WebGL1Program`
 * - An `AttributeSet`
 * - A `IndexBuffer`
 *
 * Typically, an `Acetate` will receive symbols, given as triangles together
 * with the neccesary vertex attributes, e.g.:
 * - triangulized polygons,
 * - extrudable line countours
 * - extrudable points
 *
 * Any given `Acetate` will draw symbols of the same "kind". Subclasses shall be
 * an acetate for solid-filled polygons, another for line contours, another for circles,
 * etc (as long as symbols of the same "kind" are to be rendered with the same
 * `WebGL1Program`).
 *
 */

class Acetate extends Evented {
	#framebuffer;
	// #depthAttachment;
	#outTexture;
	#glii;
	#zIndex;
	#attribution;

	// Whether this acetate should be redrawn
	#dirty = false;

	/**
	 * @constructor Acetate(target: GliiFactory, opts: Acetate Options)
	 * @alternative
	 * @constructor Acetate(target: Platina, opts: Acetate Options)
	 * @alternative
	 * @constructor Acetate(target: GleoMap, opts: Acetate Options)
	 */
	constructor(
		target,
		{
			/**
			 * @option queryable: Boolean = false
			 * If set to `true`, pointer events dispatched by this acetate will
			 * contain information about the colour of the underlying pixel. This
			 * can negatively impact performance.
			 */
			queryable = false,

			/**
			 * @option zIndex: Number = 0
			 * The relative position of this acetate in terms of compositing it
			 * with other acetates. Must be a 16-bit signed integer
			 * (an integer between -32786 and 32785).
			 */
			zIndex = 0,

			/**
			 * @option attribution: String = undefined
			 * The attribution for the acetate, if any. Attribution can be
			 * delegated to symbols or loaders.
			 */
			attribution = undefined,
		} = {}
	) {
		super();

		this.#zIndex = zIndex;
		this.#attribution = attribution;

		if ("glii" in target) {
			// First parameter is a Platina, a GleoMap, or an ScalarField
			this.#glii = target.glii;
			target.addAcetate(this);
		} else {
			this.#glii = target;
		}

		/**
		 * @property queryable: Boolean
		 * If set to `true`, pointer events dispathed by this acetate will
		 * contain information about the colour of the underlying pixel. This
		 * can negatively impact performance.
		 *
		 * Can be updated at runtime. The initial value is given by the
		 * homonymous option.
		 */
		this.queryable = queryable;

		/**
		 * @section Subclass interface
		 * @uninheritable
		 *
		 * These properties are meant for internal use of an `Acetate` subclass.
		 *
		 * @property _coords: SingleAttribute
		 * A Glii data structure holding `vec2`s, for vertex CRS coordinates.
		 */
		this._coords = new this.glii.SingleAttribute({
			size: 1,
			growFactor: 1.2,
			usage: this.glii.DYNAMIC_DRAW,
			glslType: "vec2",
			type: Float32Array,
		});

		// CRS that is being used.
		// This is automatically updated from `redraw()` calls.
		this._crs = undefined;

		// CRS that was previously used.
		// This is relevant for `.reproject()`/`.reprojectAll()` calls, to check
		// whether the reprojection is a CRS offset or a full-fledged reprojection
		// by comparing the names of the CRSs.
		this._oldCrs = undefined;

		// Expanding bounding box for the known `_coords`
		this.bbox = new ExpandBox();

		// An array of symbols known to this acetate. They are indexed by the base
		// *attribute* of each symbol.
		this._knownSymbols = [];

		// An instance of `Glii.MultiProgram`. Some subclasses of acetate will
		// implement several WebGL programs (notably, `AcetateInteractive`) and will
		// need to update their uniforms/attributes at once.
		this._programs = new this.glii.MultiProgram();

		// The loaders added directly to this acetate (care must be taken to
		// ensure that the symbols spawned by the loader match the acetate).
		this._loaders = new Set();

		// Stores attributions of contained symbols, to check for changes.
		this._attributions = new Set();
	}

	/**
	 * @section
	 * @property glii: GliiFactory
	 * The underlying Glii instance. Read-only.
	 */
	get glii() {
		return this.#glii;
	}

	get platina() {
		return this._platina ? this._platina : this._inAcetate?._platina;
	}

	/**
	 * @property attribution: String
	 * The attribution text for the acetate (for use with the `Attribution`
	 * control). Can not be updated (consider delegating attribution
	 * to symbols instead)
	 */
	get attribution() {
		return this.#attribution;
	}

	/**
	 * @section Static properties
	 * @property PostAcetate: undefined
	 * Static property (implemented in the `Acetate` class prototype, not the
	 * instances). For `Acetate`s that render RGBA8 textures, this is
	 * `undefined`. For acetates that render non-RGBA8 textures, this
	 * shall be an `Acetate` prototype that can post-process this into RGBA8.
	 */
	static get PostAcetate() {
		return undefined;
	}

	/**
	 * @section Subclass interface
	 * @uninheritable
	 *
	 * Subclasses of `Acetate` must provide/define the following methods:
	 *
	 * @method glProgramDefinition(): Object
	 * Returns a set of `WebGL1Program` options, that will be used to create the WebGL1
	 * program to be run at every refresh.
	 *
	 * Subclasses can rely on the parent class definition, and decorate it as needed.
	 *
	 * The shader code (for both the vertex and fragment shaders) must be split
	 * between `vertex`/`fragmentShaderSource` and `vertex`/`fragmentShaderMain`.
	 * Do not define `void main() {}` in the shader source; this is done automatically
	 * by wrapping `*ShaderMain`.
	 */
	glProgramDefinition() {
		// This GL program definition in the abstract acetate includes only stuff
		// common to *all* acetates.
		return {
			attributes: {
				aCoords: this._coords,
			},
			uniforms: {
				uTransformMatrix: "mat3",
			},
			vertexShaderSource: "",
			vertexShaderMain: "",
			fragmentShaderSource: "",
			fragmentShaderMain: "",
			target: this.#framebuffer,
		};
	}

	/**
	 * @section
	 * @method add(symbol: GleoSymbol): this
	 * Adds the given symbol to self. Typically this will imply a call to
	 * `allocate(symbol)`. However, for symbols with some async load (e.g. `Sprite`s
	 * and `ConformalRaster`s) the call to `allocate()` might happen at a later
	 * time.
	 */
	add(symbol) {
		if (symbol instanceof GleoSymbol) {
			return this.multiAdd([symbol]);
		} else {
			// Assume it's a loader, and has been called through `.addTo(acetate)`
			this._loaders.add(symbol);
		}
	}

	/**
	 * @method multiAdd(symbols: Array of GleoSymbol): this
	 * Add the given symbols to self (i.e. start drawing them).
	 *
	 * Since uploading data to the GPU is relatively costly, implementations
	 * should make an effort to pack all the symbols' data together, and
	 * make as few calls to the Glii buffers' `set()`/`multiSet()` methods.
	 *
	 * Subclasses must call the parent `multiAdd` to ensure firing the `symbolsadded`
	 * event.
	 */
	multiAdd(symbols) {
		symbols.forEach((sym) => {
			sym._inAcetate = this;
		});
		/**
		 * @event symbolsadded
		 * Fired whenever symbols are added to the acetate. Event details include
		 * such symbols.
		 */
		this.fire("symbolsadded", { symbols });
		return this;
	}

	/**
	 * @property symbols: Array of GleoSymbol
	 * The symbols being drawn on this acetate.
	 *
	 * This is a shallow copy of the internal structure holding the symbols, so
	 * any changes to it won't affect which symbols are being drawn. Read-only.
	 */
	get symbols() {
		return this._knownSymbols.filter((s) => !!s);
	}

	/**
	 * @method multiAdd(symbols: Array of GleoSymbol): this
	 * Add the given symbols to self (i.e. start drawing them).
	 *
	 * Since uploading data to the GPU is relatively costly, implementations
	 * should make an effort to pack all the symbols' data together, and
	 * make as few calls to the Glii buffers' `set()`/`multiSet()` methods.
	 *
	 * Subclasses must call the parent `multiAdd` to ensure firing the `symbolsadded`
	 * event.
	 */
	has(s) {
		return this._knownSymbols.includes(s) || this._loaders.has(s);
	}

	/**
	 * @section Subclass interface
	 * @method multiAllocate(symbols: Array of GleoSymbol): this
	 * Allocates GPU RAM for the symbol, and asks the symbol to fill up that
	 * slice of GPU RAM.
	 *
	 * Whenever possible, use `multiAllocate()` instead of multiple calls to `allocate()`.
	 * Adding *lots* of symbols in a loop might cause *lots* of WebGL calls, which
	 * will impact performance. By contrast, implementations of `allocate()` should be
	 * prepared to make as few WebGL calls as possible.
	 *
	 * Subclasses shall call `multiAllocate` from `multiAdd`, either synchronously
	 * or asynchronously.
	 */
	// Implemented in `AcetateVertices`, `AcetateDot` and `AcetateFill`, due
	// to needing different handling of dumping vertex data and triangle index
	// data.

	/**
	 * @section Subclass interface
	 * @uninheritable
	 *
	 * @method _getStridedArrays(maxVtx: Number, maxIdx: Number): undefined
	 * Must return a plain array with all the `StridedTypedArrays that a symbol
	 * might need, as well as any other (pseudo-)constants that the symbol's
	 * `_setGlobalStrides()` method might need.
	 *
	 * This must allocate memory for attributes and vertex indices, and so
	 * its parameters are the topmost vertex and index needed.
	 *
	 * @method _commitStridedArrays(baseVtx: Number, vtxCount: Number, baseIdx: Number, idxCount: Number): undefined
	 * Called when committing data to attribute buffers. The default commits
	 * data to `this._extrusions` and `this._attrs`, so there's no need to
	 * redefine this if only those attribute storages are used.
	 *
	 *
	 * @method _getGeometryStridedArrays()
	 * As `_getStridedArrays()`, but applies only to strided arrays that need to be
	 * updated whenever the geometry of a symbol changes.
	 *
	 * @method _commitGeometryStridedArrays()
	 * As per `_commitStridedArrays()`, but applies only to the strided arrays
	 * returned to `_getGeometryStridedArrays()`.
	 *
	 * @method _getPerPointStridedArrays()
	 * As `_getStridedArrays()`, but applies only to strided arrays that contain
	 * data that has to be updated on a per-geometry-point basis.
	 *
	 * @method _commitPerPointStridedArrays()
	 * As per `_commitStridedArrays()`, but applies only to the strided arrays
	 * returned to `_getPerPointStridedArrays()`.
	 *
	 * @method deallocate(symbol: GleoSymbol): this
	 * Deallocate resources for the given symbol (attributes, primitive indices).
	 * Since the primitive indices are deallocated, the symbol will not be drawn.
	 *
	 * Deallocating symbols involves *marking* their primitives as not being used,
	 * in the CPU side of things. Since there is no data to upload into GPU memory,
	 * implementations don't need to worry (much) about efficiency.
	 *
	 * Deallocation must also reset the references to the acetate, base vertex
	 * and base index to `undefined`.
	 *
	 * @method reprojectAll(): this
	 * Triggers a reprojection of all the coordinates of all vertices of all symbols in
	 * the acetate. Called when `this._crs` changes. `AcetateDot` and `AcetateVertices`
	 * provide implementations.
	 */
	reprojectAll() {
		this.bbox.reset();
		this.dirty = true;
		return this;
	}

	/**
	 * @method remove(symbol: GleoSymbol): this
	 * Removes the given symbol from self (stops drawning it)
	 */
	remove(symbol) {
		if (symbol instanceof GleoSymbol) {
			this.deallocate(symbol);

			this.fire("symbolsremoved", { symbols: [symbol] });
			this.dirty = true;
		} else {
			// Assume a Loader
			symbol.remove();
			this._loaders.delete(symbol);
		}

		return this;
	}

	/**
	 * @method multiRemove(symbols: Array of GleoSymbol): this
	 * Removes the given symbols from self (i.e. stops drawing it).
	 */
	multiRemove(symbols) {
		/// TODO: *should* clean up this.bbox
		/// Right now it only clears on CRS change
		/// TODO: Check for adjacent symbols in order to do
		/// less deallocation calls.

		// Mark all symbols as not belonging to any acetate. This is independent
		// of a symbol being allocated or not.
		// This also handles the edge case of adding and removing a symbol
		// (e.g. a `Sprite` that takes time to load due to network or text
		// rendering) before it has been allocated. An unallocated symbol
		// will have its `attrBase` as undefined, but needs to be marked
		// as not belonging to any acetate as well.
		symbols.forEach((s) => (s._inAcetate = undefined));

		// Filter out symbols with no `idxBase` or `attrBase` - these haven't
		// been fully loaded before being removed
		this.multiDeallocate(
			symbols.filter((s) => s.attrBase !== undefined && s.idxBase !== undefined)
		);

		/**
		 * @event symbolsremoved
		 * Fired whenever symbols are removed from the acetate. Event details include
		 * such symbols.
		 */
		this.fire("symbolsremoved", { symbols });
		this.dirty = true;
		return this;
	}

	/**
	 * @method empty(): this
	 * Removes all symbols currently in this acetate
	 */
	empty() {
		return this.multiRemove(this._knownSymbols);
	}

	/**
	 * @method destroy(): this
	 * Destroys all resources used by the acetate and detaches itself from the
	 * containing platina.
	 */
	destroy() {
		// No need to individually remove/deallocate symbols - just mark them
		// as not belonging to any acetate, and as unallocated.
		this._knownSymbols.forEach((s) => s.updateRefs(undefined, undefined, undefined));

		/// Subclasses that allocate extra resources (e.g. Stroke uses
		/// an extra attribute buffer) must destroy them as well.
		this._indices?.destroy();
		this._coords.destroy();
		this._attrs?.destroy();

		this._programs.destroy();

		const i = this.platina?._acetates.indexOf(this);
		if (i !== -1) {
			this.platina._acetates.splice(i, 1);
		}
		return this;
	}

	/**
	 * @section
	 * @method getColourAt(x: Number, y: Number): Array of Number
	 * Returns a 4-element array with the red, green, blue and alpha
	 * values of the pixel at the given coordinates.
	 * The coordinates are in CSS pixels, and relative to the upper-left
	 * corner of the acetate.
	 *
	 * Used internally during event handling, so that the event can provide
	 * the pixel colour at the coordinates of the pointer event.
	 *
	 * Returns `undefined` if the coordinates fall outside of the acetate.
	 */
	getColourAt(x, y) {
		if (!this.#framebuffer) {
			return undefined;
		}

		const h = this.#framebuffer.height;
		const w = this.#framebuffer.width;

		if (y < 0 || y > h || x < 0 || x > w) {
			return undefined;
		}
		const dpr = devicePixelRatio ?? 1;

		// Textures are inverted in the Y axis because WebGL shenanigans. I know.
		return this.#framebuffer.readPixels(dpr * x, h - dpr * y, 1, 1);
	}

	/**
	 * @section Internal Methods
	 * @uninheritable
	 * @method multiDeallocate(symbols: Array of GleoSymbol): this
	 * Deallocates all given symbols. Subclasses can (and should!)
	 * provide an alternative implementation that performs only
	 * one deallocation.
	 */
	multiDeallocate(symbols) {
		symbols.forEach(this.deallocate.bind(this));
		symbols.forEach((symbol) => {
			if (symbol.attrBase !== undefined) delete this._knownSymbols[symbol.attrBase];
		});

		// Check whether the array is composed of only empty slots
		// (this happens when delete()ing the last non-empty item)
		// The check is made via an iterator: the iterator won't run if there aren't
		// any non-empty items, even when the length of the array is non-zero
		if (!this._knownSymbols.some(() => true)) {
			// Reset the array so its length is zero (and acetates skip the draw calls)
			this._knownSymbols = [];
		}

		this.dirty = true;

		return this;
	}

	#programDef;

	/**
	 * @section Redrawing methods
	 *
	 * These methods control when the acetate updates its internal texture. They
	 * are meant to be called internally.
	 *
	 * @method resize(x: Number, y: Number): this
	 * Resizes the internal framebuffer to the given size (in device pixels).
	 */
	resize(x, y) {
		const glii = this.#glii;
		const opts = this.#programDef ?? (this.#programDef = this.glProgramDefinition());

		if (!this._inAcetate) {
			if (!this.#framebuffer) {
				//this.#outTexture && this.#outTexture.destroy();
				//this.#framebuffer && this.#framebuffer.destroy();
				this.#outTexture = new glii.Texture({
					format: glii.RGBA,
					internalFormat: glii.RGBA,
				});

				this.#framebuffer = new glii.FrameBuffer({
					color: [this.#outTexture],
					depth:
						opts.depth && opts.depth !== glii.NEVER
							? new glii.RenderBuffer({
									width: x,
									height: y,
									internalFormat:
										glii.gl instanceof WebGL2RenderingContext
											? glii.DEPTH_COMPONENT24
											: glii.DEPTH_COMPONENT16,
							  })
							: undefined,
					// stencil: renderbuffer,
					width: x,
					height: y,
				});
			} else {
				this.#framebuffer.resize(x, y);
			}
		} else {
			this.#framebuffer = this._inAcetate.framebuffer;
		}

		if (this._program) {
			this._program._target = this.#framebuffer;
		} else {
			opts.vertexShaderSource += opts.vertexShaderMain
				? `\nvoid main(){${opts.vertexShaderMain}}`
				: "";
			opts.fragmentShaderSource += opts.fragmentShaderMain
				? `\nvoid main(){${opts.fragmentShaderMain}}`
				: "";
			opts.target = this.#framebuffer;
			this._program = new glii.WebGL1Program(opts);
			this._programs.addProgram(this._program);
			/**
			 * @section
			 * @event programlinked: Event
			 * Fired when the GL program is ready (has been compiled and linked)
			 */
			this.dispatchEvent(new Event("programlinked"));
		}

		const depthClear =
			opts.depth === glii.LEQUAL || opts.depth === glii.LESS ? 1 : -1;

		this._clear =
			this.#outTexture &&
			new glii.WebGL1Clear({
				color: [255, 255, 255, 0],
				target: this.#framebuffer,
				// depth: 1,
				//depth: (this.zIndex << 15 )
				depth: depthClear,
			});

		this.dirty = true;
		return this;
	}

	/**
	 * @section Redrawing methods
	 * @method redraw(crs: BaseCRS, matrix: Array of Number, viewportBbox: ExpandBox): Boolean
	 * Low-level redraw of the `Acetate`.
	 *
	 * The passed `crs` ensures display in that CRS, since it's used to either
	 * - Check that all coordinate data in the `Acetate` is using that CRS, or
	 * - Reproject all coordinate data in the `Acetate` to match the CRS.
	 *
	 * The 9-element matrix is expected to be a 2D transformation matrix, which is
	 * then fed to the shader program as a `mat3`.
	 *
	 * Note that redrawing a single `Acetate` does **not** trigger a re-composition
	 * of all acetates, i.e. the redraw is not visible until re-composition happens.
	 *
	 * Returns `true` when the acetate has been redrawn, or `false` if a redraw
	 * is not deemed needed.
	 */
	redraw(crs, matrix, viewportBbox) {
		if (!this.dirty) {
			return false;
		}
		this.clear();
		this.#dirty = false;
		if (this._knownSymbols.length === 0) {
			return true;
		}

		if (this._crs !== crs) {
			this._oldCrs = this._crs || {};
			this._crs = crs;
			// console.log("Acetate ", this.constructor.name, "reprojecting data into CRS ", this._crs);
			this.bbox = new ExpandBox();

			/**
			 * @section Subclass interface
			 * @uninheritable
			 * Subclasses of `Acetate` must provide/define the following:
			 * @method reprojectAll(): undefined
			 * Must dump a new set of values to `this._coords`, based on the known
			 * set of symbols added to the acetate.
			 */
			this.reprojectAll();
		}

		let x1 = Math.ceil((viewportBbox.minX - this.bbox.maxX) / crs.wrapPeriodX);
		let x2 = Math.floor((viewportBbox.maxX - this.bbox.minX) / crs.wrapPeriodX);

		let y1 = Math.ceil((viewportBbox.minY - this.bbox.maxY) / crs.wrapPeriodY);
		let y2 = Math.floor((viewportBbox.maxY - this.bbox.minY) / crs.wrapPeriodY);

		// 		console.log(
		// 			"Drawing acetate", this.constructor.name,"; must check viewport wrapping. Data bounds/viewport:",
		// 			this.bbox,
		// 			viewportBbox
		// 		);
		// console.log("X-wrap:", x1, x2, "Y-wrap", y1, y2);

		if (!Number.isFinite(x1) || !Number.isFinite(x2)) {
			x1 = 0;
			x2 = 0;
		}
		if (!Number.isFinite(y1) || !Number.isFinite(y2)) {
			y1 = 0;
			y2 = 0;
		}

		if (x2 > x1 + 10) {
			console.warn(
				"Map repeats more than 10 times horizontally. Check your scale factor."
			);
			x2 = x1 + 10;
		}
		if (y2 > y1 + 10) {
			console.warn(
				"Map repeats more than 10 times horizontally. Check your scale factor."
			);
			y2 = y1 + 10;
		}

		// Transpose of the CRS matrix to apply `glmatrix` functionality.
		// Damn different notations.
		const origMatrix = transpose(new Array(9), matrix);

		// Copy of the map's crsMatrix, but without the translation. Will
		// be used for calculating the wrap offsets. Note glmatrix notation.
		// prettier-ignore
		const scaleRotationMatrix = [
			matrix[0], matrix[3], 0,
			matrix[1], matrix[4], 0,
			        0,         0, 1,
		];

		const offsetVector = new Array(3);
		const offsetMatrix = new Array(9);

		/// TODO: Leverage instanced rendering instead.
		/// TODO: Does setting a smaller viewport, or a scissor test,
		/// help performance in any way?
		for (let x = x1; x <= x2; x++) {
			for (let y = y1; y <= y2; y++) {
				let offsetX = crs.wrapPeriodX * x;
				let offsetY = crs.wrapPeriodY * y;

				if (!Number.isFinite(offsetX)) {
					offsetX = 0;
				}
				if (!Number.isFinite(offsetY)) {
					offsetY = 0;
				}

				offsetVector[0] = offsetX;
				offsetVector[1] = offsetY;
				offsetVector[2] = 0;
				transformMat3(offsetVector, offsetVector, scaleRotationMatrix);

				fromTranslation(offsetMatrix, offsetVector.slice(0, 2));
				multiply(offsetMatrix, offsetMatrix, origMatrix);

				transpose(offsetMatrix, offsetMatrix);

				this._programs.setUniform("uTransformMatrix", offsetMatrix);
				this.runProgram();
			}
		}
		return true;
	}

	/**
	 * @section Redrawing methods
	 *
	 * @method clear(): this
	 * Clears the acetate: sets all pixels to transparent black.
	 */
	clear() {
		this._clear?.run();
		return this;
	}

	/**
	 * @method rebuildShaderProgram(): this
	 * Deletes the current main WebGL shader program for the acetate, and
	 * replaces it with a freshly compiled one.
	 *
	 * This is meant for internal user of subclasses, whenever they need to update
	 * the shader, e.g. to change some of its constants.
	 */
	rebuildShaderProgram() {
		const opts = (this.#programDef = this.glProgramDefinition());

		opts.vertexShaderSource += opts.vertexShaderMain
			? `\nvoid main(){${opts.vertexShaderMain}}`
			: "";
		opts.fragmentShaderSource += opts.fragmentShaderMain
			? `\nvoid main(){${opts.fragmentShaderMain}}`
			: "";
		opts.target = this.#framebuffer;
		const newProgram = new this.glii.WebGL1Program(opts);
		this._programs.replaceProgram(this._program, newProgram);

		this._program = newProgram;
		this.dirty = true;

		this.dispatchEvent(new Event("programlinked"));
		return this;
	}

	/**
	 * @section Redrawing properties
	 * @property dirty: Boolean = false
	 * Whether this acetate should be rendered at the next frame. Can only be
	 * set to `true`; a call to `redraw()` will reset this to `false`.
	 */
	get dirty() {
		return this.#dirty;
	}
	set dirty(d) {
		this.#dirty ||= d;
		if (this._inAcetate) {
			this._inAcetate.dirty ||= d;
		}
	}

	/**
	 * @section Internal Methods
	 * @uninheritable
	 * Meant to be used only from `GleoMap`.
	 * @method asTexture(): Texture
	 * Returns a reference to the Glii `Texture` holding the visible results of this acetate.
	 */
	asTexture() {
		return this.#outTexture;
	}

	/**
	 * @method runProgram(): this
	 * Runs the GL program for this acetate. Might be overwritten by subclasses
	 * when partial runs are needed (e.g. to set per-symbol textures, or
	 * selecting a LoD).
	 */
	runProgram() {
		this._programs.run();
		return this;
	}

	/**
	 * @method multiSetCoords(start: Number, coordData: Array of Number): this
	 * Sets a section of the internal `_coords` `SingleAttributeBuffer`, and expands the
	 * bounding box of known coords to cover the new ones.
	 *
	 * The second `coordData` argument must be a *flattened* array of x-y coordinates,
	 * of the form `[x1, y1, x2, y2, x3, y3, .... xn, yn]`.
	 */
	multiSetCoords(start, coordData) {
		this._coords.multiSet(start, coordData);

		return this.expandBBox(coordData);
	}

	/**
	 * @method expandBBox(coordData: Array of Number): this
	 * Each acetate keeps a bounding box to keep track of the extents of drawable
	 * items (to calculate antimeridian repetition).
	 *
	 * This expects an argument in the form of `[x1, y1, x2, y2, x3, y3, .... xn, yn]`.
	 */
	expandBBox(coordData) {
		for (let i = 0, l = coordData.length; i < l; i += 2) {
			if (Number.isFinite(coordData[i]) && Number.isFinite(coordData[i + 1])) {
				this.bbox.expandXY(coordData[i], coordData[i + 1]);
			}
		}
		return this;
	}

	/**
	 * @method dispatchPointerEvent(ev:GleoPointerEvent): Boolean
	 * Stub for interactive acetate logic. Alias for `dispatchEvent`.
	 */
	dispatchPointerEvent(ev) {
		if (this.queryable) {
			// The current implementation will query the framebuffer/texture
			// when the expression is evaluated, which might be too late
			// specially if the event is logged into the console. The following
			// is the previous implementation, which is immediate but
			// potentially very wasteful.
			// See https://gitlab.com/IvanSanchez/gleo/-/issues/112
			// ev.colour = this.getColourAt(ev.canvasX, ev.canvasY);

			let colour;
			const getColour = function getColour() {
				if (colour) {
					return colour;
				}
				return (colour = this.getColourAt(ev.canvasX, ev.canvasY));
			}.bind(this);
			Object.defineProperty(ev, "colour", { get: getColour });
		}
		return this.dispatchEvent(ev);
	}

	/**
	 * @section Internal properties
	 * Meant to be used only from within a `Platina`.
	 * @property zIndex: Number; The value of the `zIndex` constructor option. Read-only.
	 */
	get zIndex() {
		return this.#zIndex;
	}

	/**
	 * @section Subclass interface
	 * @uninheritable
	 * @property framebuffer: Framebuffer
	 * The output Glii framebuffer for this acetate. Read-only.
	 */
	get framebuffer() {
		return this.#framebuffer;
	}
}

// import Glii from 'glii';

const { log2, abs, max } = Math;

const pointerEvents = [
	"click",
	"dblclick",
	"auxclick",
	"contextmenu",
	"pointerover",
	"pointerenter",
	"pointerdown",
	"pointermove",
	"pointerup",
	"pointercancel",
	"pointerout",
	"pointerleave",
	"gotpointercapture",
	"lostpointercapture",
];

/**
 * @class Platina
 *
 * @inherits Evented
 * @relationship compositionOf Acetate, 1..1, 0..n
 * @relationship compositionOf Loader, 1..1, 0..n
 * @relationship compositionOf BaseCRS, 0..n, 1..1
 *
 * @relationship associated GleoPointerEvent, 1..1, 0..n
 * @relationship associated ExpandBox, 1..1, 0..n
 * @relationship associated dom
 *
 * In printing, a "platen" (or "platine" or "platina") is the glass flatbed
 * of a photocopier or scanner where pages are laid down, and in an
 * overhead projector, it's the glass flatbed where an acetate sheet is laid down.
 *
 * In Gleo, a `Platina` is the `<canvas>` where the map is shown (without any
 * map controls). The platina has a state similar to a map (center/scale/etc), and
 * when it changes it tells all acetates to redraw themselves, then flattens
 * all acetates together.
 *
 * A `Platina` boils down to:
 * - A collection of `Acetate`s, stacked and composable
 * - A `<canvas>` and its related WebGL context
 * - A view, with:
 *   - CRS (`BaseCRS`)
 *   - Center (`Geometry`)
 *   - Scale factor
 *   - Yaw rotation angle
 *
 * A `Platina` can ve used standalone to draw `GleoSymbol`s in `Acetate`s, but
 * does not offer interactivity (e.g. map drag, mousewheel zoom, etc); that is
 * left to `Actuator`s in a `GleoMap`.
 */

class Platina extends Evented {
	#glii;
	#precisionThreshold;

	#crs;
	#yaw = 0;
	#center;
	#scale;
	#map;
	#canvas;
	#target;
	#backgroundColour;
	#renderLoop;

	#resizable;
	#boundOnPointerEvent;

	#boundRedraw;
	#boundMultiAdd;
	#boundMultiRemove;

	#invalidViewWarningTimeout;

	/**
	 * @constructor Platina(canvas: HTMLCanvasElement, options?: Platina Options)
	 * @alternative
	 * @constructor Platina(canvasID: string, options?: Platina Options)
	 */
	/// TODO: Allow a WebGLRenderingContext. This is problematic for
	/// the ResizeObserver and the DOM events.
	constructor(
		canvas,
		{
			/**
			 * @section Platina Options
			 * @option resizable: Boolean = true
			 * Whether the map should react to changes in the size of its DOM
			 * container. Setting to `false` enables some memory optimizations.
			 */
			resizable = true,
			/**
			 * @option backgroundColour: Colour = [0, 0, 0, 0]
			 * Self-explanatory. The default transparent black should work for
			 * most use cases.
			 * @alternative
			 * @option backgroundColour: null
			 * If the background is explicitly set to `null`, then it won't
			 * be cleared between redraws. This might trigger an "infinite mirror"
			 * artifact if the canvas is not otherwise cleared between redraws.
			 */
			backgroundColour = [0, 0, 0, 0],

			/**
			 * @option preserveDrawingBuffer: Boolean = false
			 * Whether the rendering context created from the canvas shall
			 * be able to be read back. See the `preserveDrawingBuffer` option
			 * of [`HTMLCanvasElement.getContext()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)
			 */
			preserveDrawingBuffer = false,

			/**
			 * @option precisionThreshold: Number = *
			 * The order of magnitude (in terms of significant bits, or base-2
			 * logarithm) that triggers a CRS offset.
			 *
			 * The default value depends on the floating point precision reported
			 * by the GPU, typically 22 (for GPUs which internally use `float32`)
			 * or 15 for older GPUs (which internally use `float24`).
			 *
			 * Raising this value may prevent spurious CRS offsets and *might*
			 * alleviate CRS-offset-related delays and artifacts, at the cost
			 * of possible precision artifacts. A value lower than the default
			 * has no positive effects.
			 */
			precisionThreshold = undefined,

			/**
			 * @option renderLoop: Boolean = true
			 * Enable/disable frame-by-frame renderloop. The default is to
			 * trigger a redraw call on every render frame. Disable this when
			 * manually trigering redraw calls.
			 */
			renderLoop = true,

			// Hidden option. Only used within GleoMap, and meant to let
			// symbols & acetates know what GleoMap instance they belong to,
			// if any.
			map = undefined,

			...options
		} = {}
	) {
		super();

		this.options = options;
		this.#backgroundColour = backgroundColour;

		this.#target =
			typeof canvas === "string" ? document.getElementById(canvas) : canvas;

		this.#map = map;

		const glii = (this.#glii = new GliiFactory(this.#target, {
			//premultipliedAlpha: false,
			// premultipliedAlpha: true,
			depth: true,
			preserveDrawingBuffer,
			alpha: true,
		}));

		// Possibly extract the canvas from a WebGLRenderingContext, fall back to
		// "we have been given a canvas"
		this.#canvas = this.#target?.canvas ?? this.#target;

		if (!glii) {
			throw new Error(
				"No WebGL context: wrong canvas, or no WebGL support on this browser."
			);
		}

		this.#resizable = resizable;
		if (resizable) {
			glii.addEventListener("resized", this.#onResize.bind(this));
		}

		const gl = glii.gl;

		if (precisionThreshold) {
			this.#precisionThreshold = precisionThreshold;
		} else {
			this.#precisionThreshold =
				gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT).precision -
				1;
		}

		this._acetates = [];
		// Prepare data structs for acetate quads:
		// - Triangle indices (two per quad)
		// - Texture corners and z-index (as *static* attributes)
		// - CRS coords (as dynamic attributes)
		this._acetateQuads = new glii.TriangleIndices({
			size: 6,
			growFactor: 1,
		});
		this._acetateAttrs = new glii.InterleavedAttributes(
			{
				size: 4,
				growFactor: 1,
				usage: glii.STATIC_DRAW,
			},
			[
				{
					// z-index
					glslType: "float",
					type: Int16Array,
					normalized: true,
				},
				{
					// Texture coords
					glslType: "vec2",
					type: Int8Array,
				},
			]
		);
		this._acetateCoords = new glii.SingleAttribute({
			size: 4,
			growFactor: 1,
			usage: glii.DYNAMIC_DRAW,
			glslType: "vec2",
			type: Float32Array,
		});

		this._bbox = new ExpandBox();
		this.#onResize();

		this.rebuildCompositor();

		// Hook up event decorators
		/**
		 * @section Pointer events
		 *
		 * All [DOM `PointerEvent`s](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
		 * to a platina's `<canvas>` are handled by Gleo.
		 * Besides all of `PointerEvent`'s properties and methods, Gleo adds
		 * the `Geometry` corresponding to the pixel the event took place in.
		 *
		 * Most events are `GleoPointerEvent`s, but some browsers fire
		 * exclusively `MouseEvent`s for `click`/`auxclick`/`contextmenu`. In
		 * that case, expect a `GleoMouseEvent` instead.
		 *
		 * @event click: GleoPointerEvent
		 * Akin to the [DOM `click` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event)
		 * @event dblclick: GleoPointerEvent
		 * Akin to the [DOM `dblclick` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event)
		 * @event auxclick: GleoPointerEvent
		 * Akin to the [DOM `auxclick` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/auxclick_event)
		 * @event contextmenu: GleoPointerEvent
		 * Akin to the [DOM `contextmenu` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event)
		 * @event pointerover: GleoPointerEvent
		 * Akin to the [DOM `pointerover` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerover_event)
		 * @event pointerenter: GleoPointerEvent
		 * Akin to the [DOM `pointerenter` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerenter_event)
		 * @event pointerdown: GleoPointerEvent
		 * Akin to the [DOM `pointerdown` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerdown_event)
		 * @event pointermove: GleoPointerEvent
		 * Akin to the [DOM `pointermove` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointermove_event)
		 * @event pointerup: GleoPointerEvent
		 * Akin to the [DOM `pointerup` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerup_event)
		 * @event pointercancel: GleoPointerEvent
		 * Akin to the [DOM `pointercancel` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointercancel_event)
		 * @event pointerout: GleoPointerEvent
		 * Akin to the [DOM `pointerout` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerout_event)
		 * @event pointerleave: GleoPointerEvent
		 * Akin to the [DOM `pointerleave` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerleave_event)
		 * @event gotpointercapture: GleoPointerEvent
		 * Akin to the [DOM `gotpointercapture` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/gotpointercapture_event)
		 * @event lostpointercapture: GleoPointerEvent
		 * Akin to the [DOM `lostpointercapture` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/lostpointercapture_event)
		 */
		this.#boundOnPointerEvent = this._onPointerEvent.bind(this);
		for (let evName of pointerEvents) {
			this.#canvas.addEventListener(evName, this.#boundOnPointerEvent);
		}

		/**
		 * @section View initialization Options
		 *
		 * A `Platina` can take a set of [`SetView` options](#setview-options),
		 * just as the ones for a `setView` call.
		 *
		 * @option crs: BaseCRS = undefined
		 * Initial CRS of the platina.
		 * @option yawDegrees: Number = 0
		 * Initial yaw rotation of the platina, in clockwise degrees.
		 * @option yawRadians: Number = 0
		 * Initial yaw rotation of the platina, in counter-clockwise radians.
		 * @option center: Geometry = undefined
		 * Initial center of the platina.
		 * @option scale: Number = undefined
		 * Initial scale of the platina, in CRS units per CSS pixel.
		 * @option span: Number = undefined
		 * Initial span of the platina, in CRS units per diagonal.
		 */
		this.setView(options);

		this.#boundRedraw = this.redraw.bind(this);
		this.#boundMultiAdd = (ev) => {
			this.multiAdd(ev.detail.symbols);
		};
		this.#boundMultiRemove = (ev) => {
			this.multiRemove(ev.detail.symbols);
		};

		// Start the main render loop
		this.#renderLoop = renderLoop;
		if (renderLoop) {
			this.#queueRedraw();
		}

		// Queue a console warning message, for developers who forget to set the
		// platina's center/scale/CRS. 5 seconds should be a nice time.
		if (typeof window !== "undefined") {
			this.#invalidViewWarningTimeout = setTimeout(() => {
				console.warn("platina does not have crs+center+scale");
			}, 5000);
		}
	}

	/**
	 * @section
	 * @method destroy(): this
	 * Destroys the platina, freeing the rendering context. Should free all
	 * used GPU resources.
	 *
	 * No methods should be called on a destroyed platina.
	 */
	destroy() {
		cancelAnimationFrame(this.#animFrame);

		this._clear.run();

		this._acetateQuads.destroy();
		this._acetateAttrs.destroy();
		this._acetateCoords.destroy();
		this._compositor.destroy();

		this._acetates.forEach((ac) => ac.destroy());

		for (let evName of pointerEvents) {
			this.#canvas.removeEventListener(evName, this.#boundOnPointerEvent);
		}

		this.#canvas = undefined;
	}

	/**
	 * @section DOM properties
	 * @property canvas: HTMLCanvasElement
	 * The `<canvas>` element this platina is attached to. Read-only.
	 */
	get canvas() {
		return this.#canvas;
	}

	/**
	 * @section Internal methods
	 * @method addAcetate(ac: Acetate): this
	 * Adds a new `Acetate` to the map.
	 *
	 * There's no need to call this manually - acetates will be added to a
	 * `Platina` (or `GleoMap`) automatically then they're instantiated. Do
	 * remember to pass the `Platina` as the first parameter to the `Acetate`
	 * constructor.
	 */
	addAcetate(acetate) {
		if (this._acetates.includes(acetate)) {
			return;
		}

		// The resize() initialization of an acetate is delayed with a
		// setTimeout() because:
		// - This is called during the base acetate constructor
		// - Acetate subclass code can initialize stuff they need *after*
		//   this call
		// - Calling resize() without all data structures ready will throw errors
		// - Here is the place which causes the least distress
		// (Ideally this would use `setImmediate()` instead, if browsers had it).
		this.once("prerender", () => {
			const dpr = devicePixelRatio ?? 1;
			acetate.resize(
				this._pxWidth * dpr,
				this._pxHeight * dpr,
				this._pxWidth,
				this._pxHeight
			);
		});

		if (
			acetate.constructor.PostAcetate === undefined ||
			acetate.constructor.PostAcetate === Acetate
		) {
			/// RGBA acetate, add directly to self
			const zIndex = acetate.zIndex;
			let i = this._acetates.length * 4;
			let quad = new this._acetateQuads.Quad();
			quad.setVertices(i, i + 1, i + 2, i + 3);
			this._acetateAttrs.setFields(i, [[zIndex], [0, 0]]);
			this._acetateAttrs.setFields(i + 1, [[zIndex], [0, 1]]);
			this._acetateAttrs.setFields(i + 2, [[zIndex], [1, 1]]);
			this._acetateAttrs.setFields(i + 3, [[zIndex], [1, 0]]);

			this._acetates.push(acetate);
			/// TODO: Leftover initialization of acetates - fetch its `Texture`, maybe more?
			/// TODO: Match the acetate with its index, explicitly?
			/// TODO: Allow for RGBA acetates to not be bound to the Platina's
			/// render loop (when they're meant to be post-processed by another
			/// acetate)

			this._acetates.sort((a, b) => a.zIndex - b.zIndex);
		} else {
			// Search for a scalar field acetate (or similar) that can hold
			// this acetate.
			// console.warn("Non-RGBA8 acetate");

			let fitScalarField = this._acetates.filter(
				(candidate) => candidate instanceof acetate.constructor.PostAcetate
			)[0];

			if (fitScalarField) {
				fitScalarField.addAcetate(acetate);
			} else {
				new acetate.constructor.PostAcetate(this).addAcetate(acetate);
			}
		}

		acetate._map = acetate._platina = this;

		/// TODO: Save i,quad into acetate
		/// TODO: Method for removing an acetate (dealloc attribs from
		/// i, triangles from quad)

		/**
		 * @section Symbol/loader management events
		 * @event acetateadded
		 * Fired whenever an `Acetate` is added to the platina.
		 * @event symbolsadded
		 * Fired whenever symbols are added to any of the platina's acetates.
		 * @event symbolsremoved
		 * Fired whenever symbols are removed from any of th platina's acetates.
		 */
		this.fire("acetateadded", acetate);
		acetate.on("symbolsadded", (ev) => {
			this.fire("symbolsadded", ev.detail);
		});
		acetate.on("symbolsremoved", (ev) => {
			this.fire("symbolsremoved", ev.detail);
		});

		// this.#queueRedraw();
		return this;
	}

	/**
	 * @section
	 * @method getAcetateOfClass(proto: Prototype of Acetate): Acetate
	 * Given a specific `Acetate` class (e.g. `getAcetateOfClass(Sprite.Acetate)`),
	 * returns an acetate instance where that kind of symbol can be drawn.
	 * Will create an acetate of the given class if it doesn't exist in the map yet.
	 */
	getAcetateOfClass(acetateClass) {
		function recurse(ac) {
			return ac.subAcetates ? [ac, ...ac.subAcetates.map(recurse).flat()] : [ac];
		}
		let allAcetates = Array.from(this._acetates, recurse).flat();

		let ac = allAcetates.find(
			(a) => Object.getPrototypeOf(a).constructor === acetateClass
		);
		if (ac) {
			return ac;
		}

		ac = new acetateClass(this.#glii);
		this.addAcetate(ac);
		return ac;
	}

	#animFrame;

	#queueRedraw() {
		this.#animFrame ?? cancelAnimationFrame(this.#animFrame);

		if (this.#renderLoop) {
			this.#animFrame = requestAnimationFrame(this.#boundRedraw);
		}
		return this;
	}

	/**
	 * @method redraw(): this
	 * Redraws acetates that need to do so, and composes them together.
	 *
	 * There is no need to call this manually, since it will be called once per
	 * animation frame.
	 */
	redraw(timestamp) {
		if (!this.#canvas) {
			// Do not redraw if the platina has already been destroyed. Do not queue redraw.
			return;
		}

		if (!timestamp) {
			// This function is usually called with a timestamp, meaning
			// it's been called from a requestAnimationFrame().
			// If that's not the case, cancel anim frame to prevent race
			// conditions (queuing more than one call per frame)
			cancelAnimationFrame(this.#animFrame);
		}

		if (!this._bbox || !this._crsMatrix) {
			return this.#queueRedraw();
		}

		let updatedAcetates = 0;

		this.#glii.refreshDrawingBufferSize();

		/**
		 * @section Rendering events
		 * @event prerender
		 * Fired prior to performing a render (rendering `Acetate`s plus compositing them).
		 * Can be used to set the map's viewport during animations (as long as there's
		 * only one animation logic running).
		 */
		this.dispatchEvent(new Event("prerender"));

		/// Trigger a full redraw of all acetates
		/// TODO: Do not redraw all acetates all the times; limit one acetate per frame,
		/// and rely on the acetate quads and compositor.
		this._acetates.forEach((ac, i) => {
			if (ac.dirty && ac.redraw(this.#crs, this._crsMatrix, this._bbox)) {
				// Reset the CRS coordinates of the just-redrawn quad for this
				// acetate. This assumes the indices of those quads don't change.
				this._acetateCoords.multiSet(i * 4, this._viewportCorners);

				updatedAcetates++;
			}
		});

		if (updatedAcetates === 0) {
			return this.#queueRedraw();
		}

		// Compose all acetates.
		// Compositor uses a depth buffer, so acetates are composed in their given z-indexes.
		/// FIXME: That's not true. Debug, debug, debug.
		if (this.backgroundColour !== null) {
			this._clear.run();
		}
		this._compositor.setUniform("uTransformMatrix", this._crsMatrix);
		this._acetates.forEach((ac, i) => {
			// The compositor has to run once per acetate due to the
			// inability to choose a texture in the frag shader.
			// (Ideally composition should be just one draw call,
			// and z-composition would be done via the z coordinate of fragments)

			this._compositor.setTexture("uAcetateTex", ac.asTexture());
			this._compositor.runPartial(i * 6, 6);
		});

		/**
		 * @event render
		 * Fired just after performing a render (rendering `Acetate`s plus compositing them).
		 */
		this.dispatchEvent(new Event("render"));
		return this.#queueRedraw();
	}

	/**
	 * @section Internal methods
	 *
	 * @method rebuildCompositor()
	 * Rebuilds the WebGL program in charge of compositing the acetates.
	 *
	 * Should only be needed to run once.
	 *
	 * The compositor just dumps *one* texture from *one* acetate into the default renderbuffer
	 * (i.e. the target `<canvas>`). The "clear", then "bind texture"-"dump acetate" logic is
	 * implemented elsewhere.
	 *
	 */
	rebuildCompositor() {
		/// TODO: Somehow set the texture unit as a vertex attribute
		/// and have the frag shader map it to integer, choose the
		/// texture unit from there.
		/// https://stackoverflow.com/questions/51506704/webgl-pass-texture-from-vertex-shader-to-fragment-shader
		/// https://stackoverflow.com/questions/19592850/how-to-bind-an-array-of-textures-to-a-webgl-shader-uniform
		/// TODO: Handle the case of limited texture units!! (if a multi-texture
		/// compositor is viable)

		const glii = this.#glii;

		this._compositor = new glii.WebGL1Program({
			attributes: {
				aZIndex: this._acetateAttrs.getBindableAttribute(0),
				aUV: this._acetateAttrs.getBindableAttribute(1),
				aCoords: this._acetateCoords,
			},
			uniforms: { uTransformMatrix: "mat3" },
			textures: {
				// uAccumulator: this._accumulatorTexture,
				uAcetateTex: undefined,
			},
			vertexShaderSource: /* glsl */ `
				void main() {
					gl_Position = vec4(
						(vec3(aCoords, 1.0) * uTransformMatrix).xy,
						aZIndex + 0.5,
						1.0
					);
					vUV = aUV;
				}
			`,
			varyings: { vUV: "vec2" },
			fragmentShaderSource: /* glsl */ `
				void main() {
					// gl_FragColor = texture2D(uAcetateTex, vUV);
					vec4 texel = texture2D(uAcetateTex, vUV);
					//if (texel.a > 0.0) {
					gl_FragColor = texel;
					//}
					//gl_FragColor.r += gl_FragCoord.z;
				}
			`,
			indexBuffer: this._acetateQuads,
			depth: this.#glii.LOWER,
			blend: {
				equationRGB: glii.FUNC_ADD,
				equationAlpha: glii.FUNC_ADD,

				srcRGB: glii.SRC_ALPHA,
				dstRGB: glii.ONE_MINUS_SRC_ALPHA,
				srcAlpha: glii.ONE,
				dstAlpha: glii.ONE_MINUS_SRC_ALPHA,
			},
		});

		this.backgroundColour = this.#backgroundColour;
	}

	/**
	 * @section View setters
	 * @method setView(opts: SetView Options): this
	 *
	 * (Re-)sets the platina view to the given center/crs, scale, and yaw.
	 *
	 * Can trigger a redraw. Changes to the view state (center/crs/scale/yaw)
	 * are atomic.
	 */
	setView({
		/**
		 * @miniclass SetView Options (Platina)
		 * @section
		 * Calls to the `setView` method (of `GleoMap` and `Platina`) take an object
		 * with any of the following properties. e.g.:
		 *
		 * ```
		 * map.setView({ center: [ 100, 10 ], redraw: false });
		 * map.setView({ scale: 1500, yawDegrees: 90 });
		 * ```
		 *
		 * @option center: RawGeometry = undefined
		 * The desired map center, as an instantiated `RawGeometry`/`Geometry`.
		 * @alternative
		 * @option center: Array of Number = undefined
		 * The desired map center, as an `Array` of `Number`s. They will be
		 * converted into a `Geometry` by means of `DefaultGeometry`.
		 *
		 * @option scale: Number = undefined
		 * The desired map scale (**in CRS units per CSS pixel**). Mutually exclusive
		 * with `span`.
		 *
		 * @option span: Number = undefined
		 * The desired span of the map (in **CRS units** on the **diagonal of the viewport**).
		 * Mutually exclusive with `scale`.
		 *
		 * @option yawDegrees: Number = 0
		 * The desired yaw rotation, in degrees relative to "north up", clockwise.
		 * Mutually exclusive with `yawRadians`.
		 *
		 * @option yawRadians: Number = 0
		 * The desired yaw rotation, in radians relative to "north up", counterclockwise.
		 * Mutually exclusive with `yawDegrees`.
		 *
		 * @option crs: BaseCRS = undefined
		 * The desired CRS of the map.
		 **/
		center,
		crs,
		scale,
		span,
		yawDegrees,
		yawRadians,
	} = {}) {
		const [w, h] = this.pxSize;

		if (span && !scale) {
			/// TODO: Set some kind of flag, so that resizing the canvas
			/// will keep either the span or the scale.
			scale = span / Math.sqrt(w * w + h * h);
		}

		if (crs && crs !== this.#crs) {
			/**
			 * @class Platina
			 * @section View change events
			 * @event crschange
			 * Dispatched when the CRS changes explicitly (by setting the platina's
			 * CRS, or passing a `crs` option to a `setView` call)
			 */
			this.fire("crschange", {
				oldCRS: this.#crs,
				newCRS: crs,
			});
		}

		//const prevCRS = this.#crs;
		this.#crs = crs || this.#crs;
		this.#center = center ? factory(center) : this.#center;
		this.#scale = scale || this.#scale;

		// If platina is not fully initialized (crs + center + zoom),
		// fail silently
		if (
			this.#crs === undefined ||
			this.#center === undefined ||
			this.#scale === undefined
		) {
			return this;
		} else if (this.#invalidViewWarningTimeout) {
			clearTimeout(this.#invalidViewWarningTimeout);
			this.#invalidViewWarningTimeout = undefined;
		}

		if (yawRadians !== undefined) {
			this.#yaw = yawRadians;
		} else if (yawDegrees !== undefined) {
			this.#yaw = -yawDegrees * (Math.PI / 180);
		}

		if (this.#center.crs !== this.#crs) {
			this.#center = this.#center.toCRS(this.#crs);
		}

		if (!isFinite(this.#scale)) {
			throw new Error("Scale must have a finite value");
		}
		if (this.#scale <= 0) {
			throw new Error("Scale must be a positive number");
		}

		// Cover edge cases where the center is very near to the CRS's
		// wrapping period.
		// 		center.xy[0] %= this.#crs.wrapPeriodX;
		// 		center.xy[1] %= this.#crs.wrapPeriodY;
		this.#center.coords = this.crs.wrap(this.#center.coords, [0, 0]);

		if (isNaN(this.#center.coords[0]) || isNaN(this.#center.coords[1])) {
			throw new Error("New center must be finite numbers");
		}

		/// Check if the center Coord can be represented with enough
		/// precision in its own CRS; as well as whether a coordinate
		/// one pixel away is still within precision ("the floating point
		/// precision is smaller than the coordinate delta between two
		/// adjacent pixels").
		/// If not, create a `OffsetCRS`.

		const log2scale = log2(this.#scale);
		const log2size = log2(max(h, w));
		const log2distance = log2(
			max(abs(this.#center.coords[0]), abs(this.#center.coords[1]))
		);

		if (
			Number.isFinite(log2distance) &&
			log2distance - log2scale /*+ log2size*/ > this.#precisionThreshold
		) {
			console.warn(
				"Requested CRS center and scale would cause floating point artifacts. An offset CRS shall be created."
			);
			console.log(
				"scale/size/center log2 / threshold",
				log2scale,
				log2size,
				log2distance,
				this.#precisionThreshold
			);

			// The new CRS offset is *absolute* to the base CRS, not relative to it.
			let newOffset = this.#crs.offsetToBase(this.#center.coords);

			const newCRS = new OffsetCRS(new Geometry(this.#crs, newOffset));

			/**
			 * @event crsoffset
			 * Dispatched when the CRS undergoes an implicit offset to avoid precision loss.
			 */
			this.fire("crsoffset", {
				oldCRS: this.#crs,
				newCRS: newCRS,
				offset: newOffset,
			});

			this.#crs = newCRS;
			this.#center = new Geometry(this.#crs, [0, 0]);
		}

		// console.log("Centers; ", center.xy, center.toCRS(epsg4326).xy, log2distance);

		let [cX, cY] = this.#center.coords;

		// Raster pixel fidelity, assuming raster coordinates are always aligned
		// to the [0,0] origin of CRS coordinates.
		// FIXME: Implement raster fidelity scales, and adjust to them instead
		// to always trusting the current scale.
		// TODO: Fidelity should also work on 90-degree rotations.
		if (this.#yaw > -1e-10 && this.#yaw < 1e-10) {
			const [crsOffsetX, crsOffsetY] = this.#crs.offset ? this.#crs.offset : [0, 0];
			cX = cX - (cX % this.#scale) - (crsOffsetX % this.#scale);
			if (w % 2) {
				cX += this.#scale / 2;
			}

			cY = cY - (cY % this.#scale) - (crsOffsetY % this.#scale);
			if (h % 2) {
				cY += this.#scale / 2;
			}
		}

		const sX = 2 / (w * this.#scale);
		const sY = 2 / (h * this.#scale);

		/// Yaw rotation
		const cosYaw = Math.cos(this.#yaw);
		const sinYaw = Math.sin(this.#yaw);

		// Scale, translate, rotate around point
		// See https://www.wolframalpha.com/input/?i2d=true&i=Composition%5C%2840%29+ScalingTransform%5C%2891%29%5C%2840%29%CF%87%5C%2844%29%CF%88%5C%2841%29%5C%2893%29%5C%2844%29+TranslationTransform%5C%2891%29%7B-x%2C-y%7D%5C%2893%29%5C%2844%29+RotationTransform%5C%2891%29alpha%5C%2844%29+%7Bx%2Cy%7D%5C%2893%29%5C%2841%29
		// prettier-ignore
		this._crsMatrix = [
			sX * cosYaw, -sX * sinYaw,  sX * cY * sinYaw - sX * cX * cosYaw,
			sY * sinYaw,  sY * cosYaw, -sY * cY * cosYaw - sY * cX * sinYaw,
			          0,            0,                                    1,
		];

		// Strip the offset from the CRS matrix. Used for the drag actuator and
		// the acetate wrapping.
		// prettier-ignore
		this._rotationScaleMatrix = [
			this._crsMatrix[0], this._crsMatrix[1], 0,
			this._crsMatrix[3], this._crsMatrix[4], 0,
			                 0,                  0, 1,
		];

		// Cache the boundaries of the visible bounds. This will be used for
		// re-setting the acetate's vertex coordinates.
		const invMatrix = invert(new Array(9), this._crsMatrix);

		// Damn glmatrix notation difference, again.
		transpose(invMatrix, invMatrix);

		const vec = [];
		this._bbox.reset();

		// prettier-ignore
		const corners = [
			[-1, -1, 1],
			[-1,  1, 1],
			[ 1,  1, 1],
			[ 1, -1, 1],
		].map(corner => transformMat3(vec, corner, invMatrix).slice(0,2));

		corners.forEach((corner) => this._bbox.expandPair(corner));
		this._viewportCorners = corners.flat();

		/**
		 * @event viewchanged
		 * Fired whenever the viewport changes - center, scale or yaw.
		 *
		 * Details inclide the center, scale, and the affine matrix for converting
		 * CRS coordinates into clipspace coordinates.
		 *
		 * This event might fire at every frame during interactions and animations.
		 */
		this.fire("viewchanged", {
			center: this.#center,
			scale: this.#scale,
			matrix: this._crsMatrix,
		});

		this._acetates.forEach((ac) => (ac.dirty = true));

		return this;
	}

	/**
	 * @section View setters
	 * @method fitBounds(bounds: Array of Number, opts?: SetView Options): this
	 * Sets the platina's center and scale so that the given bounds (given in
	 * `[minX, minY, maxX, maxY]` form, and in the platina's CRS) are fully
	 * visible.
	 *
	 * Any other given `SetView Options` will be merged with the calculated center&scale.
	 * @alternative
	 * @method fitBounds(bounds: ExpandBox, opts?: SetView Options): this
	 * Idem, but using an `ExpandBox` instead.
	 * @alternative
	 * @method fitBounds(bounds: RawGeometry, opts?: SetView Options): this
	 * Idem, but fitting to the bbox of a `Geometry` instead.
	 *
	 * This performs an implicit reprojection, so that it works as expected
	 * then the geometry's CRS is different than the platina's CRS.
	 */
	fitBounds(bounds, opts = {}) {
		/// FIXME: Currently sets the yaw to zero. Instead it should respect it.
		let minX, minY, maxX, maxY;
		if (bounds instanceof ExpandBox) {
			({ minX, minY, maxX, maxY } = bounds);
		} else if (bounds instanceof RawGeometry) {
			({ minX, minY, maxX, maxY } = bounds.toCRS(this.crs).bbox());
		} else {
			[minX, minY, maxX, maxY] = bounds;
		}

		const [w, h] = this.pxSize;

		const center = new Geometry(this.crs, [(minX + maxX) / 2, (minY + maxY) / 2]);
		const scale = Math.max((maxX - minX) / w, (maxY - minY) / h);
		return this.setView({
			...opts,
			center: center,
			scale: scale,
			yaw: 0,
		});
	}

	/**
	 * @method zoomInto(geometry: Geometry, scale: Number, opts?: SetView Options): this
	 * Performs a `setView` operation so that the given geometry stays at the
	 * same pixel.
	 *
	 * Meant for user interactions on the map, including double-clicking and
	 * zooming into clusters from a `Clusterer`. Akin to Leaflet's `zoomAround`.
	 */
	zoomInto(geometry, scale, opts = {}) {
		const [canvasX, canvasY] = this.geomToPx(factory(geometry));
		const [w, h] = this.pxSize;
		let clipX = (canvasX * 2) / w - 1;
		let clipY = (canvasY * -2) / h + 1;

		const scaleFactor = scale / this.scale;

		clipX -= clipX * scaleFactor;
		clipY -= clipY * scaleFactor;

		const vec = [clipX, clipY, 1];
		const invMatrix = invert(new Array(9), this._crsMatrix);
		transpose(invMatrix, invMatrix);
		transformMat3(vec, vec, invMatrix);

		const targetCenter = new Geometry(this.crs, [vec[0], vec[1]], { wrap: false });

		return this.setView({ ...opts, center: targetCenter, scale: scale });
	}

	/**
	 * @section View setter/getter properties
	 * These properties allow to fetch the state of the view then read, *and*
	 * modify it. Setting the value of any of these properties has the same
	 * effect as calling `setView()` with appropriate values.
	 *
	 * Setting a value does not guarantee that the final value will be the
	 * given one. For example, when setting the center and immediatly then
	 * querying the center, the actual center can be a reprojection of the
	 * given one.
	 *
	 * @property center: RawGeometry
	 * The center of the map, as a point geometry.
	 * @property scale: Number
	 * The scale, in CRS units per CSS pixel.
	 * @property span: Number
	 * The span, in CRS units per diagonal.
	 * @property crs: BaseCRS
	 * The CRS being used by the platina.
	 * @property yawDegrees: Number
	 * The yaw rotation angle, in clockwise degrees.
	 * @property yawRadians: Number
	 * The yaw rotation angle, in counter-clockwise radians.
	 * @property backgrounColour: Colour
	 * Self-explanatory
	 */
	get center() {
		return this.#center;
	}
	set center(c) {
		return this.setView({ center: c });
	}

	get scale() {
		return this.#scale;
	}
	set scale(s) {
		return this.setView({ scale: s });
	}

	get span() {
		const [w, h] = this.pxSize;
		return this.#scale * Math.sqrt(w * w + h * h);
	}
	set span(s) {
		return this.setView({ span: s });
	}

	get crs() {
		return this.#crs;
	}
	set crs(c) {
		return this.setView({ crs: c });
	}

	get yawRadians() {
		return this.#yaw;
	}
	get yawDegrees() {
		return (-this.#yaw * 180) / Math.PI;
	}
	set yawRadians(y) {
		return this.setView({ yawRadians: y });
	}
	set yawDegrees(y) {
		return this.setView({ yawDegrees: y });
	}

	get backgroundColour() {
		return this.#backgroundColour;
	}
	set backgroundColour(c) {
		if (c === null) {
			this._clear = {
				run: function run() {
					/*noop*/
				},
			};
		} else {
			this.#backgroundColour = parseCSSColor(c).map((n) => n / 255);
			this._clear = new this.#glii.WebGL1Clear({
				color: this.#backgroundColour,
				// 			depth: -1,
			});
		}
	}

	/**
	 * @property bbox: ExpandBox
	 * A rectangular bounding box that completely covers the map
	 * viewport. This box is aligned to the CRS, not to the viewport. Setting its
	 * value is akin to running `fitBounds`.
	 */
	get bbox() {
		return this._bbox;
	}
	set bbox(b) {
		this.fitBounds(b);
	}

	/**
	 * @section View getter properties
	 * @property pxSize: Array of Number
	 * The size of the canvas, in CSS pixels, in `[width, height]` form. Read-only.
	 */
	get pxSize() {
		return [this._pxWidth, this._pxHeight];
	}

	/**
	 * @property deviceSize: Array of Number
	 * The size of the canvas, in device pixels, in `[width, height]` form. Read-only.
	 */
	get deviceSize() {
		return [this._devWidth, this._devHeight];
	}

	/**
	 * @section
	 * @property glii: GliiFactory
	 * The Glii instance used by the platina. Read-only.
	 */
	get glii() {
		return this.#glii;
	}

	/**
	 * @property glii: GleoMap
	 * The `GleoMap` instance used to spawn this platina. If the platina
	 * was created stand-alone, this will be `undefined` instead.
	 */
	get map() {
		return this.#map;
	}

	/**
	 * @property resizable: Boolean
	 * Whether the platina reacts to changes in its DOM container. Read-only.
	 */
	get resizable() {
		return this.#resizable;
	}

	/**
	 * @section Conversion methods
	 * @method pxToGeom(xy: Array of Number, wrap?: Boolean): Geometry
	 * Given a (CSS) pixel coordinate relative to the `<canvas>` of the map,
	 * in the form `[x, y]`, returns the point `Geometry` (in the map's CRS)
	 * which corresponds to that pixel, at the map's current center/scale.
	 *
	 * The resulting geometry will be wrapped by default. To avoid this,
	 * set `wrap` to `false`.
	 *
	 * This is akin to Leaflet's `containerPointToLatLng()`. Inverse of `geomToPx`.
	 */
	pxToGeom([x, y], wrap = true) {
		if (!this._crsMatrix) {
			// Edge case - pointer events before center/scale has been set.
			if (this.#crs) {
				return new Geometry(this.#crs, [NaN, NaN]);
			} else {
				return undefined;
			}
		}

		const dpr = devicePixelRatio ?? 1;
		const w = this._devWidth;
		const h = this._devHeight;
		// Convert the px to clipspace, then multiply by this._crsMatrix.
		//const [w, h] = this.#glii.refreshDrawingBufferSize();

		const clipX = (dpr * x * 2) / w - 1;
		const clipY = (dpr * y * -2) / h + 1;

		const vec = [clipX, clipY, 1];

		const invMatrix = invert(new Array(9), this._crsMatrix);

		if (!invMatrix) {
			// There's some NaN values somewhere
			debugger;
		}

		// The matrix transposition is needed only because gl-matrix's notation
		// is transposed relative to WebGL's (or glii's) notation.
		transpose(invMatrix, invMatrix);
		// 		transformMat3(vec, vec, this._invMatrix);
		transformMat3(vec, vec, invMatrix);
		return new Geometry(this.#crs, [vec[0], vec[1]], { wrap });
	}

	/**
	 * @method geomToPx(Geometry): Array of Number
	 * Given a point `Geometry`, returns the `[x, y]` coordinates of the (CSS)
	 * pixel relative to the `<canvas>` of the map corresponding to that geometry
	 * (for the map's current center/scale).
	 *
	 * This is akin to Leaflet's `latLngToContainerPoint()`. Inverse of `pxToGeom`.
	 */
	geomToPx(geom) {
		if (!this._crsMatrix) {
			// Edge case - pins before center/scale have been set
			return [NaN, NaN];
		}

		let projectedGeom = geom.toCRS(this.#crs);

		// Matrix transposition stuff because of
		// https://gitlab.com/IvanSanchez/gleo/-/issues/10
		const transMatrix = transpose(new Array(9), this._crsMatrix);
		const vec = [projectedGeom.coords[0], projectedGeom.coords[1], 1];
		transformMat3(vec, vec, transMatrix);

		const dpr = devicePixelRatio ?? 1;

		return [
			(vec[0] / 2 + 0.5) * this._pxWidth * dpr,
			(0.5 - vec[1] / 2) * this._pxHeight * dpr,
		];
	}

	#loaders = [];

	/**
	 * @section Symbol/Loader management
	 * @method add(symbol: GleoSymbol): this
	 * Adds the given `GleoSymbol` to the appropriate acetate.
	 *
	 * Users should note that repeated calls to `add()` are, in performance terms,
	 * **much worse** than a single call to `multiAdd()`. Try to avoid repeated calls
	 * to `add()` inside a loop.
	 *
	 * @alternative
	 * @method add(loader: Loader): this
	 * Attaches the given `Loader` to the map.
	 */
	add(symbol) {
		return this.multiAdd([symbol]);
	}

	/**
	 * @method multiAdd(symbols: Array of GleoSymbol): this
	 * Adds the given `GleoSymbol`s to the appropriate acetate(s).
	 * @alternative
	 * @method multiAdd(loaders: Arrary of Loader): this
	 * Adds the given `Loader`s to the platina.
	 */
	multiAdd(symbols) {
		const bins = new Map();

		// Just for MultiSymbol class
		symbols = symbols
			.map((s) => {
				if (s instanceof Loader) {
					this.#loaders.push(s);

					// Loaders need to trigger their functionality.
					// s.addTo(this);
					s._addToPlatina(this);
					s.on("symbolsadded", this.#boundMultiAdd);
					s.on("symbolsremoved", this.#boundMultiRemove);
					return []; // Skip from acetate-finding logic.
				} else if (s.symbols) {
					// MultiSymbol
					s.target = this;
					return s.symbols;
				} else {
					return [s];
				}
			})
			.flat();

		symbols.forEach((s) => {
			const ac = s.constructor.Acetate;
			if (ac) {
				const bin = bins.get(ac);
				if (bin) {
					bin.push(s);
				} else {
					bins.set(ac, [s]);
				}
			} else if (!!s.expand) {
				// Very very likely a Spider
				s.addTo(this);
			} else {
				debugger;
			}
		});

		for (let [ac, syms] of bins.entries()) {
			this.getAcetateOfClass(ac).multiAdd(syms);
		}
		return this;
	}

	/**
	 * @method remove(symbol: GleoSymbol): this
	 * Removes one symbol from this map.
	 */
	remove(symbol) {
		symbol.remove();
		if (symbol instanceof Loader) {
			this.#loaders = this.#loaders.filter((l) => l !== symbol);

			symbol.off("symbolsadded", this.#boundMultiAdd);
			symbol.off("symbolsremoved", this.#boundMultiRemove);
		}

		return this;
	}

	/**
	 * @method multiRemove(symbols: Array of GleoSymbol): this
	 * Removes several symbols from this map.
	 */
	multiRemove(symbols) {
		const bins = new Map();

		symbols
			.filter((s) => s instanceof Loader)
			.forEach((s) => {
				this.#loaders = this.#loaders.filter((l) => l !== s);

				s.off("symbolsadded", this.#boundMultiAdd);
				s.off("symbolsremoved", this.#boundMultiRemove);
			});

		// Just for MultiSymbol class
		symbols.forEach((s) => {
			if (s.symbols) {
				symbols = symbols.concat(s.symbols);
			}
		});

		/// Group by acetate, let the acetate do the multiRemove().
		symbols
			.filter((s) => s._inAcetate)
			.forEach((s) => {
				const ac = s._inAcetate;
				if (ac) {
					const bin = bins.get(ac);
					if (bin) {
						bin.push(s);
					} else {
						bins.set(ac, [s]);
					}
				}
			});

		// Handle Spiders
		symbols.filter((s) => !!s.expand).forEach((s) => s.remove());

		bins.forEach((symbols, acetate) => acetate.multiRemove(symbols));

		return this;
	}

	/**
	 * @method has(symbol: GleoSymbol): Boolean
	 * Returns `true` if this platina contains the given symbol, false otherwise.
	 * @alternative
	 * @method has(symbol: Loader): Boolean
	 * Returns `true` if this platina contains the given loader, false otherwise.
	 */
	has(s) {
		if (s instanceof Loader) {
			return this.#loaders.includes(s);
		} else {
			const matches = this._acetates.filter(
				(a) => a instanceof s.constructor.Acetate
			);
			return matches.some((a) => a.has(s));
		}
	}

	// Internal use only. Called by the resize observer; resizes the framebuffers of
	// each acetate and triggers a re-render.
	#onResize(ev) {
		let x_css, y_css, x_device, y_device;

		if (!this.#canvas) {
			return;
		}

		if (ev) {
			x_css = ev.detail.x_css;
			y_css = ev.detail.y_css;
			x_device = ev.detail.x_device;
			y_device = ev.detail.y_device;
		} else {
			let rect = this.#canvas.getClientRects && this.#canvas.getClientRects()[0];
			if (rect) {
				// Canvas is in the DOM, possibly with applied CSS
				x_css = rect.width;
				y_css = rect.height;
			} else if (this.#canvas.width) {
				// Canvas is *not* in the DOM, so trust its width/height
				/// FIXME: What if this.#canvas is a WebGLRenderingContext?
				x_css = this.#canvas.width;
				y_css = this.#canvas.height;
			} else if (this.#canvas.drawingBufferWidth) {
				x_css = this.#canvas.drawingBufferWidth;
				y_css = this.#canvas.drawingBufferHeight;
			}

			const dpr = devicePixelRatio ?? 1;
			x_device = x_css * dpr;
			y_device = y_css * dpr;
		}

		if (x_css === 0 || y_css === 0) {
			throw new Error("Map size is zero");
		}

		this._pxWidth = this.#canvas.width = x_css = Math.floor(x_css);
		this._pxHeight = this.#canvas.height = y_css = Math.floor(y_css);

		this._devWidth = x_device;
		this._devHeight = y_device;

		/**
		 * @event resize: Event
		 * Fired when the platina is resized. Detail
		 */
		this.fire("resize", {
			x_css,
			y_css,
			x_device,
			y_device,
		});

		this._acetates.forEach((ac) => {
			ac.resize(x_device, y_device, x_css, y_css);
		});

		if (this.#center && this.#scale) {
			this.setView({});
		}
	}

	/**
	 * @section Scale and pixel fidelity methods
	 * Several use cases call for re-using a set of scale values.
	 *
	 * In particular, raster symbols (including tiles) have a preferred (or
	 * set of preferred) scale factors to be shown as, so that they are shown at
	 * a 1:1 raster pixel / screen pixel ratio.
	 *
	 * A `Platina` does not enforce these scale values; the usual way to enforce
	 * them is by using a `ZoomYawSnapActuator`.
	 */
	#scaleStopsPerCRS = new Map();
	/**
	 * @method setScaleStop(crsName: String, scale: Number): this
	 * Sets a scale stop for the given CRS **name**.
	 */
	setScaleStop(crsName, scale) {
		if (!this.#scaleStopsPerCRS.has(crsName)) {
			this.#scaleStopsPerCRS.set(crsName, new Map());
		}
		const stops = this.#scaleStopsPerCRS.get(crsName);
		if (stops.has(scale)) {
			stops.set(scale, stops.get(scale) + 1);
		} else {
			stops.set(scale, 1);
		}
		return this;
	}

	/**
	 * @method removeScaleStop(crsName: String, scale: Number): this
	 * Reverse of `setScaleStop`.
	 */
	removeScaleStop(crsName, scale) {
		if (!this.#scaleStopsPerCRS.has(crsName)) {
			return this;
		}
		const stops = this.#scaleStopsPerCRS.get(crsName);
		if (!stops.has(scale)) {
			return this;
		} else {
			const usageCount = stops.get(scale);
			if (usageCount === 1) {
				stops.delete(scale);
			} else {
				stops.set(scale, usageCount - 1);
			}
		}
		return this;
	}

	/**
	 * @method getScaleStops(crsName): Array of Number
	 * Returns the scale stops for the given CRS name
	 */
	getScaleStops(crsName) {
		const crsStops = this.#scaleStopsPerCRS.get(crsName);
		return crsStops ? Array.from(this.#scaleStopsPerCRS.get(crsName).keys()) : [];
	}

	// Will hold the canvas-relative pixel coordinates of the last `pointerDown`
	// event, on a per-pointer basis.
	#onPointerDownCoords = {};

	// Internal use only. Decorates a DOM event, so that it has the CRS coordinates
	// in the event's properties.
	// It then dispatches on all acetates (so they can dispatch on the appropriate
	// symbol)
	// Additionally prevents dispatching a `click` event if there's been a drag.
	// Needs to *not* be private, for leaflet-gleo compatibility
	_onPointerEvent(ev) {
		if ("canvasX" in ev) {
			return;
		}
		const [canvasX, canvasY] = getMousePosition(ev, this.#canvas);
		const geometry = this.pxToGeom([canvasX, canvasY], false);

		// Prevent click on drag
		if (ev.type === "pointerdown") {
			this.#onPointerDownCoords[ev.pointerId] = [canvasX, canvasY];
		} else if (ev.type === "click" || ev.type === "auxclick") {
			if ("pointerId" in ev) {
				// Non-firefox branch: compare against the pointerdown coords
				// for the event's pointerId

				const [downX, downY] = this.#onPointerDownCoords[ev.pointerId];

				if (Math.abs(downX - canvasX) > 3 || Math.abs(downY - canvasY) > 3) {
					// The click happened far away from the pointerdown, ignore this click
					return;
				}
			} else {
				// Firefox branch: compare against *all* pointerdown canvas coords
				if (
					Object.values(this.#onPointerDownCoords).every(
						([downX, downY]) =>
							Math.abs(downX - canvasX) > 3 || Math.abs(downY - canvasY) > 3
					)
				) {
					return;
				}
			}
		}

		// Properties of MouseEvents/PointerEvents are not enumerable, so doing {...ev} is
		// unfortunately not an option.
		let init = {
			// EventInit
			bubbles: ev.bubbles,
			cancelable: ev.cancelable,
			composed: ev.composed,
			// 			target: this,

			// UIEventInit
			detail: ev.detail,
			view: ev.view,

			// mouseEventInit
			screenX: ev.screenX,
			screenY: ev.screenY,
			clientX: ev.clientX,
			clientY: ev.clientY,
			ctrlKey: ev.ctrlKey,
			shiftKey: ev.shiftKey,
			altKey: ev.altKey,
			metaKey: ev.metaKey,
			button: ev.button,
			buttons: ev.buttons,
			relatedTarget: ev.relatedTarget,
			region: ev.region,

			// GleoPointerEvent
			geometry,
			canvasX,
			canvasY,
		};

		if (ev instanceof PointerEvent) {
			// i.e. do not add these properties to the `click`/`auxclick`/
			// `contextmenu` `MouseEvent`s, even though they *should* be
			// `PointerEvent`s as per https://w3c.github.io/pointerevents/#the-click-auxclick-and-contextmenu-events
			// (These events are `MouseEvent`s in Firefox; Chrom[ium|e] correctly
			// dispatches `PointerEvent`s).
			init = {
				...init,
				pointerId: ev.pointerId,
				width: ev.width,
				height: ev.height,
				pressure: ev.pressure,
				tangentialPressure: ev.tangentialPressure,
				tiltX: ev.tiltX,
				tiltY: ev.tiltY,
				twist: ev.twist,
				pointerType: ev.pointerType,
				isPrimary: ev.isPrimary,
			};
		}

		// Create a new synthetic pointer event with the data from the real one,
		// so that it can be dispatched again with the decorated detail.
		const EventProto = ev instanceof PointerEvent ? GleoPointerEvent : GleoMouseEvent;
		const decoratedEvent = new EventProto(ev.type, init);

		let canDefault = true;
		this._acetates.every((ac) => {
			if (decoratedEvent._canPropagate) {
				canDefault &= ac.dispatchPointerEvent(decoratedEvent, init);
				return decoratedEvent._canPropagate;
			} else {
				return true;
			}
		});

		if (decoratedEvent._canPropagate) {
			canDefault &= this.dispatchEvent(decoratedEvent);
		}

		if (!decoratedEvent._canPropagate) {
			ev.stopPropagation();
		}
		if (!canDefault) {
			ev.preventDefault();
		}
		return !decoratedEvent._canPropagate;
	}

	#cursorQueue = [];
	/**
	 * @section Internal methods
	 * @method queueCursor(cursor: String): this
	 * Called when hovering over an interactive symbol with a `cursor`; adds the
	 * given cursor to an internal queue. If there's only one cursor in the queue
	 * the CSS property of the platina's `<canvas>` will be set to it.
	 */
	queueCursor(cursor) {
		/*
		 * The reason for having a queue is that there might be several
		 * interactive acetates in the platina, and therefore several
		 * interactive overlapping symbols in any given pixel. The way that
		 * Gleo event handling works means that the pointer will fire
		 * `pointerover` and `pointerout` events in all of those overlapping
		 * symbols, with possibly conflicting cursors.
		 *
		 * Having a queue might not be the best way - maybe there's a need for
		 * a map of acetate to cursor, ordered by z-index. Race conditions in
		 * symbol cursors shouldn't be too problematic, though.
		 */
		if (this.#cursorQueue.length === 0) {
			this.canvas.style.cursor = cursor;
		}
		this.#cursorQueue.push();
	}

	/**
	 * @method unqueueCursor(cursor: String): this
	 * Called when unhovering out of an interactive symbol with a `cursor`; removes
	 * the given cursor from an internal queue. Resets the `cursor` CSS property
	 * of the platina's `<canvas>` to next item in that queue, or unsets it if the
	 * stack is empty.
	 */
	unqueueCursor(cursor) {
		this.#cursorQueue.splice(this.#cursorQueue.indexOf(cursor), 1);
		this.canvas.style.cursor =
			this.#cursorQueue.length === 0 ? "" : this.#cursorQueue[0];
	}
}

/**
 * @class AbstractPin
 *
 * Dummy class to optimize code usage when checking if
 * something is an `instanceof` a `HTMLPin`.
 */

class AbstractPin {}

/**
 * This is just a naïve poor substitute for the "CSS module imports"
 * feature: https://chromestatus.com/feature/5948572598009856
 *
 * It should be replaced with that, browser support permitting.
 *
 * One of the design intentions of Gleo is to not need a build system, so
 * depending on anything that bundles CSS together is a no-go.
 */

const head = document.getElementsByTagName("head")[0];
const el = document.createElement("style");
el.type = "text/css";
head.appendChild(el);

function css(str) {
	const styleNode = document.createTextNode(str);
	el.appendChild(styleNode);
}

// TODO: Consider packaging URW Gothic (~83KiB) as woff, and
// redistribute it. It's supposed to be AGPL3 from
// See https://github.com/ArtifexSoftware/urw-base35-fonts

// TODO: Consider packaging TeX Gyre Adventor (~170KiB) as woff,
// and redistribute it. It's LPPL from http://www.gust.org.pl/projects/e-foundry/tex-gyre

// TODO: Research Avant Garde Pro; Montserrat (https://fonts.google.com/specimen/Montserrat)
css(`
.gleo {
	position: relative;
	overflow: clip;
	font-family: "TeX Gyre Adventor", "URW Gothic L", "Century Gothic", "Futura", Sans Serif;
}

.gleo > canvas {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 0;
	right: 0;
	width: 100%;
	height: 100%;
}

.gleo-controlcorner { position: absolute; }
.gleo-controlcorner.tl { top: 0; left: 0; text-align: left;}
.gleo-controlcorner.tr { top: 0; right: 0; text-align: right;}
.gleo-controlcorner.bl { bottom: 0; left: 0; text-align: left; display: flex; flex-direction: column-reverse;}
.gleo-controlcorner.br { bottom: 0; right: 0; text-align: right;display: flex; flex-direction: column-reverse;}
`);

/**
 * @class GleoMap
 *
 * @inherits Evented
 * @relationship compositionOf Platina, 0..1, 1..1
 * @relationship compositionOf Control, 0..1, 1..1
 * @relationship compositionOf Actuator, 1..1, 0..n
 * @relationship compositionOf AbstractPin, 1..1, 0..n
 *
 * The `GleoMap` is the entry point of Gleo. Users wanting a quick start might
 * should look into `MercatorMap` instead.
 *
 * A `GleoMap` wraps together, inside the same `<div>`:
 * - A `Platina` (to do the drawing)
 * - `Actuator`s (for user interactivity)
 * - HTML `Control`s such as `ZoomInOut` buttons, `Attribution` and `ScaleBar`
 * - `HTMLPin`s such as `Balloon`s to display HTML content fixed on a
 *   geographical point.
 */

const actuators = [];
// Internal use only. Instances of
// GleoMap shall instantiate one of each during their own instantiation.

function registerActuator(name, proto, enabledByDefault) {
	// I still find this syntax for object literals confusing.
	actuators.push({ name, proto, enabledByDefault });
}

class GleoMap extends Evented {
	_setViewFilters = [];
	#platina;

	/**
	 * @constructor GleoMap(div: HTMLDivElement, options: GleoMap Options)
	 * @alternative
	 * @constructor GleoMap(divID: String, options: GleoMap Options)
	 */
	constructor(container, options = {}) {
		super();
		/**
		 * @section GleoMap Options
		 * @option resizable: Boolean = true
		 * Whether the map should react to changes in the size of its DOM
		 * container. Setting to `false` enables some memory optimizations.
		 *
		 * @section View initialization options
		 * The desired initial view of the map can be set with these options. They work
		 * the same as the options passed to the `setView` method.
		 *
		 * @option center: Geometry = undefined
		 * The desired map center
		 *
		 * @option scale: Number = undefined
		 * The desired map scale (**in CRS units per CSS pixel**). Mutually exclusive
		 * with `span`.
		 *
		 * @option span: Number
		 * The desired span of the map (in **CRS units** on the **diagonal of the viewport**).
		 * Mutually exclusive with `scale`.
		 *
		 * @option yawDegrees: Number = 0
		 * The desired yaw rotation, in degrees relative to "north up", clockwise.
		 * Mutually exclusive with `yawRadians`.
		 *
		 * @option yawRadians: Number = 0
		 * The desired yaw rotation, in radians relative to "north up", counterclockwise.
		 * Mutually exclusive with `yawDegrees`.
		 *
		 * @option crs: BaseCRS
		 * The desired CRS of the map.
		 */
		this.options = options;

		this.container =
			typeof container === "string"
				? document.getElementById(container)
				: container;

		if (this.container._gleo) {
			console.warn(
				"DOM element already contains a Gleo map, old one is being destroyed."
			);
			this.container._gleo.destroy?.();
		}
		this.container._gleo = this;
		this.container.classList.add("gleo");

		this.canvas = document.createElement("canvas");
		this.container.appendChild(this.canvas);
		this.#platina = new Platina(this.canvas, { ...options, map: this });

		/**
		 * @section
		 * @property actuators: Map of Actuator
		 * A key-value `Map` of actuator names to `Actuator` instances.
		 */
		this.actuators = new Map();

		// Spawn registered actuators
		actuators.forEach(({ name, proto, enabledByDefault }) => {
			const ac = new proto(this);
			if (enabledByDefault) {
				ac.enable();
			}
			this.actuators.set(name, ac);
		});

		// Hook up platina events
		/**
		 * @section Pointer events
		 *
		 * All [DOM `PointerEvent`s](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
		 * to the `<canvas>` of the map's `Platina` are handled by Gleo.
		 * Besides all of `PointerEvent`'s properties and methods, Gleo adds
		 * the `Geometry` corresponding to the pixel the event took place in.
		 *
		 * Most events are `GleoPointerEvent`s, but some browsers fire
		 * exclusively `MouseEvent`s for `click`/`auxclick`/`contextmenu`. In
		 * that case, expect a `GleoMouseEvent` instead.
		 *
		 * @event click: GleoPointerEvent
		 * Akin to the [DOM `click` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event)
		 * @event dblclick: GleoPointerEvent
		 * Akin to the [DOM `dblclick` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event)
		 * @event auxclick: GleoPointerEvent
		 * Akin to the [DOM `auxclick` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/auxclick_event)
		 * @event contextmenu: GleoPointerEvent
		 * Akin to the [DOM `contextmenu` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event)
		 * @event pointerover: GleoPointerEvent
		 * Akin to the [DOM `pointerover` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerover_event)
		 * @event pointerenter: GleoPointerEvent
		 * Akin to the [DOM `pointerenter` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerenter_event)
		 * @event pointerdown: GleoPointerEvent
		 * Akin to the [DOM `pointerdown` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerdown_event)
		 * @event pointermove: GleoPointerEvent
		 * Akin to the [DOM `pointermove` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointermove_event)
		 * @event pointerup: GleoPointerEvent
		 * Akin to the [DOM `pointerup` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerup_event)
		 * @event pointercancel: GleoPointerEvent
		 * Akin to the [DOM `pointercancel` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointercancel_event)
		 * @event pointerout: GleoPointerEvent
		 * Akin to the [DOM `pointerout` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerout_event)
		 * @event pointerleave: GleoPointerEvent
		 * Akin to the [DOM `pointerleave` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/pointerleave_event)
		 * @event gotpointercapture: GleoPointerEvent
		 * Akin to the [DOM `gotpointercapture` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/gotpointercapture_event)
		 * @event lostpointercapture: GleoPointerEvent
		 * Akin to the [DOM `lostpointercapture` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/lostpointercapture_event)
		 *
		 * @section Rendering events
		 * @event prerender
		 * Fired just *before* a symbol+acetate+platina render.
		 * @event render
		 * Fired just *after* a symbol+acetate+platina render.
		 *
		 * @section View change events
		 * @event crsoffset
		 * Fired when the CRS changes explicitly (by setting the map's
		 * CRS, or passing a `crs` option to a `setView` call)
		 * @event crsoffset
		 * Fired when the CRS undergoes an implicit offset to avoid
		 * precision loss.
		 * @event viewchanged
		 * Fired whenever any of the platina's view parts (center, scale/span,
		 * yaw, crs) changes.
		 *
		 * @section Symbol/loader management events
		 * @event symbolsadded
		 * Fired whenever symbols are added to any of the platina's acetates.
		 * @event symbolsremoved
		 * Fired whenever symbols are removed from any of th platina's acetates.
		 *
		 */
		for (let evName of [
			"click",
			"dblclick",
			"auxclick",
			"contextmenu",
			"pointerover",
			"pointerenter",
			"pointerdown",
			"pointermove",
			"pointerup",
			"pointercancel",
			"pointerout",
			"pointerleave",
			"gotpointercapture",
			"lostpointercapture",

			"prerender",
			"render",

			"crschange",
			"crsoffset",
			"viewchanged",

			"acetateadded",
			"symbolsadded",
			"symbolsremoved",
			"loaderadded",
			"loaderremoved",
		]) {
			this.#platina.addEventListener(evName, this._onPlatinaEvent.bind(this));
		}

		/**
		 * @section Controls interface
		 * @property controlPositions: Map of String to HTMLElement
		 * A `Map` containing the four control container corners, indexed
		 * by a two-letter string (one of `tl`, `tr`, `bl`, `br`)
		 */
		const corners = [`tl`, `tr`, `bl`, `br`];
		this.controlPositions = new Map();
		for (let corner of corners) {
			const el = document.createElement("div");
			el.className = `gleo-controlcorner ${corner}`;
			this.controlPositions.set(corner, el);
			this.container.appendChild(el);
		}
	}

	/**
	 * @section
	 * @method destroy(): this
	 * Destroys the map, freeing the container. Should free all used GPU resources,
	 * destroy DOM elements for controls and pins, and remove all DOM event listeners.
	 *
	 * No methods should be called on a destroyed map.
	 */
	destroy() {
		this.#platina?.destroy?.();
		this.#platina = undefined;

		this.controlPositions.forEach((corner) => this.container.removeChild(corner));

		/**
		 * @event destroy: Event
		 * Fired when the map is destroyed.
		 */
		this.fire("destroy");

		delete this.container._gleo;
		delete this.canvas;
		delete this.container;
	}

	/**
	 * @section
	 * @property container: HTMLDivElement
	 * The DOM element containing the map.
	 * @property platina: Platina
	 * The `Platina` that this `GleoMap` uses. Read only.
	 */
	get platina() {
		return this.#platina;
	}

	_onPlatinaEvent(ev) {
		const myEv = new ev.constructor(ev.type, ev);
		this.dispatchEvent(myEv);
	}

	/**
	 * @section View setter/getter properties
	 * These properties allow to fetch the state of the view then read, *and*
	 * modify it. Setting the value of any of these properties has the same
	 * effect as calling `setView()` with appropriate values.
	 *
	 * Setting a value will trigger the map's `Actuator`s. In most cases, this
	 * means starting an animation (via `InertiaActuator`) and keeping any
	 * values previously set as the target state of the animation.
	 *
	 * @property center: RawGeometry
	 * The center of the map, as a point geometry.
	 * @property scale: Number
	 * The scale, in CRS units per CSS pixel.
	 * @property span: Number
	 * The span, in CRS units per diagonal.
	 * @property crs: BaseCRS
	 * The CRS being used by the platina.
	 * @property yawDegrees: Number
	 * The yaw rotation angle, in clockwise degrees.
	 * @property yawRadians: Number
	 * The yaw rotation angle, in counter-clockwise radians.
	 */
	get center() {
		return this.#platina.center;
	}
	set center(c) {
		return this.setView({ center: c });
	}

	get scale() {
		return this.#platina.scale;
	}
	set scale(s) {
		return this.setView({ scale: s });
	}

	get span() {
		return this.#platina.span;
	}
	set span(s) {
		return this.setView({ span: s });
	}

	get crs() {
		return this.#platina.crs;
	}
	set crs(c) {
		return this.setView({ crs: c });
	}

	get yawRadians() {
		return this.#platina.yawRadians;
	}
	get yawDegrees() {
		return this.#platina.yawDegrees;
	}
	set yawRadians(y) {
		return this.setView({ yawRadians: y });
	}
	set yawDegrees(y) {
		return this.setView({ yawDegrees: y });
	}

	/**
	 * @property bbox: ExpandBox
	 * A rectangular bounding box that completely covers the map
	 * viewport. This box is aligned to the CRS, not to the viewport. Setting its
	 * value is akin to running `fitBounds`.
	 */
	get bbox() {
		return this.#platina.bbox;
	}
	set bbox(b) {
		this.fitBounds(b);
	}

	/**
	 * @section
	 * @property glii: GliiFactory
	 * The Glii instance used by the platina. Read-only.
	 */
	get glii() {
		return this.#platina.glii;
	}

	/**
	 * @section View setters
	 * @method setView(opts?: SetView Options): this
	 *
	 * (Re-)sets the map view: center (including its CRS), scale (AKA zoom) and yaw.
	 *
	 * This will trigger an animation to the desired center/scale if the appropriate
	 * `Actuator`s are enabled.
	 */
	setView(opts) {
		if (opts.center) {
			opts.center = factory(opts.center);
		}
		opts = this._setViewFilters.reduce((ops, fn) => fn(ops), opts);
		if (opts) {
			this.#platina.setView(opts);
		}
		return this;
	}

	/**
	 * @method fitBounds(bounds: Array of Number, opts?: SetView Options): this
	 * Sets the platina's center and scale so that the given bounds (given in
	 * `[minX, minY, maxX, maxY]` form, and in the platina's CRS) are fully
	 * visible.
	 *
	 * Any other given `SetView Options` will be merged with the calculated center&scale.
	 * @alternative
	 * @method fitBounds(ExpandBox, opts?: SetView Options): this
	 * Idem, but using an `ExpandBox` instead.
	 * @alternative
	 * @method fitBounds(bounds: RawGeometry, opts?: SetView Options): this
	 * Idem, but fitting to the bbox of a `Geometry` instead.
	 *
	 * This performs an implicit reprojection, so that it works as expected
	 * then the geometry's CRS is different than the map's CRS.
	 */
	fitBounds(bounds, opts = {}) {
		/// NOTE: This reimplements the code from `Platina` in order to perform
		/// animations (setview filters, actuators)
		/// FIXME: Currently sets the yaw to zero. Instead it should respect it.
		let minX, minY, maxX, maxY;
		if (bounds instanceof ExpandBox) {
			({ minX, minY, maxX, maxY } = bounds);
		} else if (bounds instanceof RawGeometry) {
			({ minX, minY, maxX, maxY } = bounds.toCRS(this.crs).bbox());
		} else {
			[minX, minY, maxX, maxY] = bounds;
		}

		const [w, h] = this.platina.pxSize;

		const center = new Geometry(this.crs, [(minX + maxX) / 2, (minY + maxY) / 2]);
		const scale = Math.max((maxX - minX) / w, (maxY - minY) / h);
		return this.setView({
			...opts,
			center: center,
			scale: scale,
			yaw: 0,
		});
	}

	/**
	 * @method zoomInto(geometry: Geometry, scale: Number, opts?: SetView Options): this
	 * Performs a `setView` operation so that the given geometry stays at the
	 * same pixel.
	 *
	 * Meant for user interactions on the map, including double-clicking and
	 * zooming into clusters from a `Clusterer`. Akin to Leaflet's `zoomAround`.
	 */
	zoomInto(geometry, scale, opts = {}) {
		const [canvasX, canvasY] = this.platina.geomToPx(factory(geometry));
		const [w, h] = this.#platina.pxSize;
		let clipX = (canvasX * 2) / w - 1;
		let clipY = (canvasY * -2) / h + 1;

		const scaleFactor = scale / this.scale;

		clipX -= clipX * scaleFactor;
		clipY -= clipY * scaleFactor;

		const vec = [clipX, clipY, 1];
		const invMatrix = invert(new Array(9), this.#platina._crsMatrix);
		transpose(invMatrix, invMatrix);
		transformMat3(vec, vec, invMatrix);

		const targetCenter = new Geometry(this.crs, [vec[0], vec[1]], { wrap: false });

		return this.setView({ ...opts, center: targetCenter, scale: scale });
	}

	/**
	 * @section
	 * @method redraw(): this
	 * Forcefully redraws all acetates.
	 */
	redraw() {
		this.#platina.redraw();
		return this;
	}

	/**
	 * @section Actuator interface methods
	 * @method registerSetViewFilter(fn: Function): this
	 * Registers a new filter function `fn` which will intercept calls to `setView`.
	 * This function receives a set of `setView Options` and must return a set of
	 * `setView Options`, or `false` (which aborts the `setView`).
	 *
	 * This is used to enforce map view constraints, as those of `ZoomYawSnapActuator`.
	 */
	registerSetViewFilter(fn) {
		this._setViewFilters.push(fn);
		return this;
	}
	/**
	 * @method unregisterSetViewFilter(fn: Function): this
	 * Opposite of `registerSetViewFilter`.
	 */
	unregisterSetViewFilter(fn) {
		const position = this._setViewFilters.indexOf(fn);
		if (position >= 0) {
			this._setViewFilters.splice(position, 1);
		}
		return this;
	}

	/**
	 * @section Symbol/Loader management
	 *
	 * A `GleoMap` doesn't really hold the state of symbols/loaders in the map.
	 * These calls are proxied to the map's `Platina`.
	 *
	 * @method add(symbol: GleoSymbol): this
	 * Adds the given `GleoSymbol` to the appropriate acetate.
	 *
	 * Users should note that repeated calls to `add()` are, in performance terms,
	 * **much worse** than a single call to `multiAdd()`. Try to avoid repeated calls
	 * to `add()` inside a loop.
	 *
	 * @alternative
	 * @method add(loader: Loader): this
	 * Attaches the given `Loader` to the map.
	 *
	 * @alternative
	 * @method add(pin: AbstractPin): this
	 * Attaches the given pin (`HTMLPin` *et al*) to the map.
	 */
	add(symbol) {
		if (symbol instanceof AbstractPin) {
			symbol.addTo(this);
		} else {
			this.#platina.add(symbol);
		}
		return this;
	}

	/**
	 * @method multiAdd(symbols: Array of GleoSymbol): this
	 * Adds the given `GleoSymbol`s to the appropriate acetate(s).
	 * @alternative
	 * @method multiAdd(symbols: Array of AbstractPin): this
	 * Adds the given pins (`HTMLPin`s, `Balloon`s) to the map.
	 *
	 * It's also possible to call `multiAdd` with an array containing both symbols
	 * and pins.
	 */
	multiAdd(symbols) {
		this.#platina?.multiAdd(symbols.filter((s) => !(s instanceof AbstractPin)));
		symbols.filter((s) => s instanceof AbstractPin).forEach((s) => s.addTo(this));
		return this;
	}

	/**
	 * @method remove(symbol: GleoSymbol): this
	 * Removes the symbol from this map.
	 * @alternative
	 * @method remove(pin: AbstractPin): this
	 * Removes the pin from this map
	 */
	remove(symbol) {
		if (symbol instanceof AbstractPin) {
			symbol.remove();
		} else {
			this.remove.add(symbol);
		}
		return this;
	}

	/**
	 * @method multiRemove(symbols: Array of GleoSymbol): this
	 * Removes several symbols from this map.
	 * @alternative
	 * @method multiRemove(pins: Array of AbstractPin): this
	 * Removes several pins from this map.
	 *
	 * It's also possible to call `multiRemove` with an array containing both
	 * symbols and pins.
	 */
	multiRemove(symbols) {
		this.#platina?.multiRemove(symbols.filter((s) => !(s instanceof AbstractPin)));
		symbols.filter((s) => s instanceof AbstractPin).forEach((s) => s.remove());
		return this;
	}

	/**
	 * @method has(symbol: GleoSymbol): Boolean
	 * Returns `true` if this map contains the given symbol, false otherwise.
	 * @alternative
	 * @method has(symbol: Loader): Boolean
	 * Returns `true` if this map contains the given loader, false otherwise.
	 */
	has(s) {
		return this.platina?.has(s);
	}
	/**
	 * @method addAcetate(ac: Acetate): this
	 * Adds a new `Acetate` to the map.
	 *
	 * Calling this method is usually not needed, as there are default acetates.
	 */
	addAcetate(ac) {
		this.#platina?.addAcetate(ac);
		ac._map = this;
		return this;
	}
}

/**
 * @namespace epsg4326
 * @inherits BaseCRS
 *
 * A EPSG:4326 CRS - aka "latitude-longitude".
 *
 * Note that `epsg4326` works as a Singleton pattern - it's already an instance, so
 * do **not** call `new epsg4326()`.
 *
 * @example
 *
 * ```
 * import epsg4326 from 'gleo/src/crs/epsg4326.mjs';
 * import Geometry from 'gleo/src/geometry/Geometry.mjs';
 *
 * let myPoint = new Geometry(epsg4326, [5, 9]);
 * ```
 *
 */

const rad = Math.PI / 180;
const R = 6371000;

const epsg4326 = new BaseCRS("EPSG:4326", {
	wrapPeriodX: 360,
	distance: function haversineDistance(p1, p2) {
		// Haversine formula for great-circle distance. Based on an implementation by
		// Jussi Mattas (https://github.com/jussimattas / https://github.com/gitjuba)
		// See https://github.com/Leaflet/Leaflet/pull/5935
		const lat1 = p1.coords[1] * rad,
			lat2 = p2.coords[1] * rad,
			sinDLat = Math.sin(((p2.coords[1] - p1.coords[1]) * rad) / 2),
			sinDLon = Math.sin(((p2.coords[0] - p1.coords[0]) * rad) / 2),
			a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon,
			c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	},
	ogcUri: "http://www.opengis.net/def/crs/EPSG/0/4326",
	flipAxes: true,
	minSpan: 1e-6, // circa 0.1m at equator
	maxSpan: 720,
	viewableBounds: [-Infinity, -90, Infinity, 90],
});

// OGC URI Alias
/// TODO: axis order???!!!
registerCRS(epsg4326, "http://www.opengis.net/def/crs/OGC/1.3/CRS84");

var epsg4326$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	default: epsg4326
});

/**
 * @namespace epsg3857
 * @inherits BaseCRS
 *
 * A EPSG:3857 CRS - aka "spherical web mercator".
 *
 * Note that `epsg3857` works as a Singleton pattern - it's already an instance, so
 * do **not** call `new epsg3857()`.
 *
 * @example
 *
 * ```
 * import epsg3857 from 'gleo/src/crs/epsg3857.mjs';
 * import Geometry from 'gleo/src/geometry/Geometry.mjs';
 *
 * let myPoint = new Geometry(epsg3857, [5, 9]);
 * ```
 *
 */

const limit$1 = 20037508.34;

const epsg3857 = new BaseCRS("EPSG:3857", {
	wrapPeriodX: 2 * limit$1,
	distance: epsg4326,
	ogcUri: "http://www.opengis.net/def/crs/EPSG/0/3857",
	minSpan: 1,
	maxSpan: 4 * limit$1,
	viewableBounds: [-Infinity, -limit$1, Infinity, limit$1],
});

css(`
.gleo > canvas.nodrag {
	touch-action: pinch-zoom;
}
`);

/**
 * @class DragActuator
 * @inherits Actuator
 *
 * Pointer drag actuator. This includes mouse drag, one-touch drag and box zoom.
 *
 * Dragging a pointer through the map canvas shall drag the map around.
 */

/// TODO: Hack this actuator so that the DOM position of the `GleoMap`'s `<canvas>`
/// is moved on `_onPointerMove`, then reset to zero on `_onPreRender`. This
/// *should* prevent some of the movement lag when dragging.

/// TODO: Disable the drag actuator if there's a second `pointerdown` event
/// without a `pointerup` first - meaning there's two (or more) fingers/pens
/// touching the surface.

class DragActuator {
	#boundDown;
	#boundUp;
	#boundMove;

	#modifier;

	#box;

	#downPointers = new Set();

	/**
	 * @constructor DragActuator(map: GleoMap)
	 */
	constructor(map) {
		this.map = map;
		this.platina = map.platina;

		/**
		 * @class GleoMap
		 * @section Interaction behaviour options
		 * @option boxZoomModifier: String = "shift"
		 * One of `"shift"`, `"control"`, `"alt"` or `"meta"`. Defines the
		 * modifier key that must be pressed during a map drag so it performs
		 * a box zoom instead.
		 * @alternative
		 * @option boxZoomModifier: Boolean
		 * Explicitly set to `false` to disable box zooming.
		 */

		this.#boundDown = this.#onPointerDown.bind(this);
		this.#boundUp = this.#onPointerUp.bind(this);
		this.#boundMove = this.#onPointerMove.bind(this);

		switch (map.boxZoomModifier) {
			case "control":
				this.#modifier = "ctrlKey";
				break;
			case "alt":
				this.#modifier = "altKey";
				break;
			case "meta":
				this.#modifier = "metaKey";
				break;
			case false:
				this.#modifier = false;
				break;
			case "shift":
			default:
				this.#modifier = "shiftKey";
		}

		if (this.#modifier) {
			this.#box = document.createElement("div");
			this.#box.style.border = "2px dotted #38f";
			this.#box.style.background = "rgba(255,255,255,0.5)";
			this.#box.style.position = "absolute";
			this.#box.style.pointerEvents = "none";
		}
	}

	/**
	 * @method enable(): this
	 * Enables this actuator. This will capture `pointerdown`, `pointerup` and
	 * `pointermove` (between `pointerdown` and `pointerup`) DOM events.
	 */
	enable() {
		this.platina.canvas.classList.add("nodrag");
		this.platina.addEventListener("pointerdown", this.#boundDown);
		this.platina.addEventListener("pointerup", this.#boundUp);
		this.platina.addEventListener("pointerout", this.#boundUp);
	}

	/**
	 * @method disable(): this
	 * Disables this actuator. Stops capturing `pointerdown`, `pointermove`, `pointerup`
	 * DOM events.
	 */
	disable() {
		this.platina.canvas.classList.remove("nodrag");
		this.platina.removeEventListener("pointerdown", this.#boundDown);
		this.platina.removeEventListener("pointerup", this.#boundUp);
		this.platina.removeEventListener("pointerout", this.#boundUp);
		this.platina.removeEventListener("pointermove", this.#boundMove);
	}

	#boxZooming = false;
	#baseX;
	#baseY;
	#lastX;
	#lastY;
	#sizeX;
	#sizeY;
	#onPointerDown(ev) {
		this.#downPointers.add(ev.pointerId);
		[this.#baseX, this.#baseY] = getMousePosition(ev, this.map.canvas);

		if (this.#downPointers.size === 1) {
			this.platina.addEventListener("pointermove", this.#boundMove);
		} else {
			this.platina.removeEventListener("pointermove", this.#boundMove);
		}
		this.platina.canvas.setPointerCapture(ev.pointerId);

		if (this.#modifier && ev[this.#modifier]) {
			this.#boxZooming = true;
			this.#box.style.left = this.#baseX + "px";
			this.#box.style.top = this.#baseY + "px";
			this.#box.style.width = "0px";
			this.#box.style.height = "0px";
			this.map.container.appendChild(this.#box);
		} else {
			this.#boxZooming = false;
		}
	}

	#onPointerUp(ev) {
		if (!this.#downPointers.has(ev.pointerId)) {
			// This happens when the browser fires both a `pointerout` and a
			// `pointerup` event. The second one shall be ignored.
			// Else, the #downPointers counter would go into the negatives.
			return;
		}

		this.platina.canvas.releasePointerCapture(ev.pointerId);

		this.#downPointers.delete(ev.pointerId);

		this.platina.removeEventListener("pointermove", this.#boundMove);

		if (this.#downPointers.size === 0 && this.#boxZooming) {
			this.map.container.removeChild(this.#box);

			const corner1 = this.platina.pxToGeom([this.#baseX, this.#baseY], false);
			const corner2 = this.platina.pxToGeom(
				[this.#baseX + this.#sizeX, this.#baseY + this.#sizeY],
				false
			);

			const [x1, y1, x2, y2] = [corner1.coords, corner2.coords].flat();
			const box = [
				Math.min(x1, x2),
				Math.min(y1, y2),
				Math.max(x1, x2),
				Math.max(y1, y2),
			];

			this.map.fitBounds(box);

			this.#boxZooming = false;
		}
	}

	#onPointerMove(ev) {
		[this.#lastX, this.#lastY] = getMousePosition(ev, this.map.canvas);

		if (this.#boxZooming) {
			this.#sizeX = this.#lastX - this.#baseX;
			this.#sizeY = this.#lastY - this.#baseY;

			this.#box.style.left =
				Math.min(this.#baseX, this.#baseX + this.#sizeX) + "px";
			this.#box.style.top = Math.min(this.#baseY, this.#baseY + this.#sizeY) + "px";
			this.#box.style.width = Math.abs(this.#sizeX) + "px";
			this.#box.style.height = Math.abs(this.#sizeY) + "px";
		} else {
			const pxX = this.#lastX - this.#baseX;
			const pxY = this.#lastY - this.#baseY;

			const scale = this.map.scale;
			const yaw = this.map.yawRadians;
			const cosYaw = Math.cos(yaw);
			const sinYaw = Math.sin(yaw);

			const crsX = (pxX * cosYaw - pxY * sinYaw) * scale;
			const crsY = (pxX * sinYaw + pxY * cosYaw) * scale;

			const center = this.map.center;
			this.map.setView({
				center: new Geometry(center.crs, [
					center.coords[0] - crsX,
					center.coords[1] + crsY,
				]),
				duration: 0,
			});

			this.#baseX = this.#lastX;
			this.#baseY = this.#lastY;
		}
	}
}

registerActuator("drag", DragActuator, true);

css(`
.gleo > canvas.nopinch {
	touch-action: pan-x pan-y;
}
.gleo > canvas.nodrag.nopinch {
	touch-action: none;
}
`);

/**
 * @class PinchActuator
 * @inherits Actuator
 *
 * Pointer pinch actuator, for two-finger zoom and rotation.
 */

class PinchActuator {
	#boundDown;
	#boundUp;
	#boundMove;

	/**
	 * @constructor PinchActuator(map: GleoMap)
	 */
	constructor(map) {
		this.map = map;
		this.platina = map.platina;

		this.#boundDown = this.#onPointerDown.bind(this);
		this.#boundUp = this.#onPointerUp.bind(this);
		this.#boundMove = this.#onPointerMove.bind(this);
	}

	/**
	 * @method enable(): this
	 * Enables this actuator. This will capture `pointerdown`, `pointerup` and
	 * `pointermove` (between `pointerdown` and `pointerup`) DOM events.
	 */
	enable() {
		this.platina.canvas.classList.add("nopinch");
		this.platina.addEventListener("pointerdown", this.#boundDown);
		this.platina.addEventListener("pointerup", this.#boundUp);
		this.platina.addEventListener("pointerout", this.#boundUp);
	}

	/**
	 * @method disable(): this
	 * Disables this actuator. Stops capturing `pointerdown`, `pointermove`, `pointerup`
	 * DOM events.
	 */
	disable() {
		this.platina.canvas.classList.remove("nopinch");
		this.platina.removeEventListener("pointerdown", this.#boundDown);
		this.platina.removeEventListener("pointerup", this.#boundUp);
		this.platina.removeEventListener("pointerout", this.#boundUp);
		this.platina.removeEventListener("pointermove", this.#boundMove);
		this.#downPointers = 0;
	}

	// The algorithm revolves around keeping two sets of data for each of the
	// two (active) pointers: the screen/canvas XY position (which changes
	// with each movement), and the CRS position (the coordinates of the
	// event geometry, which keep the same during the entire pinch)
	#screenPositions = []; // In device pixels
	#crsPositions = [];
	#downPointers = 0;

	// There's a need to store the CRS when the pinch started, in case the CRS
	// changes during the pinch, to make the appropriate convertions.
	// It is assumed that the CRS will not change inbetween the first and
	// second pointer events.
	#crs;

	// `true` when the pinch's yaw is still under the threshold for yaw interaction
	// (which is 10°)
	#snapYaw = true;

	// Value of map's yaw when the pinch started, in radians
	#startYaw;

	#id1;
	#id2;

	// The relative angle between the two `#crsPositions`
	#crsTheta = 0;

	// The relative offset between the two `#screenPositions`
	#crsDelta = [];
	#crsDeltaSquareLength = 0;

	#onPointerDown(ev) {
		const id = ev.pointerId;
		const dpr = devicePixelRatio ?? 1;

		this.#downPointers++;

		this.#screenPositions[id] = [dpr * ev.canvasX, dpr * ev.canvasY];
		this.#crsPositions[id] = ev.geometry.coords;

		if (this.#downPointers === 1) {
			this.#crs = ev.geometry.crs;
			this.#id1 = id;
		} else if (this.#downPointers === 2) {
			this.#id2 = id;
			this.#snapYaw = true;
			this.#startYaw = this.map.yawRadians;

			const a = this.#crsPositions[this.#id1];
			const b = this.#crsPositions[this.#id2];

			this.#crsDelta = [b[0] - a[0], b[1] - a[1]];
			this.#crsTheta = Math.atan2(this.#crsDelta[1], this.#crsDelta[0]);
			this.#crsDeltaSquareLength = this.#crsDelta[0] ** 2 + this.#crsDelta[1] ** 2;

			this.platina.addEventListener("pointermove", this.#boundMove);
		}

		// Capture the pointer, unless there's a drag actuator (assume the drag
		// actuator already captured the pointer)
		if (!this.map.actuators.get("drag")) {
			this.platina.canvas.setPointerCapture(ev.pointerId);
		}
	}

	#onPointerUp(ev) {
		const id = ev.pointerId;

		if (!this.#screenPositions[id]) {
			return;
		}

		delete this.#screenPositions[id];
		delete this.#crsPositions[id];

		this.#downPointers--;

		if (this.#downPointers === 1) {
			this.map.setView({
				scale: this.map.scale,
				zoomSnap: true,
				yawDegrees: this.map.yawDegrees,
				yawSnap: true,
			});
			this.platina.removeEventListener("pointermove", this.#boundMove);

			// Reset the values of this.#id1 and this.#id2 - making sure
			// that the pointer ID currently down is at this.#id1
			if (id === this.#id1) {
				this.#id1 = this.#id2;
			}
			this.#id2 = undefined;
		}

		// Release pointer capture; same logic as on pointerdown.
		if (!this.map.actuators.get("drag")) {
			this.platina.canvas.releasePointerCapture(ev.pointerId);
		}
	}

	#onPointerMove(ev) {
		const id = ev.pointerId;
		const dpr = devicePixelRatio ?? 1;
		this.#screenPositions[id] = [dpr * ev.canvasX, dpr * ev.canvasY];

		// Ideally I'd like to solve this with some matrix equations - given
		// the transformation matrix and the known data (CRS coordinates,
		// expected clipspace coordinates), solve for the unknown data (center,
		// scale, yaw angle).

		// But, in the end, it's simpler to do this heuristically.

		const a = this.#screenPositions[this.#id1];
		const b = this.#screenPositions[this.#id2];

		const screenDelta = [b[0] - a[0], b[1] - a[1]];
		const screenTheta = Math.atan2(screenDelta[1], screenDelta[0]);

		const theta = -this.#crsTheta - screenTheta;
		const scale = Math.sqrt(
			this.#crsDeltaSquareLength / (screenDelta[0] ** 2 + screenDelta[1] ** 2)
		);

		/// Screen vector from the 1st known point to the center
		const [w, h] = this.platina.pxSize;

		const svX = w / 2 - a[0];
		const svY = a[1] - h / 2; // Screen Y is downwards, the calculations
		// will need upwards.

		// Rotate by negative theta
		const sinTheta = Math.sin(-theta);
		const cosTheta = Math.cos(-theta);
		const srX = svX * cosTheta - svY * sinTheta;
		const srY = svX * sinTheta + svY * cosTheta;

		// Multiply by scale - units are now CRS' units
		const crsDeltaX = srX * scale;
		const crsDeltaY = srY * scale;

		// Add the CRS delta to the 1st point's CRS coordinates
		const [crsX, crsY] = this.#crsPositions[this.#id1];
		const centerX = crsX + crsDeltaX;
		const centerY = crsY + crsDeltaY;

		if (Math.abs(theta - this.#startYaw) > 0.175) {
			// If yaw change greater than 0.175 radians (≃ π/18 = 10 degrees),
			// stop snapping yaw.
			this.#snapYaw = false;
		}

		this.map.setView({
			center: new Geometry(this.#crs, [centerX, centerY]),
			scale,
			yawRadians: this.#snapYaw ? this.#startYaw : theta,
			zoomSnap: false,
			yawSnap: false,
			duration: 0,
		});
	}
}

registerActuator("pinch", PinchActuator, true);

/**
 * @class WheelActuator
 * @inherits Actuator
 *
 * Mouse wheel actuator. Scrolling the mouse wheel shall zoom the map in/out.
 *
 * TODO: Fix interaction with SpanClampActuator
 */

class WheelActuator {
	#boundWheel;
	#boundPreRender;

	/**
	 * @constructor WheelActuator(map: GleoMap)
	 */
	constructor(map) {
		this.map = map;
		this.canvas = map.canvas;

		this.#boundWheel = this.#onWheel.bind(this);
		this.#boundPreRender = this.#onPreRender.bind(this);

		/**
		 * @class GleoMap
		 * @section Interaction behaviour options
		 * @option wheelPxPerZoomLog2: Number = 60
		 * How many scroll pixels mean a change in the scale by a factor of 2.
		 * Smaller values will make wheel-zooming faster, and vice versa. The
		 * default value of 60 means that one "step" on a standard mousewheel
		 * should change the scale by a factor of 2.
		 *
		 * This option depends on `WheelActuator` being loaded.
		 */
		map.wheelPxPerZoomLog2 ??= map.options.wheelPxPerZoomLog2 ?? 60;

		/**
		 * @option wheelZoomDuration: Number = 200
		 * Duration, in milliseconds, of the mousewheel zoom animation.
		 *
		 * This option depends on `WheelActuator` and `InertiaActuator` being loaded.
		 */
		map.wheelZoomDuration ??= map.options.wheelZoomDuration ?? 200;

		/**
		 * @section Interaction behaviour properties
		 * @property wheelPxPerLog2: Number
		 * Runtime value of the `wheelPxPerLog2` initialization option.
		 *
		 * Updating its value will affect future scrollwheel zoom operations.
		 * @property wheelZoomDuration: Number
		 * Runtime value of the `wheelZoomDuration` initialization option.
		 *
		 * Updating its value will affect future scrollwheel zoom operations.
		 */

		this.resetTargetScaleTimeout = undefined;
	}

	enable() {
		this.canvas.addEventListener("wheel", this.#boundWheel);
	}

	disable() {
		this.canvas.removeEventListener("wheel", this.#boundWheel);
	}

	#onWheel(ev) {
		ev.preventDefault();

		const dpr = devicePixelRatio ?? 1;
		const currentScale = this.map.scale;
		if (!this._targetScale) {
			this._targetScale = currentScale;
		}

		let [canvasX, canvasY] = getMousePosition(ev, this.map.canvas);
		this._targetCenter = this.map.center;

		const delta = getWheelDelta(ev);
		this._targetScale *= Math.pow(2, delta / this.map.wheelPxPerZoomLog2);

		const snapActuator = this.map.actuators.get("zoomsnap");
		const spanClampActuator = this.map.actuators.get("spanclamp");
		this._snappedTargetScale = this._targetScale;
		if (snapActuator && this.map.options.zoomSnap !== false) {
			this._snappedTargetScale = snapActuator.snapScale(this._targetScale);
		}
		if (spanClampActuator && this.map.options.zoomSnap !== false) {
			this._snappedTargetScale = spanClampActuator.clampScale(
				this._snappedTargetScale
			);
		}

		// Bits from GleoMap's pxToGeom
		// transform the wheel device-pixel coordinates into clipspace
		const [w, h] = this.map.platina.deviceSize;
		let clipX = (dpr * canvasX * 2) / w - 1;
		let clipY = (dpr * canvasY * -2) / h + 1;

		const scaleFactor = this._snappedTargetScale / currentScale;
		// 		const scaleFactor = Math.log2(
		// 			Math.pow(2,this._targetScale)
		// 			/
		// 			Math.pow(2,currentScale)
		// 		);

		clipX -= clipX * scaleFactor;
		clipY -= clipY * scaleFactor;

		const vec = [clipX, clipY, 1];
		const invMatrix = invert(new Array(9), this.map.platina._crsMatrix);
		transpose(invMatrix, invMatrix);
		transformMat3(vec, vec, invMatrix);

		this._targetCenter = new Geometry(this.map.center.crs, [vec[0], vec[1]], {
			wrap: false,
		});

		const boundsClampActuator = this.map.actuators.get("boundsclamp");
		if (boundsClampActuator) {
			this._targetCenter = boundsClampActuator.clampView(
				this._targetCenter,
				this._targetScale,
				this.map.platina.deviceSize
			);
		}

		// 		this._targetCenter.coords[0] += geom.coords[0];
		// 		this._targetCenter.coords[1] += geom.coords[1];
		// 		const targetY = center.coords[1] - geom.coords[1];

		///TODO: Do the change around the pointer position (as reported by the
		/// `wheel` event), instead of around the center point.
		// 		this._baseX = ev.clientX;
		// 		this._baseY = ev.clientY;

		this.map.platina.addEventListener("prerender", this.#boundPreRender);

		// The following assumes that no call to requestAnimationFrame()
		// will take more than ~400 millisecs.
		clearTimeout(this.resetTargetScaleTimeout);
		this.resetTargetScaleTimeout = setTimeout(
			this._resetTargetScale.bind(this),
			this.map.wheelZoomDuration + 200
		);
	}

	#onPreRender(ev) {
		//console.log(ev);
		// Event happens only once, so prevent running multiple times
		this.map.platina.removeEventListener("prerender", this.#boundPreRender);
		// 		const offsetX = this._lastX - this._baseX;
		// 		const offsetY = this._lastY - this._baseY;

		// 		console.log("prerender wheelzoom to", this._targetScale);

		if (this._snappedTargetScale !== this._lastSnappedScale) {
			this.map.setView({
				// this.map.center,
				center: this._targetCenter,
				scale: this._snappedTargetScale,
				duration: this.map.wheelZoomDuration,
				zoomSnap: false,
			});
		}

		this._lastSnappedScale = this._snappedTargetScale;
	}

	_resetTargetScale() {
		if (this.map.actuators.has("inertia")) {
			this.map.setView({
				scale: this._targetScale,
				zoomSnap: true,
			});
		}
		delete this._targetScale;
	}
}

// // Chrome on Win scrolls double the pixels as in other platforms (see Leaflet bug #4538),
// // and Firefox scrolls device pixels, not CSS pixels
// var wheelPxFactor =
// 	(Browser.win && Browser.chrome) ? 2 * window.devicePixelRatio :
// 	Browser.gecko ? window.devicePixelRatio : 1;

const wheelPxFactor = devicePixelRatio ?? 1;

// Aux, straight from Leaflet's DomEvent code.
function getWheelDelta(ev) {
	if (ev.deltaMode === 0) {
		// pixels
		return ev.deltaY / wheelPxFactor;
	} else if (ev.deltaMode === 1) {
		// lines
		return ev.deltaY * 10;
	} else if (ev.deltaMode === 2) {
		// pages
		return ev.deltaY * 60;
	}

	return 0;
}

registerActuator("wheel", WheelActuator, true);

/**
 *
 * Support stuff for creating an "Inertial easing".
 *
 * The core idea is that any change to the plane's center is "tweened" (short
 * for "in-betweened", from flash animators' jargon) with an ease-in-out function.
 *
 * Ease-in-out functions are not hard - the problem is aborting an easing animation
 * and starting a new one right after. This use case is very common - starting a
 * movement to a different part of the plane while a movement is already on its way,
 * or wheel-zoom interactions in very fast succesion.
 *
 * The approach to this is to have some way of calculating the inertia of the aborted
 * easing, and start a new easing with that inertia.
 *
 * The easing function **for the interpolated position** (and scale) is the one from
 * https://math.stackexchange.com/questions/121720/ease-in-out-function#121755 :
 * f(x) = x^a / ( x^a + (1-x)^a )
 * , with values of a between 0 and... 4? 5?. Typically 2 for a quadratic-like easing, or
 * 3 for a cubic-like easing.
 *
 * Assuming x and a are positive, that's equal to:
 * f(x) = 1/((1/x - 1)^a + 1)
 *
 * The **speed of change** for the interpolated position/scale is the derivative on x, namely
 *
 * f'(x) = (a (-(x - 1) x)^(a - 1))/(x^a + (1 - x)^a)^2
 *
 * The previous functions assume ranges from 0 to 1 - these have to be multiplied by the
 * delta vector (end position minus start position) to get the position at a given time.
 *
 * What if the easing started with inertia (with an initial speed)? Then, the starting speed
 * s0 will decrease polinomically - the speed at any given time will be s(x) = s0 * (1-x)^a.
 *
 * Therefore, the inertial component of the position will be the integral of that function
 * from zero to a given point in time - namely,
 * i(x,a) = s0 * (1 - (1 - x)^(1 + a))/(1 + a)
 *
 * The total amount of delta due to inertia will be:
 * s0 * (a+1)
 *
 * So the amount of easing delta needed will be the desired delta minus the inertia delta.
 *
 *
 * Special thanks to Juan Arias de Reyna <https://personal.us.es/arias/>
 * for pointers on how to approach this problem.
 */

class InertialEasing {
	constructor(start, end, speed, exponent = 2) {
		// `start`, `end` and `speed` are n-element arrays.
		// Typically 3-element arrays, for x-y-scale.

		/// TODO: Sanity check: `start`, `end` and `speed` should have the same number
		/// of elements

		const e = (this.exp = exponent);
		this.start = start;
		this.end = end;
		this.inertia = speed;

		const inertialDelta = speed.map((s) => s / (e + 1));
		const totalDelta = end.map((e, i) => e - start[i]);
		this.easingDelta = totalDelta.map((t, i) => t - inertialDelta[i]);
		// console.log("start, inertial, total, easing:", start, inertialDelta, totalDelta, this.easingDelta);

		// Sanity checks
		if (
			start.some(Number.isNaN) ||
			end.some(Number.isNaN) ||
			speed.some(Number.isNaN)
		) {
			throw new Error("A parameter for InertialEasing is Not A Number.");
		}
	}

	// Returns the eased values for the percentage (between 0 and 1) given
	getValues(percentage) {
		if (percentage < 0) {
			return this.start;
		}
		if (percentage > 1) {
			return this.end;
		}

		const x = percentage;
		const exp = this.exp;
		const inertiaComponent = (1 - Math.pow(1 - x, 1 + exp)) / (1 + exp);
		const easingComponent = 1 / (Math.pow(1 / x - 1, exp) + 1);

		return this.start.map(
			(s, i) =>
				s +
				this.inertia[i] * inertiaComponent +
				this.easingDelta[i] * easingComponent
		);
	}

	// Returns the speed of values change for the percentage (between 0 and 1) given
	getSpeed(percentage) {
		if (percentage < 0) {
			return;
		}
		if (percentage > 1) {
			return;
		}

		const x = percentage;
		const exp = this.exp;
		const inertiaComponent = Math.pow(1 - x, exp);
		const easingComponent =
			(exp * Math.pow(-(x - 1) * x, exp - 1)) /
			Math.pow(Math.pow(x, exp) + Math.pow(1 - x, exp), 2);

		return this.inertia.map(
			(iner, i) => iner * inertiaComponent + this.easingDelta[i] * easingComponent
		);
	}
}

/**
 * @class InertiaActuator
 * @inherits Actuator
 * @relationship associated InertialEasing
 *
 * The "Inertia Actuator" intercepts calls to the `GleoMap`'s `setView` method,
 * and turns them into timed, eased, animations.
 */

class InertiaActuator {
	#boundPreRender;

	/**
	 * @constructor InertiaActuator(map: GleoMap)
	 */
	constructor(map) {
		this.map = map;

		this.origSetView = map.setView;

		this.easing = undefined; // Instance of InertialEasing
		this.easingStartTime = undefined; // Output of performance.now()
		this.easingEndTime = undefined; // Output of performance.now() plus duration
		this.easingDuration = undefined;
		this.setViewOpts = {};

		this.#boundPreRender = this.#onPreRender.bind(this);
	}

	/**
	 * @method enable(): this
	 * Enables this actuator. This will overload the map's `setView` in order to
	 * intercept all of its calls.
	 */
	enable() {
		this.map.setView = (...args) => this.inertialSetView(...args);
	}

	/**
	 * @method disable(): this
	 * Disables this actuator. All calls to `setView` will not trigger an easing animation.
	 */
	disable() {
		this.map.setView = this.origSetView;
	}

	/**
	 * @method inertialSetView(opts?: Setview Options): this
	 *
	 * Starts an easing animation to (re-)set the map's center and scale to the given one.
	 * This implementation overrides the `GleoMap`'s default `setView` implementation.
	 */
	inertialSetView(opts = {}) {
		if (opts.crs && opts.crs !== this.map.platina.crs) {
			// Explicit CRS changes are applied directly, foregoing
			// the inertia animation.
			return this.map.platina.setView(opts);
		}

		const [w, h] = this.map.platina.pxSize;

		if (opts.span && !opts.scale) {
			opts.scale = opts.span / Math.sqrt(w * w + h * h);
		}

		// Reduce the view through the setViewFilters, just as the parent functionality does.
		if (opts.center) {
			opts.center = factory(opts.center);
			opts.center = opts.center.toCRS(this.map.crs);
		}
		opts = this.map._setViewFilters.reduce((ops, fn) => fn(ops), opts);
		if (!opts) {
			return this;
		}

		const startCenter = this.map.center;
		const startScale = this.map.scale;
		const startYaw = this.map.yawRadians;

		/**
		 * @miniclass SetView Options (Platina)
		 * @section
		 * @option duration: Number = 200
		 * If the map has a `InertiaActuator`, this defines the duration of the
		 * easing animation, in milliseconds. A value of `0` effectively disables
		 * the animation.
		 *
		 * Works only for `GleoMap`, and only when an `InertiaActuator` has been
		 * loaded; has no effect on `setView` calls made to a `Platina`.
		 */
		const duration = opts.duration || 200;

		if (
			startCenter === undefined ||
			startScale === undefined ||
			opts.duration === 0 ||
			opts.redraw === false
		) {
			this.easing = undefined;
			return this.map.platina.setView(opts);
		}

		const center = opts.center !== undefined ? opts.center : startCenter;
		const scale = opts.scale !== undefined ? Number(opts.scale) : startScale;
		const yaw =
			opts.yawRadians !== undefined
				? Number(opts.yawRadians)
				: opts.yawDegrees !== undefined
				? Number(-opts.yawDegrees * (Math.PI / 180))
				: startYaw;
		const crsCenter = center.toCRS(startCenter.crs);

		/// Get the speed from the previously running easing if needed.

		let speed = [0, 0, 0, 0];
		if (
			this.easing &&
			this.easingEndTime !== undefined &&
			performance.now() < this.easingEndTime
		) {
			const now = performance.now();
			const percentage = (now - this.easingStartTime) / this.easingDuration;
			// console.warn("Another easing operation is ongoing");
			speed = this.easing.getSpeed(percentage);
			const speedFactor = duration / this.easingDuration;
			speed = speed.map((s) => s * speedFactor);
			// 			console.log(scale, speed);

			// 			// Hacky workaround against reaching negative scale due to zoom inertia
			// 			if (speed[2] / (this.easing.exp+1) < startScale) {
			// 				console.log("Capping scale change speed");
			// 				speed[2] = - startScale * (this.easing.exp+1);
			// 			}
		} else {
			/**
			 * @class GleoMap
			 * @section Inertia animation events
			 * @event inertiastart: Event
			 * Fired at the beginning of an inertia animation.
			 */
			this.map.fire("inertiastart");
		}

		// console.log([crsCenter.coords[0], crsCenter.coords[1], Math.log2(scale)]);

		this.easing = new InertialEasing(
			[
				startCenter.coords[0],
				startCenter.coords[1],
				/*Math.log2*/ startScale,
				startYaw,
			],
			[crsCenter.coords[0], crsCenter.coords[1], /*Math.log2*/ scale, yaw],
			speed,
			2.5
		);

		this.crs = startCenter.crs;
		this.easingStartTime = performance.now();
		this.easingDuration = opts.duration || 200;
		this.easingEndTime = this.easingStartTime + this.easingDuration;
		this.setViewOpts = opts;

		this.map.platina.addEventListener("prerender", this.#boundPreRender);

		return this;
	}

	#onPreRender() {
		// Sanity check: it's possible to destroy a map mid-inertia.
		if (!this.map.platina) {
			return;
		}

		if (!this.easing) {
			return this.map.platina.removeEventListener(
				"prerender",
				this.#boundPreRender
			);
		}
		const now = performance.now();
		const percentage = (now - this.easingStartTime) / this.easingDuration;
		const vals = this.easing.getValues(percentage);

		// this.origSetView.call(
		this.map.platina.setView({
			...this.setViewOpts,
			center: new Geometry(this.crs, [vals[0], vals[1]]),
			scale: /*Math.pow(2, */ vals[2],
			yawRadians: vals[3],
			redraw: false,
		});

		if (percentage >= 1) {
			this.map.platina.removeEventListener("prerender", this._boundPreRender);
			this.easing = undefined;
			/**
			 * @class GleoMap
			 * @section Inertia animation events
			 * @event inertiaend: Event
			 * Fired at the end of an inertia animation.
			 */
			this.map.fire("inertiaend");
		}
	}
}

registerActuator("inertia", InertiaActuator, true);

/**
 * @class SpanClampActuator
 * @inherits Actuator
 *
 * Span clamping actuator. Forces the values of the scale so that the span
 * is within the CRS's `minSpan`/`maxSpan` limits.
 *
 * Akin to an enforcer of `minZoom`/`maxZoom` (albeit Gleo doesn't have the
 * concept of min/max zoom).
 */

class SpanClampActuator {
	/**
	 * @constructor SpanClampActuator(map: GleoMap)
	 */
	constructor(map) {
		this.map = map;
		this.#boundFilter = this.spanClampFilterSetView.bind(this);

		/**
		 * @class GleoMap
		 * @section Interaction behaviour options
		 * @option minSpan: Number
		 * The minimum length, **in CRS units**, of the map "span". The user won't
		 * be able to zoom in so that the lenght of the diagonal is less than
		 * this value.
		 *
		 * This option depends on `SpanClampActuator` being loaded.
		 * @alternative
		 * @option minSpan: undefined = undefined
		 * Setting `minSpan` to `undefined` (or any falsy value) will make the
		 * `SpanClampActuator` use the CRS's `minSpan` default instead.
		 *
		 * This is the default.
		 * @option maxSpan: Number
		 * Akin to `minSpan`: prevents the user from zooming out so that the length
		 * of the diagonal is larger than this number.
		 * @alternative
		 * @option minSpan: undefined = undefined
		 * Akin to `minSpan`: then falsy, uses the CRS's `maxSpan` instead.
		 *
		 * This is the default.
		 * @section Interaction behaviour properties
		 * @property minSpan
		 * Runtime value for the `minSpan` initialization option.
		 *
		 * Updating its value will affect future zoom operations.
		 * @property maxSpan
		 * Akin to the `minSpan` property.
		 */

		map.minSpan ??= map.options.minSpan;
		map.maxSpan ??= map.options.maxSpan;
	}

	#boundFilter;

	enable() {
		this.map.registerSetViewFilter(this.#boundFilter);
	}

	disable() {
		this.map.unregisterSetViewFilter(this.#boundFilter);
	}

	spanClampFilterSetView({ scale, span, ...opts }) {
		if (scale === undefined && span === undefined) {
			return opts;
		}

		if (span === undefined) {
			// Using scale only
			return {
				...opts,
				scale: this.clampScale(scale),
			};
		} else {
			// Using span only
			return {
				...opts,
				span: this.clampSpan(span),
			};
		}
	}

	clampSpan(span) {
		const crs = this.map.platina.crs;
		const minSpan = this.map.minSpan ?? crs.minSpan;
		const maxSpan = this.map.maxSpan ?? crs.maxSpan;
		return Math.max(minSpan, Math.min(maxSpan, span));
	}

	clampScale(scale) {
		const crs = this.map.platina.crs;
		const minSpan = this.map.minSpan ?? crs.minSpan;
		const maxSpan = this.map.maxSpan ?? crs.maxSpan;

		const [w, h] = this.map.platina.pxSize;
		const diag = Math.sqrt(w * w + h * h);

		const span = scale * diag;
		if (span > maxSpan) {
			return maxSpan / diag;
		}
		if (span < minSpan) {
			return minSpan / diag;
		}
		return scale;
	}
}

registerActuator("spanclamp", SpanClampActuator, true);

/**
 * @class ZoomYawSnapActuator
 * @inherits Actuator
 *
 * Zoom & yaw snap actuator.
 *
 * Zoom snap works whenever there's raster stuff in the map
 * (`TileLoader`s, `ConformalRaster`s, etc) in the map: it will snap the scale
 * so that it matches that of the raster (when the scales are close enough)
 *
 * Yaw snap acts whenever the yaw rotation angle is too close to the target
 * angle. Its main purpose is to lock the
 */

class ZoomYawSnapActuator {
	/**
	 * @constructor ZoomYawSnapActuator(map: GleoMap)
	 */
	constructor(map) {
		this.map = map;

		/**
		 * @class GleoMap
		 * @section Interaction behaviour options
		 * @option zoomSnapFactor: Number = 0.5
		 * Whether the map's scale will snap to the native scale of raster symbols
		 * (`ConformalRaster`s and `RasterTileLoader`s) in the map.
		 *
		 * The value is the snap threshold, expressed in terms of the difference between
		 * the base-2 logarithms of the requested scale and the raster's scale.
		 *
		 * For a tile pyramid with power-of-two scales per level (i.e. the
		 * scale of a level is double the scale of the previous level and half
		 * of the next level), the default threshold value of of `0.5` will
		 * always snap between pyramid levels.
		 *
		 * This option depends on `ZoomYawSnapActuator`.
		 *
		 * @option yawSnapTarget: Number = 0
		 * The target yaw snap angle (in decimal degrees, clockwise). The yaw
		 * snap logic will only trigger when the yaw is set to a value close
		 * to this target.
		 *
		 * @option yawSnapPeriod: Number = 90
		 * When set to a finite value less than 360, allows for multiple values
		 * of the snap target, separated by this value. The default means that
		 * the yaw will snap to either `0`, `90`, `180` or `270` degrees, if the
		 * requested yaw is close to any of these values.
		 *
		 * @option yawSnapTolerance: Number = 10
		 * The maximum difference (in decimal degrees) between the requested
		 * yaw and the target yaw to trigger the snap logic.
		 *
		 * @option zoomSnapOnlyOnYawSnap: Boolean = false
		 * By default, zoom snaps occur regardless of the yaw. When this is
		 * set to `true`, zoom snaps will only happen when the yaw is snapped.
		 *
		 * @section Interaction behaviour properties
		 * @property zoonSnapFactor
		 * Runtime value for the `zoomSpanFactor` option. Updating its value will affect future zoom operations.
		 * @property yawSnapTarget
		 * Runtime value for the `yawSnapTarget` option. Updating its value will
		 * affect future yaw operations.
		 * @property yawSnapPeriod
		 * Runtime value for the `yawSnapTarget` option. Updating its value will
		 * affect future yaw operations.
		 * @property yawSnapTolerance
		 * Runtime value for the `yawSnapTarget` option. Updating its value will
		 * affect future yaw operations.
		 * @property zoomSnapOnlyOnYawSnap
		 * Runtime value for the `yawSnapTarget` option. Updating its value will
		 * affect future yaw operations.
		 */
		map.zoomSnapFactor ??= map.options.zoomSnapFactor ?? 0.5;
		map.yawSnapTarget ??= map.options.yawSpanTarget ?? 0;
		map.yawSnapPeriod ??= map.options.yawSnapPeriod ?? 90;
		map.yawSnapTolerance ??= map.options.yawSnapTolerance ?? 10;
		map.zoomSnapOnlyOnYawSnap ??= map.options.zoomSnapOnlyOnYawSnap ?? false;

		this.boundFilter = this.zoomSnapFilterSetView.bind(this);
	}

	enable() {
		this.map.registerSetViewFilter(this.boundFilter);
	}

	disable() {
		this.map.unregisterSetViewFilter(this.boundFilter);
	}

	zoomSnapFilterSetView({
		yawDegrees,
		yawRadians,
		zoomSnap = true,
		yawSnap = true,
		...opts
	}) {
		const map = this.map;
		/**
		 * @miniclass SetView Options (Platina)
		 * @option zoomSnap: Boolean = true
		 * When explicitly set to `false`, the zoom snapping logic is disabled:
		 * the scale level of the map will *not* snap to the raster data for
		 * that `setView` call.
		 * @option yawSnap: Boolean = true
		 * When explicitly set to `false`, the yaw snap logic is disabled
		 * for that `setView` call.
		 */
		if (yawDegrees === undefined && yawRadians !== undefined) {
			yawDegrees = (-yawRadians * 180) / Math.PI;
		}

		if (yawDegrees !== undefined && yawSnap) {
			let snapped = false;

			const p = map.yawSnapPeriod;
			let y = yawDegrees;
			// As per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder
			y = ((yawDegrees % p) + p) % p;

			if (y < map.yawSnapTolerance) {
				snapped = true;
				yawDegrees -= y;
			} else if (y + map.yawSnapTolerance > p) {
				snapped = true;
				yawDegrees += p - y;
			}

			if (!snapped && map.zoomSnapOnlyOnYawSnap) {
				return { yawDegrees, yawRadians, ...opts };
			}
		}

		if (!zoomSnap) {
			return { yawDegrees, ...opts };
		} else if (opts.scale !== undefined) {
			return {
				...opts,
				scale: this.snapScale(opts.scale),
				yawDegrees,
			};
		} else if (opts.span !== undefined) {
			const [w, h] = this.map.platina.pxSize;
			const diag = Math.sqrt(w * w + h * h);

			return {
				...opts,
				span: undefined,
				scale: this.snapScale(opts.span / diag),
				yawDegrees,
			};
		} else {
			return { yawDegrees, ...opts };
		}
	}

	/**
	 * @class ZoomYawSnapActuator
	 * @section Scale and pixel fidelity methods
	 * @method snapScale(scale: Number): Number
	 *
	 * Runs the scale snap logic on the given value: returns the nearest scale snap point,
	 * if the given scale is within the `zoomSnapFactor` tolerance.
	 */
	snapScale(scale) {
		const [w, h] = this.map.platina.pxSize;
		const diag = Math.sqrt(w * w + h * h);
		const minSpan = this.map.minSpan ?? this.map.crs.minSpan;
		const maxSpan = this.map.maxSpan ?? this.map.crs.maxSpan;

		const stops = this.map.platina.getScaleStops(this.map.platina.crs.name);

		const scaleLog = Math.log2(scale);
		// Log2 between the (so-far) closest scale and the target one.
		let closestLog2 = Infinity;
		let closestScale;

		stops.forEach((stop) => {
			const stopSpan = stop * diag;
			if (minSpan && stopSpan < minSpan) {
				return;
			}
			if (maxSpan && stopSpan > maxSpan) {
				return;
			}

			const deltaLog = Math.abs(scaleLog - Math.log2(stop));
			if (deltaLog <= this.map.zoomSnapFactor && deltaLog < closestLog2) {
				closestLog2 = deltaLog;
				closestScale = stop;
			}
		});

		return closestScale !== undefined ? closestScale : scale;
	}
}

registerActuator("zoomsnap", ZoomYawSnapActuator, true);

/**
 * @class BoundsClampActuator
 * @inherits Actuator
 *
 * Bounds clamping actuator. Forces the values of the center so that the it's
 * always within a bounding box - either ehe CRS's `viewableBounds` or a set
 * of user-defined `maxBounds`.
 */

class BoundsClampActuator {
	/**
	 * @constructor BoundsClampActuator(map: GleoMap)
	 */
	constructor(map) {
		this.map = map;
		this.#boundFilter = this.boundsClampFilterSetView.bind(this);

		/**
		 * @class GleoMap
		 * @section Interaction behaviour options
		 * @option maxBounds: Array of Number
		 * An array of the form `[minX, minY, maxX, maxY]` defining a bounding
		 * box, **in CRS units**. User interactions will be constrained to this
		 * bounding box.
		 *
		 * This option depends on `BoundsClampActuator` being loaded.
		 * @alternative
		 * @option maxBounds: undefined = undefined
		 * Setting `maxBounds` to `undefined` (or any falsy value) will make
		 * the `BoundsClampActuator` use the CRS's `viewableBounds` default
		 * instead.
		 *
		 * This is the default.
		 * @section Interaction behaviour properties
		 * @property maxBounds
		 * Runtime value of the `maxBounds` initialization option.
		 *
		 * Updating its value will affect future map panning operations.
		 */
		this.map.maxBounds ??= this.map.options.maxBounds;
	}

	#boundFilter;

	enable() {
		this.map.registerSetViewFilter(this.#boundFilter);
	}

	disable() {
		this.map.unregisterSetViewFilter(this.#boundFilter);
	}

	boundsClampFilterSetView({ center, ...opts }) {
		if (center === undefined) {
			return opts;
		}

		return {
			...opts,
			center: this.clampView(
				center,
				opts.scale ?? this.map.scale,
				this.map.platina.pxSize
			),
		};
	}

	clampView(center, scale, pxSize) {
		const [x1, y1, x2, y2] = this.map.maxBounds ?? center.crs.viewableBounds;
		let [x, y] = center.crs.offsetToBase(center.coords);
		const [w, h] = pxSize;

		const left = x - (scale * w) / 2;
		const right = x + (scale * w) / 2;
		const top = y + (scale * h) / 2;
		const bottom = y - (scale * h) / 2;

		if (isFinite(y2 - y1) && top - bottom > y2 - y1) {
			y = (y2 + y1) / 2;
		} else {
			const overTop = Math.max(0, top - y2);
			const overBottom = Math.min(0, bottom - y1);
			if (isFinite(overTop)) {
				y -= overTop;
			}
			if (isFinite(overBottom)) {
				y -= overBottom;
			}
		}

		if (isFinite(x2 - x1) && right - left > x2 - x1) {
			x = (x2 + x1) / 2;
		} else {
			const overRight = Math.max(0, right - x2);
			const overLeft = Math.min(0, left - x1);
			if (isFinite(overRight)) {
				x -= overRight;
			}
			if (isFinite(overLeft)) {
				x -= overLeft;
			}
		}

		return new Geometry(center.crs, center.crs.offsetFromBase([x, y]), {
			wrap: center.wrap,
		});
	}
}

registerActuator("boundsclamp", BoundsClampActuator, true);

css(`
.gleo-control {
	display: block;
}
`);

/**
 * @class Control
 * @inherits Evented
 *
 * Abstract UI control.
 */

class Control extends Evented {
	/**
	 * @constructor Control(opts: Control options)
	 */
	constructor({ position = "tl" } = {}) {
		/**
		 * @option position: String
		 * One of `tl`, `tr`, `bl`, `br`. Indicates which corner of the map the
		 * control should be added to.
		 * @alternative
		 * @option position: HTMLElement
		 * Indicates that the `Control` should be added to the given HTML element.
		 * This allows for controls outside of the map interface itself.
		 */
		super();
		this.position = position;

		this.spawnElement();
	}

	/**
	 * @section Internal methods
	 * @method spawnElement(): HTMLElement
	 * Sets `this.element` to the appropriate value. Should be overriden by
	 * subclasses.
	 */
	spawnElement() {
		/**
		 * @section GleoMap interface
		 * @property element: HTMLElement
		 * The `HTMLElement` for the whole control. Should be treated as read-only.
		 */
		this.element = document.createElement("div");
		this.element.className = "gleo-control";
	}

	/**
	 * @section
	 * @method addTo(map: GleoMap): this
	 * Attaches the `Control` to the map, and appends the control's HTML element
	 * to the appropriate container.
	 */
	addTo(map) {
		if (this.position instanceof HTMLElement) {
			this.parent = this.position;
		} else {
			this.parent = map.controlPositions.get(this.position);
			if (!this.parent) {
				throw new Error("The gleo map control has no valid position/container");
			}
		}
		this.parent.appendChild(this.element);
		this._map = map;
		return this;
	}

	/**
	 * @method remove(): this
	 * Detaches the control from the map, and removes the HTML element from the DOM.
	 */
	remove() {
		this.parent.removeChild(this.element);
		this.parent = undefined;
		this._map = undefined;
	}
}

css(`
.gleo-buttongroup {
	display: flex;
	min-width: 3em;
	min-height: 3em;
}
.gleo-buttongroup.vertical { flex-direction: column }
.gleo-buttongroup.horizontal { flex-direction: row }
.gleo-controlcorner > .gleo-buttongroup {
	margin: 0.5em;
}
.gleo-buttongroup.vertical > button.gleo-control,
.gleo-buttongroup.vertical > div.gleo-control > button.gleo-control
{
	border-bottom-width: 0.1875em;
	border-top-width: 0.1875em;
	border-radius: 0;
}
.gleo-buttongroup.vertical > button.gleo-control:first-child,
.gleo-buttongroup.vertical > div.gleo-control:first-child > button
{
	border-top-right-radius: 0.75em;
	border-top-left-radius: 0.75em;
	border-top-width: 0.375em;
}
.gleo-buttongroup.vertical > button.gleo-control:last-child,
.gleo-buttongroup.vertical > div.gleo-control:last-child > button {
	border-bottom-right-radius: 0.75em;
	border-bottom-left-radius: 0.75em;
	border-bottom-width: 0.375em;
}
.gleo-buttongroup.horizontal > button.gleo-control {
	border-left-width: 0.1875em;
	border-right-width: 0.1875em;
	border-radius: 0;
}
.gleo-buttongroup.horizontal > button.gleo-control:first-child {
	border-top-left-radius: 0.75em;
	border-bottom-left-radius: 0.75em;
	border-left-width: 0.375em;
}
.gleo-buttongroup.horizontal > button.gleo-control:last-child {
	border-top-right-radius: 0.75em;
	border-bottom-right-radius: 0.75em;
	border-right-width: 0.375em;
}
`);

/**
 * @class ButtonGroup
 * @inherits Control
 * @relationship compositionOf Button, 0..1, 0..n
 *
 * A control for nesting `Button` controls inside.
 */
class ButtonGroup extends Control {
	constructor({
		// @option direction: String = 'vertical'
		// Whether the nested buttons align horizontally or vertically. Valid
		// values are `"horizontal"` and `"vertical"`.
		direction = "vertical",
		// @option buttons: Array of Button = []
		// The initial set of `Button` controls to be in this group.
		buttons = [],
		...opts
	}) {
		super(opts);

		this.buttons = buttons;
		this.element.classList.add("gleo-buttongroup");
		if (direction === "vertical") {
			this.element.classList.add("vertical");
		} else {
			this.element.classList.add("horizontal");
		}
	}

	addTo(map) {
		this.buttons.forEach((button) => {
			button.position = this.element;
			button.addTo(map);
		});
		super.addTo(map);
	}

	remove() {
		this.buttons.forEach((button) => button.remove());
	}
}

css(`
button.gleo-control {
	display: block;
	width: 3em;
	height: 3em;
	border-radius: 0.75em;
	border: #888 solid 0.375em;
	padding: 0;
}
.gleo-controlcorner > button.gleo-control {
	margin: 0.5em;
}

button.gleo-control > svg {
	vertical-align: middle;
}

button.gleo-control:active {
	inset 0 0px 7px 3px #1b74ff;
}
`);

/**
 * @class Button
 * @inherits Control
 * A single UI button.
 */
class Button extends Control {
	constructor({
		/**
		 * @option string: String
		 * The (text) label to be shown inside the button.
		 */
		string,

		/**
		 * @option svgString: String
		 * The icon for the button, as a string containing a SVG document.
		 * Mutually exclusive with `string`.
		 */
		svgString,

		/**
		 * @option title: String
		 * The text for the [`title` HTML attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
		 * of the button.
		 */
		title,
		...opts
	} = {}) {
		super(opts);
		if (string) {
			this.button.innerText = string;
		}

		if (svgString) {
			this.button.innerHTML = svgString;
		}

		if (title) {
			this.button.title = title;
		}
	}
	spawnElement() {
		this.element = this.button = document.createElement("button");
		this.button.className = "gleo-control";

		// TODO: ARIA stuff.
	}

	/**
	 * @section Button event handlers
	 * @method on(eventName: String, handler: Function): this
	 * Alias to `addEventListener`.
	 * @method off(eventName: String, handler: Function): this
	 * Alias to `removeEventListener`.
	 */
	on() {
		return this.addEventListener.apply(this, arguments);
	}
	off() {
		return this.removeEventListener.apply(this, arguments);
	}

	/**
	 * @method addEventListener(eventName: String, handler: Function): this
	 * Attaches an event handler to a DOM event of the `HTMLButtonElement` for
	 * the control.
	 */
	addEventListener(eventName, handler) {
		this.button.addEventListener(eventName, handler);
		return this;
	}

	/**
	 * @method addEventListener(eventName: String, handler: Function): this
	 * Detaches an event handler to a DOM event from the `HTMLButtonElement` for
	 * the control.
	 */
	removeEventListener(eventName, handler) {
		this.button.removeEventListener(eventName, handler);
		return this;
	}

	// TODO: disable, enable.
	// TODO: focus, blur
	// TODO: keyboard accesibility (keydown/up for space & enter)
	// TODO: Wrap keyboard & pointer events (i.e. fire "pressstart", "pressend")
}

/**
 * @class ZoomButton
 * @inherits Button
 * Common "Zoom In"/"Zoom Out" button functionality.
 */

class ZoomButton extends Button {
	constructor(opts) {
		super(opts);

		this._boundOnPointerDown = this._onPointerDown.bind(this);
		this._boundOnPointerUp = this._onPointerUp.bind(this);
		this._boundOnFrame = this._onFrame.bind(this);
		this.animFrame = undefined;
		this.lastTimestamp = undefined;
		this.initialScale = undefined;
	}

	addTo(map) {
		super.addTo(map);
		this.on("pointerdown", this._boundOnPointerDown);
		this.on("pointerup", this._boundOnPointerUp);
		this.on("pointercancel", this._boundOnPointerUp);
		// 		this.on('pointerleave', this._boundOnPointerUp);
	}

	remove() {
		this.off("pointerdown", this._boundOnPointerDown);
		this.off("pointerup", this._boundOnPointerUp);
		this.off("pointercancel", this._boundOnPointerUp);
		// 		this.off('pointerleave', this._boundOnPointerUp);
	}

	_onPointerDown(ev) {
		this.lastTimestamp = performance.now();
		this.initialScale = this._map.scale;
		this.animFrame = window.requestAnimationFrame(this._boundOnFrame);
		this.element.setPointerCapture(ev.pointerId);
	}
	_onPointerUp(ev) {
		const millisecs = Math.max(performance.now() - this.lastTimestamp, 500);
		const factor = Math.pow(this.scaleFactorPerSecond, millisecs / 1000);
		this._map.setView({
			scale: this.initialScale * factor,
			duration: Math.max(1000 - millisecs, 100),
			center: this._map.center,
		});
		window.cancelAnimationFrame(this.animFrame);
		this.element.releasePointerCapture(ev.pointerId);
	}
	_onFrame() {
		const now = performance.now();
		const secs = (now - this.lastTimestamp) / 1000;

		const factor = Math.pow(this.scaleFactorPerSecond, secs);

		this._map.setView({
			scale: this.initialScale * factor,
			duration: 100,
			zoomSnap: false,
		});
		this.animFrame = window.requestAnimationFrame(this._boundOnFrame);
	}
}

/**
 * @class ZoomIn
 * @inherits ZoomButton
 * A "Zoom In" button.
 */

class ZoomIn extends ZoomButton {
	constructor(opts) {
		super({
			svgString: `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><path style="fill:#464646;stroke:none;stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;fill-opacity:1" d="M11 2h2v9h9v2h-9v9h-2v-9H2v-2h9z"/></svg>`,
			title: "Zoom in",
			...opts,
		});

		this.scaleFactorPerSecond = 1 / 4;
	}
}

/**
 * @class ZoomOut
 * @inherits ZoomButton
 * A "Zoom Out" button.
 */

class ZoomOut extends ZoomButton {
	constructor(opts) {
		super({
			svgString: `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><path style="fill:none;stroke:#464646;stroke-width:2;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;stroke-dasharray:none" d="M2 12h20"/></svg>`,
			title: "Zoom out",
			...opts,
		});

		this.scaleFactorPerSecond = 4;
	}
}

/**
 * @class ZoomInOut
 * @inherits ButtonGroup
 * @relationship compositionOf ZoomIn, 0..1, 1..1
 * @relationship compositionOf ZoomOut, 0..1, 1..1
 *
 * A group of two `Button`s: one for zooming in, one for zooming out.
 */
class ZoomInOut extends ButtonGroup {
	constructor({ direction = "vertical", ...opts } = {}) {
		super({
			direction,
			buttons: [new ZoomIn(), new ZoomOut()],
			...opts,
		});
	}
}

const invSqrt2 = 0.5 / Math.sqrt(2);

css(`
.gleo-control-scalebar {
	background: #ccc;
	padding: 0.25em;
}

.gleo-control-scalebar .gleo-scale {
	border-bottom: 0.2em solid black;
	border-left: 0.2em solid black;
	border-right: 0.2em solid black;
	text-align: center;
	box-sizing: border-box;
}
`);

/**
 * @class ScaleBar
 * @inherits Control
 * An informative scale bar control.
 */
class ScaleBar extends Control {
	/**
	 * @constructor ScaleBar(opts: Scalebar Options)
	 */
	constructor({
		/**
		 * @section Scalebar Options
		 * @option maxSize: Number = 100
		 * Maximum size, in CSS pixels, of the scalebar line.
		 */
		maxSize = 200,
		position = "bl",
		...opts
	} = {}) {
		super({ position, ...opts });

		/// TODO: init options:
		/// - units of measurement (meters, nautical, unitless, etc)

		this._boundOnViewChange = this.onViewChange.bind(this);
		this._maxSize = maxSize;
	}

	spawnElement() {
		this.element = document.createElement("div");
		this.element.className = "gleo-control gleo-control-scalebar";

		this._scaleElement = document.createElement("div");
		this._scaleElement.className = "gleo-scale";
		this.element.appendChild(this._scaleElement);
	}

	addTo(map) {
		super.addTo(map);
		map.on("viewchanged", this._boundOnViewChange);
	}

	remove() {
		super.remove();
		this._map.off("viewchanged", this._boundOnViewChange);
	}

	onViewChange(ev) {
		const p = this._map.platina;
		const [w, h] = p.pxSize;
		const w2 = w / 2,
			h2 = h / 2;

		// The idea is to measure not the distance from a pixel to the next,
		// but rather the length of a line as long as the maximum scalebar size,
		// around the platina's center.
		// This is a best-effort approach to providing a reliable measure at
		// low scales. There'll be artifacts with specific projections at yaw 45°,
		// but hopefully won't be much of a problem.
		const offset = this._maxSize * invSqrt2;
		const geom1 = p.pxToGeom([w2 - offset, h2 - offset]);
		const geom2 = p.pxToGeom([w2 + offset, h2 + offset]);

		let pxDistance = p.crs.distance(geom1, geom2);

		let unit = "m";
		if (pxDistance >= 1e3) {
			unit = "km";
			pxDistance /= 1e3;
		}

		let clampedDistance = Math.pow(10, Math.floor(Math.log10(pxDistance)));
		if (clampedDistance * 5 < pxDistance) {
			clampedDistance *= 5;
		} else if (clampedDistance * 2 < pxDistance) {
			clampedDistance *= 2;
		}

		if (Number.isFinite(clampedDistance)) {
			this._scaleElement.innerText = `${clampedDistance}${unit}`;
			this._scaleElement.style.width =
				(this._maxSize * clampedDistance) / pxDistance + "px";
		} else {
			this._scaleElement.innerText = `N/A`;
			this._scaleElement.style.width = this._maxSize + "px";
		}
	}
}

css(`
.gleo-control-attribution {
	background: #ccc;
	padding: 0.25em;
}
`);

/**
 * @class Attribution
 * @inherits Control
 * An informative attribution control. It shall display HTML text (with links)
 * based on the `attribution` option of `GleoSymbol`s added to the map.
 */
class Attribution extends Control {
	/**
	 * @constructor Attribution(opts: Attribution Options)
	 */
	constructor({
		/**
		 * @section Attribution Options
		 * @option separator: String = ' | '
		 * A string to separate different attributions
		 */
		separator = " | ",
		/**
		 * @option prefix: String = 'Gleo'
		 * A prefixed attribution that shall always be present irrespective of
		 * symbols in the map.
		 */
		prefix = "<a href='https://gitlab.com/IvanSanchez/gleo/' target=_blank>Gleo</a>",
		position = "br",
		...opts
	} = {}) {
		super({ position, ...opts });

		this._separator = separator;
		this._prefix = prefix;

		this._boundOnAcetateAdd = this._onAcetateAdd.bind(this);
		this._boundOnSymbolAdd = this._onSymbolAdd.bind(this);
		this._boundOnSymbolRemove = this._onSymbolRemove.bind(this);
		this._boundOnLoaderAdd = this._onLoaderAdd.bind(this);
		this._boundOnLoaderRemove = this._onLoaderRemove.bind(this);

		this.counter = new Map();
	}

	spawnElement() {
		this.element = document.createElement("div");
		this.element.className = "gleo-control gleo-control-attribution";
	}

	addTo(map) {
		super.addTo(map);
		map.on("acetateadded", this._boundOnAcetateAdd);
		map.on("symbolsadded", this._boundOnSymbolAdd);
		map.on("symbolsremoved", this._boundOnSymbolRemove);
		map.on("loaderadded", this._boundOnLoaderAdd);
		map.on("loaderremoved", this._boundOnLoaderRemove);

		/// TODO: Should fetch all of the map's loaders and symbols
		/// and calculate the initial attribution
	}

	remove() {
		super.remove();
		this._map.off("acetateadded", this._boundOnAcetateAdd);
		this._map.off("symbolsadded", this._boundOnSymbolAdd);
		this._map.off("symbolsremoved", this._boundOnSymbolRemoved);
		this._map.off("loaderadded", this._boundOnLoaderAdd);
		this._map.off("loaderremoved", this._boundOnLoaderRemove);
	}

	_onAcetateAdd(ev) {
		// this._onAdd(ev.detail.symbols.map((s) => s.attribution));
		// console.log("Attribution acetateadded", ev.detail.constructor.name, ev.detail.attribution);
		ev.detail.attribution && this._onAdd([ev.detail.attribution]);
	}
	_onSymbolAdd(ev) {
		this._onAdd(ev.detail.symbols.map((s) => s.attribution));
	}
	_onSymbolRemove(ev) {
		this._onRemove(ev.detail.symbols.map((s) => s.attribution));
	}
	_onLoaderAdd(ev) {
		this._onAdd([ev.detail.loader.attribution]);
	}
	_onLoaderRemove(ev) {
		this._onRemove([ev.detail.loader.attribution]);
	}

	_onAdd(attributions) {
		let mustUpdate = false;

		attributions
			.filter((a) => !!a)
			.forEach((a) => {
				const c = this.counter.get(a) || 0;
				if (!c) {
					mustUpdate = true;
				}
				this.counter.set(a, c + 1);
			});

		if (mustUpdate) {
			this._update();
		}
	}

	_onRemove(attributions) {
		let mustUpdate = false;

		attributions
			.filter((a) => !!a)
			.forEach((a) => {
				const c = this.counter.get(a);
				// Might fail if a symbol/loader updates its attribution without notifying it
				if (!c) {
					// throw new Error("Removed an unknown attribution");
					console.warn("Removed an unknown attribution", a);
				}
				if (c === 1) {
					this.counter.delete(a);
					mustUpdate = true;
				} else {
					this.counter.set(a, c - 1);
				}
			});

		if (mustUpdate) {
			this._update();
		}
	}

	_update() {
		this.element.innerHTML = [this._prefix]
			.concat(Array.from(this.counter.keys()))
			.join(this._separator);
	}
}

/**
 * @class LngLat
 * @inherits Geometry
 * @relationship dependsOn epsg4326, 0..n, 1..1
 *
 * A `Geometry` of longitude-latitude coordinates, assuming EPSG:4326.
 *
 * Note that the order of the axis is longitude-latitude, or x-y: `new LngLat([180, 90])`
 * is equivalent to `new Coord(epsg4326, [180, 90])`.
 *
 * The issue of the order of the axis might be confusing. See also `LatLng` and
 * https://macwright.com/lonlat/ .
 */

class LngLat extends Geometry {
	/**
	 * @constructor LngLat(xy: Array of Number)
	 */
	constructor(xy, opts) {
		super(epsg4326, xy, opts);
	}
}

/**
 * @class LatLng
 * @inherits LngLat
 *
 * A `Geometry` of latitude-longitude coordinates, assuming EPSG:4326.
 *
 * Note that the order of the axis is inverted: `new LatLng([90, 180])`
 * is equivalent to `new Geometry(epsg4326, [180, 90])`.
 *
 * The issue of the order of the axis might be confusing. See also `LatLng` and
 * https://macwright.com/lonlat/ .
 */

class LatLng extends LngLat {
	/**
	 * @constructor LatLng(xy: Array of Number, opts?: Geometry Options)
	 */
	constructor(yx, opts) {
		const xy = flip(yx);
		super(xy, opts);
	}
}

function flip(arr) {
	if (typeof arr[0] === "number") {
		return [arr[1], arr[0]];
	} else {
		return arr.map(flip);
	}
}

/**
 * @class MercatorMap
 * @inherits GleoMap
 *
 * A `GleoMap` with some useful defaults:
 * - Defaults to Web Mercator CRS (`epsg3857`)
 * - Sets a `maxSpan` of 45 million (mainly to prevent users zooming out far
 *   enough to see horizontal bands above 85° / below -85° when zooming), can
 *   be overridden
 * - Enables some actuators by default:
 *   - `DragActuator` to move the map with a drag-and-drop interaction.
 *   - `PinchActuator` to zoom/rotate the map with two-finger gestures.
 *   - `InertiaActuator` to perform animations on view change.
 *   - `WheelActuator` to zoom in/out with a mouse wheel.
 *   - `ZoomYawSnapActuator` to lock onto the "zoom levels" of the map tiles.
 *   - `SpanClampActuator` to prevent the user from zooming too far in or too far out.
 *   - `BoundsClampActuator` to prevent the user from moving too far north or too far south.
 * - Adds some controls to the map:
 *   - `ZoomInOut` buttons
 *   - `ScaleBar`
 *   - `Attribution`
 * - All methods that take `Geometry`s as input can take arrays of the form
 *   `[lat, lng]` instead, as per `LatLng` (via `DefaultGeometry`).
 *
 * In order to have a map without these defaults, use `GleoMap` instead, add
 * CRS, actuators, and controls as desired; and use `DefaultGeometry` functionality
 * to define how to handle geometry inputs.
 *
 * @example
 *
 * ```
 * <div id='gleomap' style='height:500px; width:500px;'></div>
 * <script type='module'>
 * // Import the Gleo files - the paths depend on your importmaps and/or installation
 * import MercatorMap from 'gleo/src/MercatorMap.mjs';
 * import MercatorTiles from 'gleo/src/loaders/MercatorTiles.mjs';
 *
 * // Instantiate the MercatorMap instance, given the ID of the <div>
 * const myGleoMap = new MercatorMap('gleomap');
 *
 * // Load some default OpenStreetMap tiles in the map
 * new MercatorTiles("https://tile.osm.org/{z}/{y}/{x}.png", {maxZoom: 10}).addTo(myGleoMap);
 *
 * // The map center can be specified as a plain array in [latitude, longitude] form
 * myGleoMap.center = [40, -3];
 *
 * // The map span is the length of the map's diagonal in "meters"
 * myGleoMap.span = 1000000;
 * </script>
 * ```
 */

class MercatorMap extends GleoMap {
	/**
	 * @constructor MercatorMap(div: HTMLDivElement, options: GleoMap Options)
	 * @alternative
	 * @constructor MercatorMap(divID: string, options: GleoMap Options)
	 */
	constructor(container, { ...options } = {}) {
		super(container, { crs: epsg3857, ...options });

		new ZoomInOut().addTo(this);
		new ScaleBar().addTo(this);
		new Attribution().addTo(this);
	}
}

setFactory(function latLngize(coords, opts) {
	return new LatLng(coords, opts);
});

/**
 *
 * @class TileEvent
 * @inherits Event
 *
 * A `TileLoader`'s events are of this type, and include information about the tile
 * in question.
 *
 *
 * @example
 *
 * ```js
 * loader.on('tileload', function(ev) {
 * 	console.log(ev.tileLevel);
 * });
 *
 * ```
 *
 * @property tileLevel: String
 * The level of the tile pyramid the tile is in.
 *
 * @property tileX: Number
 * The X coordinate of the tile, relative to its level.
 *
 * @property tileY: Number
 * The Y coordinate of the tile, relative to its level.
 *
 * @property tile: HTMLImageElement
 * The image for the tile.
 *
 * @property error: String
 * The cause of a `tileerror` event.
 *
 */

class TileEvent extends Event {
	constructor(type, init) {
		super(type, init);
		this.tileLevel = init.tileLevel;
		this.tileX = init.tileX;
		this.tileY = init.tileY;
		this.tile = init.tile;
		this.error = init.error;
	}
}

/**
 * @class AbstractTileLoader
 * @inherits Loader
 *
 * @relationship association TileEvent, 1..1, 0..n
 *
 * Functionality common to `RasterTileLoader` and `AbstractVectorTileLoader`.
 *
 * A `AbstractTileLoader` watches for changes in the map's viewport and
 * loads/unloads/overwrites raster/vector tiles.
 */
class AbstractTileLoader extends Loader {
	#pyramid;
	// #boundOnViewChange;
	//#tileFn;

	// Pyramid level that was the best fit for the platina's scale during the
	// last viewchange event
	#lastLevel;

	// Tile range fitting the last viewchange event
	#lastRange = [NaN, NaN, NaN, NaN];

	/**
	 * @constructor GenericVectorTileLoader(pyramid: TilePyramid, opts: GenericVectorTileLoader Options, tileWrapX: Number, tileWrapY: Number)
	 */
	constructor(pyramid, { ...opts } = {}) {
		super(opts);
		this.#pyramid = pyramid;
		this._boundOnViewChange = this.#onViewChange.bind(this);
	}

	/**
	 * @property pyramid: TilePyramid
	 * The tile pyramid used. Read-only.
	 */
	get pyramid() {
		return this.#pyramid;
	}

	/**
	 * @property currentLevel: String
	 * The name of the level of the pyramid currently active (the one best
	 * fitting the map/platina's scale). Read-only.
	 */
	get currentLevel() {
		return this.#lastLevel;
	}

	/**
	 * @property currentRange: Array of Number
	 * An array of the form `[minX, minY, maxX, maxY]` containing the range
	 * of tile XY coordinates which cover the current map/platina viewport.
	 * Read-only.
	 */
	get currentRange() {
		return this.#lastRange;
	}

	addTo(target) {
		super.addTo(target);
		this.platina.on("viewchanged", this._boundOnViewChange);
	}

	remove() {
		this.platina.off("viewchanged", this._boundOnViewChange);

		super.remove();
		this.#lastRange = [NaN, NaN, NaN, NaN];

		/// TODO: remove all symbols. Subclasses are best equipped to deal with that.
		return this;
	}

	_getVisibleRange(level) {
		/// TODO: PROJECT THE BBOX TO THE PYRAMID CRS!!!!!!!
		const mapBBox = this.platina.bbox;
		const crs = this.platina.crs;
		const bbox = crs
			.offsetToBase([mapBBox.minX, mapBBox.minY])
			.concat(crs.offsetToBase([mapBBox.maxX, mapBBox.maxY]));
		const range = this.#pyramid.bboxToTileRange(level, bbox);
		return range;
	}

	/**
	 * @section Extension methods
	 * @uninheritable
	 * @method _isTileWithinRange(x: Number, y: Number, minX: Number, minY: Number, maxX: Number, maxY: Number, spanX: Number, spanY: Number): Boolean
	 * Can (and should) be used by implementations to check whether a set
	 * of `x`, `y` tile coordinates are within the given tile range with
	 * the given tile span.
	 * Tile ranges are assumed to be minimum-inclusive but maximum exclusive,
	 * i.e. `[min, max)`
	 */
	_isTileWithinRange(x, y, minX, minY, maxX, maxY, spanX, spanY) {
		return (
			(maxX > spanX ? x >= minX || x < maxX % spanX : x >= minX && x < maxX) &&
			(maxY > spanY ? y >= minY || y < maxY % spanY : y >= minY && y < maxY)
		);
	}

	#onViewChange(ev) {
		const level = this.#pyramid.nearestLevel(this.platina.scale);
		if (level === undefined) {
			// Happens when the platina doesn't have a scale set (yet)
			return;
		}
		const range = this._getVisibleRange(level);

		if (level !== this.#lastLevel && this.#lastLevel !== undefined) {
			/// If there has been a level change, (try to) abort all
			/// tiles from the outgoing level

			/**
			 * @section Extension methods
			 * @uninheritable
			 * @method _abortLevel(level:String): undefined
			 * Must be provided by raster and vector implementations. Should
			 * (try to) abort all pending `Promise`s for the given level.
			 */
			this._abortLevel(this.#lastLevel);

			this.#lastRange = [NaN, NaN, NaN, NaN];
		}

		if (this.#lastRange.every((v, i) => v === range[i])) {
			return;
		}

		const [minX, minY, maxX, maxY] = range;

		/**
		 * @section
		 * @event rangechange: Event
		 * Fired whenever the visible tiles (the "tile range") have changed.
		 * Not every change in the viewport triggers a range change.
		 */
		this.fire("rangechange", {
			level,
			minX,
			minY,
			maxX,
			maxY,
		});

		/**
		 * @section Extension methods
		 * @uninheritable
		 * @method _onRangeChange(level:String, minX: Number, minY: Number, maxX: Number, maxY: Number, levelChange: Boolean): undefined
		 * Must be provided by raster and vector implementations.
		 * Called whenever a `rangechange` event occurs. Implementations should
		 * (a) abort tiles outside the range and (b) load tiles inside the range,
		 * all according to their caching algorithm.
		 */
		this._onRangeChange(level, minX, minY, maxX, maxY, level !== this.#lastLevel);

		this.#lastLevel = level;
		this.#lastRange = range;
	}

	/**
	 * @section Extension methods
	 * @uninheritable
	 * @method _onTileLoad(level: String, x: Number, y: Number, tile: *): undefined
	 * Should be called when a tile loads. The abstract implementation will
	 * only fire a `tileload` event and trigger a redraw.
	 */
	_onTileLoad(level, x, y, tile) {
		/**
		 * @section
		 * @event tileload: TileEvent
		 * Dispatched when a tile loads.
		 */
		this.dispatchEvent(
			new TileEvent("tileload", {
				tileLevel: level,
				tileX: x,
				tileY: y,
				tile: tile,
			})
		);
	}

	/**
	 * @section Extension methods
	 * @uninheritable
	 * @method _onTileError(level: String, x: Number, y: Number, tile: *): undefined
	 * Should be called when a tile fails to load. The abstract implementation will
	 * only fire a `tileerror` event.
	 */
	_onTileError(level, x, y, err) {
		/**
		 * @section
		 * @event tileerror: TileEvent
		 * Dispatched when a tile failed to load.
		 */
		this.dispatchEvent(
			new TileEvent("tileerror", {
				tileLevel: level,
				tileX: x,
				tileY: y,
				error: err,
			})
		);
	}
}

/**
 * @class AcetateVertices
 * @inherits Acetate
 *
 * An abstract `Acetate` that implements multiple vertices per symbol.
 *
 * Most `Acetate`s draw symbols that must be represented by more than one vertex
 * (and typically forming triangles), and should inherit this functionality.
 *
 * The only exception is acetates that do not need vertex indices at all because
 * they do not rely on primitives (i.e. triangles) - the `AcetateDot` being the only
 * instance of such.
 */

class AcetateVertices extends Acetate {
	constructor(glii, opts) {
		super(glii, opts);

		// The SparseIndices allocates *vertex slots* on primitives, e.g.:
		// * 3 slots per triangle, or
		// * 2 slots per line segment
		this._indices = new this.glii.SparseIndices({
			// Glii defaults to UNSIGNED_SHORT, meaning a max of 2^16=65536
			// primitive vertex slots (~32k lines ~21k triangles). It's
			// reasonable to expect more, so this asks for 32-bit
			// pointers, meaning a max of 2^32 primitive slots.
			type: this.glii.UNSIGNED_INT,
		});

		// The attribute allocator allocates *attribute slots*,
		// one per needed vertex (even if that vertex is used several times in several
		// slots to be shared between several triangles/segments/primitives)
		this._attribAllocator = new Allocator();
	}

	glProgramDefinition() {
		const opts = super.glProgramDefinition();
		return {
			...opts,
			indexBuffer: this._indices,
			blend: {
				equationRGB: this.glii.FUNC_ADD,
				equationAlpha: this.glii.FUNC_ADD,

				srcRGB: this.glii.SRC_ALPHA,
				dstRGB: this.glii.ONE_MINUS_SRC_ALPHA,
				srcAlpha: this.glii.ONE,
				dstAlpha: this.glii.ONE_MINUS_SRC_ALPHA,
			},
		};
	}

	/**
	 * @section Internal Methods
	 * @uninheritable
	 * @method reproject(): this
	 * Runs `toCRS` on the coordinates of all known symbols, and (re)sets the values in
	 * the coordinates attribute buffer.
	 */
	reprojectAll() {
		this._attribAllocator.forEachBlock((start, length) => {
			this.reproject(start, length);
		});
		return this;
	}

	_getStridedArrays(_, maxIdx) {
		return [
			// Vertex indices
			this._indices.asTypedArray(maxIdx),
		];
	}

	_getPerPointStridedArrays(maxVtx, maxIdx) {
		return [];
	}

	_commitStridedArrays(_, __, baseIdx, idxCount) {
		this._indices.commit(baseIdx, idxCount);
	}

	_commitPerPointStridedArrays(vtx, vtxCount) {
		// noop
	}

	/**
	 * @method deallocate(symbol: GleoSymbol): this
	 * Deallocate the symbol from this acetate (so it's not drawn on the next refresh)
	 */
	deallocate(symbol) {
		return this.multiDeallocate([symbol]);
	}

	multiAllocate(symbols) {
		// Skip:
		// - Already added symbols
		// - Symbols with zero vertices
		// - Symbols with zero indices/triangles (e.g. one-point strokes)
		symbols = symbols.filter(
			(s) => isNaN(s.attrBase) && s.idxLength > 0 && s.attrLength > 0
		);
		if (symbols.length === 0) {
			return;
		}

		const totalVertices = symbols.reduce((acc, ext) => acc + ext.attrLength, 0);
		const baseVtx = this._attribAllocator.allocateBlock(totalVertices);
		let vtxAcc = baseVtx;

		const totalIndices = symbols.reduce((acc, ext) => acc + ext.idxLength, 0);
		const baseIdx = this._indices.allocateSlots(totalIndices);
		let idxAcc = baseIdx;

		let stridedArrays = this._getStridedArrays(
			baseVtx + totalVertices,
			baseIdx + totalIndices
		);

		symbols.forEach((sym) => {
			sym._inAcetate = this;
			sym.attrBase = vtxAcc;
			sym.idxBase = idxAcc;
			this._knownSymbols[vtxAcc] = sym;

			sym._setGlobalStrides(...stridedArrays);

			vtxAcc += sym.attrLength;
			idxAcc += sym.idxLength;
		});

		this._commitStridedArrays(baseVtx, totalVertices, baseIdx, totalIndices);

		if (this._crs) {
			this.reproject(baseVtx, totalVertices, symbols);
		}

		// The AcetateInteractive functionality will assign IDs to symbol vertices.
		this.multiAddIds?.(symbols, baseVtx, baseVtx + totalVertices);

		this.dirty = true;
		return this;
	}

	multiDeallocate(symbols) {
		symbols = symbols.filter((s) => !!s);
		symbols.sort((a, b) => a.idxBase - b.idxBase);

		if (symbols.length === 0) {
			return this;
		}

		// let attribBlocks = [];
		let blockStart = symbols[0].idxBase,
			blockLength = 0;
		symbols.forEach((symbol) => {
			if (blockStart + blockLength === symbol.idxBase) {
				blockLength += symbol.idxLength;
			} else {
				// attribBlocks.push([ blockStart, blockLength ]);
				this._indices.deallocateSlots(blockStart, blockLength);
				blockStart = symbol.idxBase;
				blockLength = symbol.idxLength;
			}
		});
		this._indices.deallocateSlots(blockStart, blockLength);

		symbols.sort((a, b) => a.attrBase - b.attrBase);

		blockStart = symbols[0].attrBase;
		blockLength = 0;

		symbols.forEach((symbol) => {
			if (blockStart + blockLength === symbol.attrBase) {
				blockLength += symbol.attrLength;
			} else {
				// attribBlocks.push([ blockStart, blockLength ]);
				this._attribAllocator.deallocateBlock(blockStart, blockLength);
				blockStart = symbol.attrBase;
				blockLength = symbol.attrLength;
			}
			delete this._knownSymbols[symbol.attrBase];
			symbol.updateRefs(undefined, undefined, undefined);
		});
		this._attribAllocator.deallocateBlock(blockStart, blockLength);

		// Edge case for the last symbol. See comments on Acetate.multiDeallocate().
		if (!this._knownSymbols.some(() => true)) {
			this._knownSymbols = [];
		}

		return this;
	}

	/**
	 * @method reproject(start: Number, length: Number, symbols?: Array of GleoSymbol): Array of Number
	 * Dumps a new set of values to the `this._coords` attribute buffer, based
	 * on the known set of symbols added to the acetate (only those which have
	 * their attribute offsets between `start` and `start+length`.
	 *
	 * If the list of symbols is already known, they can be passed as a third
	 * argument for a performance improvement.
	 *
	 * This default implementation **assumes** that the `attrLength` of a
	 * `GleoSymbol` is equal to the length of its `Geometry` (i.e. there's
	 * `one vertex per point in the geometry).
	 *
	 * Returns the data set into the attribute buffer: a ' Float32Array`
	 * in the form `[x1,y1, x2,y2, ... xn,yn]`.
	 */
	reproject(start, length, symbols) {
		const end = start + length;
		let maxIdx = -Infinity;
		let minIdx = Infinity;

		// In most cases, it's safe to assume that relevant symbols in the same
		// attribute allocation block have their vertex attributes in a
		// compacted manner.
		// The exception is tiles: tile vertex attributes are allocated in bulk
		// (enough to fill a whole texture atlas), before actually instantiating
		// tile symbols. Tile acetates shall overload this method.

		const stridedCoords = this._coords.asStridedArray(end);
		const geomStrides = this._getGeometryStridedArrays(end);

		const relevantSymbols =
			symbols ??
			this._knownSymbols.filter((symbol, attrIdx) => {
				return attrIdx >= start && attrIdx + symbol.attrLength <= start + length;
			});

		relevantSymbols.forEach((s) => {
			const geom = s.geometry.toCRS(this._crs);
			stridedCoords.set(geom.coords, s.attrBase);
			s._setGeometryStrides(geom, ...geomStrides);
			maxIdx = Math.max(maxIdx, s.idxBase + s.idxLength);
			minIdx = Math.min(maxIdx, s.idxBase);
		});

		this._coords.commit(start, length);
		this._commitGeometryStridedArrays(start, length, minIdx, maxIdx - minIdx);

		const coordData = new Float32Array(stridedCoords.buffer, start * 8, length * 2);
		super.expandBBox(coordData);
		return coordData;
	}
}

// import { registerDefaultAcetate } from "../Platina.mjs";
// import Allocator from "../glii/src/Allocator.mjs";

/**
 * @class AcetateStitchedTiles
 * @inherits AcetateVertices
 *
 * @relationship compositionOf TilePyramid, 0..n, 1..1
 *
 * An `Acetate` that draws rectangular conformal (i.e. matching the display CRS)
 * RGB(A) raster images, all of which fit together inside a Glii texture (and
 * so they share it). Users should not use this acetate directly; look at
 * `MercatorTiles` and `RasterTileLoader` and instead.
 *
 * This acetate will **not** hold an indefinite number of tiles; rather,
 * a tile might overwrite an existing tile. The (maximum) number of tiles at
 * any given moment depends on the size of the WebGL texture used.
 */

class AcetateStitchedTiles extends AcetateVertices {
	#MRULevels; // Most Recently Used levels
	#texFilter; // Either glii.NEAREST or glii.LINEAR

	/**
	 * Info about tile pyramid levels. Looks like:
	 * "8": {
	 * 	scale: 9.26,
	 * 	resX: 256,	// size of tiles in raster px
	 * 	resY: 256,	// size of tiles in raster px
	 * 	wrapX: 16,	// amount of tiles fitting in the texture
	 * 	wrapY: 16,	// amount of tiles fitting in the texture
	 * 	texSizeX: 4096,	// (desired) Size of texture
	 * 	texSizeY: 4096,	// (desired) Size of texture
	 * 	baseVtx: 348	// Index of the first vertex attribute for the level
	 * 	valid: true,	// Whether should be drawn or not
	 * }
	 */
	#levels = {};
	#levelNames = [];

	#uvAttr;
	#timestampAttr;
	#fadeInDuration;

	constructor(
		glii,
		{
			/**
			 * @section AcetateStitchedTiles Options
			 * @option pyramid: TilePyramid
			 * The tile pyramid to use
			 * @option tileResX: Number = 256; Horizontal size, in pixels, of each tile.
			 * @option tileResY: Number = 256; Vertical size, in pixels, of each tile.
			 * @option minTextureSize: Number = 2048
			 * Minimum size of the textures used to cache tile data. This should
			 * be set to the maximum expected size of the map (`RasterTileLoader`
			 * does so).
			 *
			 * Lower values might save some GPU memory, but will cause tiles to
			 * be culled prematurely.
			 *
			 * Higher values will keep more tiles cached in GPU textures, but
			 * will use more GPU memory and can cause browsers (notably
			 * chrome/chromium) to spend more time allocating the textures. Texture
			 * size is ultimately bound by the WebGL capabilities of the
			 * browser/OS/GPU, which usually can support textures 8192 or 16384
			 * pixels wide/high.
			 * @option interpolate: Boolean = false
			 * Whether to use bilinear pixel interpolation or not.
			 *
			 * In other words: `false` means pixellated, `true` means smoother.
			 * @option fadeInDuration: Number = 250
			 * Duration, in milliseconds, of the tile fade-in animation.
			 * @option maxLoadedLevels: Number = 3
			 * Number of maximum tile levels to keep loaded in their textures.
			 * Higher values can provide a slightly better experience when
			 * zooming in and out, but will use more GPU RAM.
			 * @option resizablePlatina: Boolean = true
			 * Whether the platina can be expected to be resized up to the size
			 * of the screen. When `false`, less GPU RAM is used for the textures.
			 */
			pyramid,
			tileResX = 256,
			tileResY = 256,
			minTextureSize = 2048,
			// minTextureSize = 1024,
			interpolate = false,
			fadeInDuration = 250,
			maxLoadedLevels = 4,
			...opts
		} = {}
	) {
		super(glii, opts);

		// this._texture = new glii.Texture();
		this._pyramid = pyramid;
		this.#levelNames = pyramid.mapLevels((name) => name);

		this.#MRULevels = new Array(maxLoadedLevels);

		this.#fadeInDuration = fadeInDuration;

		// Timestamp when the fade-in animation must stop.
		this._fadeTimeout = undefined;

		this._textures = {};

		this._crs = pyramid.crs;

		this._indices = new glii.LoDIndices({
			type: glii.UNSIGNED_INT,
			size: 0,
			growFactor: 1,
		});

		this.#texFilter = !!interpolate ? this.glii.LINEAR : this.glii.NEAREST;
		// const attrs = new Float32Array(levelCount * this._tilesPerLevel * 3);
		const uvs = [];
		const idxs = [];
		let vtx = 0;

		this._scales = {};

		const maxTexSize = glii.Texture.getMaxSize();

		this.#levelNames.forEach((levelName) => {
			const level = this._pyramid.getLevelDef(levelName);

			const resX = isFinite(tileResX) ? tileResX : tileResX[levelName];
			const resY = isFinite(tileResY) ? tileResY : tileResY[levelName];

			if (resX > maxTexSize || resY > maxTexSize) {
				throw new Error(
					`Resolution of tiles (${resX}, ${resY}) cannot be greater than the maximum size of textures (${maxTexSize})`
				);
			}
			if (resX < 0 || resY < 0) {
				throw new Error(
					`Resolution of tiles (${resX}, ${resY}) cannot be negative`
				);
			}

			// Scale is used as an sttribute to prevent z-fighting, so their
			// log2s work just as well and prevent float precision issues
			const scale = Math.log2(this._pyramid.getLevelDef(levelName).scale);
			this._scales[levelName] = scale;

			/// FIXME: What happens with maps with a yaw rotation of 45°??? Might need
			/// to multiply by sqrt(2).

			// Ideally, the size of a StitchedTiles texture would be the
			// maximum that the GPU allows - that's easily 8k x 8k pixels or
			// 16k x 16k.
			// Unfortunately, big framebuffers hog GPU RAM and cause browsers
			// (chromium/chrome in particular) to hang up during framebuffer
			// initialization.

			// The final size of the textures used will be:
			// - A power of 2 (hardcoded, in order to wrap textures across the
			//   antimeridian)
			// - Enough to fit tiles worth `minTextureSize` pixels, plus one
			//   extra tile.

			// Furthermore, since AcetateStitchedTiles allocates several textures
			// (one per pyramid level), big texture sizes can mean *a lot* of memory.
			// This is a problem for some old-ish or mobile GPUs, where allocating
			// more than ~128MiB of GPU RAM is a problem.
			/// FIXME: The X/Y tile span of each level must be a multiple of
			/// _tileWrapX/Y. Otherwise, loading tiles around the antimeridian will
			/// glitch (tiles ask to be stored in an offset modulo _tileWrapX/Y,
			/// and the last tile doesn't map to _tileWrapX/Y - 1, leading to
			/// tiles overwritting visible tiles). This might mean upping the textures
			/// to 4k :-/

			let tilesFitX = Math.min(level.spanX, Math.ceil(minTextureSize / resX));
			let tilesFitY = Math.min(level.spanY, Math.ceil(minTextureSize / resY));
			let texSizeX = tilesFitX * resX;
			let texSizeY = tilesFitY * resY;

			/// TODO: Fix non-power-of-two textures. Somehow disabling the p-o-2
			/// logic scrambles tiles around.

			// const forcePowerOfTwo = (this.interpolate || !this.glii instanceof WebGL2RenderingContext);
			// if (forcePowerOfTwo || isFinite(pyramid.crs.wrapPeriodX)) {
			texSizeX = 1 << Math.ceil(Math.log2(texSizeX));
			tilesFitX = Math.floor(texSizeX / resX);
			// }
			// if (forcePowerOfTwo || isFinite(pyramid.crs.wrapPeriodY)) {
			texSizeY = 1 << Math.ceil(Math.log2(texSizeY));
			tilesFitY = Math.floor(texSizeY / resY);
			// }

			texSizeX = Math.min(texSizeX, resX * level.spanX);
			texSizeY = Math.min(texSizeY, resY * level.spanY);

			// console.log(levelName, tilesFitX, tilesFitY );

			this.#levels[levelName] = {
				scale: scale,
				resX: resX,
				resY: resY,
				wrapX: tilesFitX,
				wrapY: tilesFitY,
				texSizeX: texSizeX,
				texSizeY: texSizeY,
				baseVtx: vtx,
				valid: false,
			};

			// console.log("level", levelName, this.#levels[levelName]);

			for (let y = 0; y < tilesFitY; y++) {
				for (let x = 0; x < tilesFitX; x++) {
					// Fill up the **static** values for the UV attribute, and the triangle indices
					// TODO: Consider using strided arrays??

					//prettier-ignore
					uvs.push(...[
						// UV map
						x/tilesFitX      , y/tilesFitY,
						(x + 1)/tilesFitX, y/tilesFitY,
						(x + 1)/tilesFitX, (y + 1)/tilesFitY,
						x/tilesFitX      , (y + 1)/tilesFitY,
					]/*, i * 3*/);

					// prettier-ignore
					idxs.push(
						vtx, vtx+1, vtx+2,
						vtx, vtx+2, vtx+3
					);

					vtx += 4;
				}
			}

			this._indices.allocateSet(levelName, idxs);

			idxs.splice(0); // Truncate idxs.
		});

		// UV attribute
		this.#uvAttr = new glii.SingleAttribute({
			usage: glii.STATIC_DRAW,
			size: vtx,
			growFactor: false,

			// UV map
			glslType: "vec2",
			type: Float32Array,
			// normalized: false,
		});
		this.#uvAttr.setBytes(0, 0, Float32Array.from(uvs));

		// Attribute to hold timestamps for the fade-in animation
		this.#timestampAttr = new this.glii.SingleAttribute({
			usage: glii.DYNAMIC_DRAW,
			size: vtx,
			growFactor: false,

			glslType: "float",
			type: Float32Array,
		});

		// Setting the coordinates for the last vertex will allocate and
		// fill in with zeroes all previous ones
		this._coords.setArray(vtx - 1, [0, 0]);
	}

	// Similar to AcetateConformalRaster
	glProgramDefinition() {
		const opts = super.glProgramDefinition();
		return {
			...opts,
			attributes: {
				...opts.attributes,
				aUV: this.#uvAttr,
				aTimestamp: this.#timestampAttr,
			},
			uniforms: {
				uNow: "float", // Current timestamp
				...opts.uniforms,
			},
			textures: {
				uRasterTexture: undefined,
			},
			vertexShaderMain: `
				vUV = aUV;
				vAlpha = min(1., ((uNow - aTimestamp) / ${this.#fadeInDuration}.));
				gl_Position = vec4(vec3(aCoords, 1.0) * uTransformMatrix, 1.0);
			`,
			varyings: { vUV: "vec2", vAlpha: "float" },
			fragmentShaderMain: `
				gl_FragColor = texture2D(uRasterTexture, vUV);
				gl_FragColor.a *= vAlpha;
			`,
			blend: {
				equationRGB: this.glii.FUNC_ADD,
				equationAlpha: this.glii.FUNC_ADD,

				srcRGB: this.glii.SRC_ALPHA,
				dstRGB: this.glii.ONE_MINUS_SRC_ALPHA,
				srcAlpha: this.glii.ONE,
				dstAlpha: this.glii.ONE_MINUS_SRC_ALPHA,
			},
		};
	}

	/**
	 * @section
	 * @method multiAdd(tiles: Array of Tile): this
	 * Adds the tiles to this acetate (so they're drawn on the next refresh).
	 *
	 * The images for the tiles are dumped into the acetate's texture.
	 *
	 * Unlike most other acetates, tiles are added on an individual basis and
	 * their data might not be stored adjacently in the attribute/primitive
	 * buffers.
	 */
	multiAdd(tiles) {
		/// TODO: Keep track of loaded tiles, in order to fire the `symbolsremoved`
		/// event whenever tiles are overwritten.

		// tiles.forEach(this.allocate.bind(this));
		tiles.forEach((t) => {
			this.allocate(t);
		});

		return super.multiAdd(tiles);
	}

	/**
	 * @method add(tile: Tile): this
	 *
	 * Adds a single tile. The tile will be slotted in a specific portion
	 * of the available space, depending on its X and Y coordinates within its pyramid level.
	 */
	allocate(tile) {
		const levelInfo = this.#levels[tile.level];
		const x = tile.tileX % levelInfo.wrapX;
		const y = tile.tileY % levelInfo.wrapY;

		// console.log("allocate tile:", tile.level, x, y);

		const baseVtx = levelInfo.baseVtx + (y * levelInfo.wrapY + x) * 4;
		const baseIdx = baseVtx * 1.5; // ratio is 4 vertices to 6 primitive slots

		tile.updateRefs(this, baseVtx, baseIdx);

		this._knownSymbols[baseVtx] = tile;

		this.reproject(baseVtx, 4);

		/// Perform MRU/LRU logic
		this.#loadLevelTexture(tile.level);

		this._textures[tile.level].texSubImage2D(
			tile.image,
			x * levelInfo.resX,
			y * levelInfo.resY
		);

		this._fadeTimeout = performance.now() + this.#fadeInDuration;
		// this._fadeTime.multiSet(baseVtx, new Array(4).fill(this._fadeTimeout));
		this.#timestampAttr.multiSet(baseVtx, new Array(4).fill(performance.now()));

		// console.log("Allocated", tile.level, tile.tileX, tile.tileY, performance.now());

		this.#levels[tile.level].valid = true;
		this.dirty = true;
		return this;
	}

	/**
	 * Redefinition of the default. Render must happen once per level, in order
	 * to load the appropriate textures. This leverages Glii's LoDIndices, by
	 * using a LoD per level of the pyramid.
	 */
	runProgram() {
		//this._clear();
		const now = performance.now();
		const platinaScale = Math.log2(this._platina.scale);
		this._programs.setUniform("uNow", now);

		// console.log("drawing levels", 		this.#levelNames .filter((name) => this.isLevelAvailable(name)).join (" , "))

		this.#levelNames
			.filter((name) => this.isLevelAvailable(name))
			.sort(
				(a, b) =>
					Math.abs(this._scales[b] - platinaScale) -
					Math.abs(this._scales[a] - platinaScale)
			)
			.forEach((name) => {
				this._programs.setTexture("uRasterTexture", this._textures[name]);
				this._programs.run(name);
			});

		if (now < this._fadeTimeout) {
			this.dirty = true;
		}
	}

	/**
	 * @method reproject(start: Number, length: Number): Array of Number
	 * Dumps a new set of values to the `this._coords` attribute buffer, based on the known
	 * set of symbols added to the acetate (only those which have their attribute offsets
	 * between `start` and `start+length`.
	 *
	 * Returns the data set into the attribute buffer: a plain array of coordinates
	 * in the form `[x1,y1, x2,y2, ... xn,yn]`.
	 *
	 * This implementation does not assume that the attribute allocation block
	 * contains a compact set of symbols (since tiles are statically allocated at
	 * instantiation time, then overwritten at runtime).
	 */
	reproject(start, length) {
		/// FIXME: Filtering needs optimization. Bisect search?
		/// Optimization only applies to chrome/chromium.
		let relevantSymbols = this._knownSymbols.filter((symbol, attrIdx) => {
			return attrIdx >= start && attrIdx + symbol.attrLength <= start + length;
		});

		let idx = start;

		const coordData = relevantSymbols
			.map((symbol) => {
				const gapLength = (symbol.attrBase - idx) * 2;
				const gap = new Array(gapLength).fill(0);
				idx = symbol.attrBase + symbol.attrLength;
				return gap.concat(symbol.geometry.toCRS(this._crs).coords);
			})
			.flat();

		//console.log("Symbol reprojected:", coordData);
		this.multiSetCoords(start, coordData);

		return coordData;
	}

	/**
	 * @section Acetate interface
	 * @method getLevelsInfo(): Object of Object
	 * Returns a data structure containing information about tile levels:
	 * tile resolution, expected texture size, number of tiles fitting in the
	 * texture, etc.
	 *
	 * Meant for debugging and communication with a `RasterTileLoader` only.
	 */
	getLevelsInfo() {
		return this.#levels;
	}

	// Ensures that the texture for given level is available.
	// If not, expels the LRU level from the MRU list, and reuses that texture;
	// or initializes a texture if the level expelled was `undefined`.
	#loadLevelTexture(levelName) {
		if (!this._textures[levelName]) {
			// console.log("load texture at level", levelName);
			const expel = this.#MRULevels.shift();
			this.#MRULevels.push(levelName);

			const sizeX = this.#levels[levelName].texSizeX;
			const sizeY = this.#levels[levelName].texSizeY;

			let currentX, currentY;

			if (expel !== undefined) {
				/**
				 * @section Acetate interface
				 * @event levelexpelled: Event
				 * Fired whenever a texture for a level of tiles is expelled, and
				 * thus all tiles from that level should be marked as unusable.
				 * The event's `detail` contains the name of the expelled level.
				 */
				this.fire("levelexpelled", { levelName: expel });
				currentX = this._textures[expel]?.width;
				currentY = this._textures[expel]?.height;
			}

			if (currentX == sizeX && currentY == sizeY) {
				// Texture from expelled level can be reused.
				this._textures[levelName] = this._textures[expel];
			} else {
				// Texture must be allocated.
				this._textures[levelName] = new this.glii.Texture({
					minFilter: this.#texFilter,
					magFilter: this.#texFilter,
					wrapS: this.glii.REPEAT,
					wrapT: this.glii.REPEAT,
				});
				if (expel !== undefined) {
					this._textures[expel]?.destroy();
				}
			}

			if (expel !== undefined) {
				delete this._textures[expel];
			}

			// No matter if the texture is reused or newly allocated,
			// it has to be zeroed out.
			this._textures[levelName].texArray(
				sizeX,
				sizeY,
				new Uint8Array(sizeX * sizeY * 4)
			);
		}

		return this._textures[levelName];
	}

	/**
	 * @section Acetate interface
	 * @method isLevelAvailable(levelName: String): Boolean
	 * Returns whether the texture for the given level name is available.
	 * In other words: when the given level has never been loaded, or it has
	 * been expelled from the MRU list, this returns `false`.
	 */
	isLevelAvailable(levelName) {
		return this.#levels[levelName].valid && !!this._textures[levelName];
	}

	/**
	 * @method destroyHigherScaleLevels(levelName: String): Boolean
	 * Searches all levels with a scale lower than the given one (i.e. those with
	 * "higher zoom levels") and marks them as invalid; will not be re-rendered
	 * until a tile for that level is allocated.
	 */
	destroyHigherScaleLevels(levelName) {
		const scale = this.#levels[levelName].scale;
		// const str = Object.values(this.#levels).map(l=>l.valid?"1":"0").join("");

		Object.entries(this.#levels).forEach(([name, level]) => {
			if (level.scale < scale && level.valid) {
				// console.log("invalidate", level);
				level.valid = false;

				const sizeX = level.texSizeX;
				const sizeY = level.texSizeY;

				this._textures[name]?.texArray(
					sizeX,
					sizeY,
					new Uint8Array(sizeX * sizeY * 4)
				);
			}
		});
		// console.log(str + "\n" + Object.values(this.#levels).map(l=>l.valid?"1":"0").join(""));
	}

	destroy() {
		// Ignore missing/incomplete tile symbols that do exist as
		// empty slots in _knownSymbols
		// this._knownSymbols = this._knownSymbols.filter((s) => !!s);
		Object.values(this._textures).forEach((t) => t.destroy());
		return super.destroy();
	}

	reprojectAll() {
		// This acetate does not use an attribute allocator like most others,
		// and must rely on the available tile levels to reproject existing
		// tiles
		for (const level of Object.values(this.#levels)) {
			this.reproject(level.baseVtx, level.wrapX * level.wrapY * 4);
		}
	}
}

/**
 * @class Tile
 * @inherits GleoSymbol
 *
 * @relationship drawnOn AcetateStitchedTiles, 0..n, 0..1
 *
 * A rectangular, conformal (i.e. matching the display CRS) RGB(A) raster image,
 * part of a bigger grid mosaic.
 *
 * Users should not use `Tile` symbols directly - in most cases, using
 * a `RasterTileLoader` will fulfil most of their use cases.
 */

class Tile extends GleoSymbol {
	/**
	 * @section
	 * A `Tile` needs to be passed a 4-point `Geometry` with its bounds, the
	 * name of the pyramid level it's in, its X and Y coordinates within the pyramid level,
	 * and a `HTMLImageElement`
	 *
	 * @constructor Tile(geom: RawGeometry, levelName: String, tileX: Number, tileY: Number)
	 */
	constructor(geom, levelName, tileX, tileY, image) {
		super(geom);

		this.level = levelName;
		this.tileX = tileX;
		this.tileY = tileY;
		this.image = image;

		this.attrLength = 4;
		this.idxLength = 6;
	}
}

/**
 * @namespace Util
 * @function imagePromise(url: URL, fillCache?: Boolean): Promise of HTMLImageElement
 *
 * Requests the given `URL`, and returns a `Promise` of an `HTMLImageElement`.
 *
 * By default it **caches all images**, and uses a hash `Map` internally to
 * de-duplicate loading the same URL. Use a `false` value for `fillCache` to
 * prevent this.
 *
 * @alternative
 * @function imagePromise(url: String, fillCache?: Boolean): Promise of HTMLImageElement
 * Idem, but using a `String` containing a URL.
 *
 * @alternative
 * @function imagePromise(image: HTMLImageElement, fillCache?: Boolean): Promise of HTMLImageElement
 * Returns a `Promise` that immediately resolves to the given image. Does not
 * cache the image.
 */

// TODO: This cache is ever increasing. There should be a way to clean it up, since
// it will hold references to potentially big unused images.

const cache = new Map();

async function imagePromise(url, fillCache = true) {
	if (url instanceof HTMLImageElement || url instanceof ImageData) {
		return Promise.resolve(url);
	} else if (typeof url === "string") {
		url = new URL(url, document.URL);
	} else if (!(url instanceof URL)) {
		throw new Error(
			"Bad parameter to imagePromise(): must be either a URL or an image."
		);
	}

	const urlStr = url.toString();
	const cached = cache.get(urlStr);
	if (cached) {
		return cached;
	}

	const promise = new Promise((res, rej) => {
		const img = new Image();
		img.addEventListener("load", (ev) => res(ev.target));
		img.addEventListener("error", rej);
		img.addEventListener("abort", rej);
		img.crossOrigin = true;
		img.src = url;
	});
	// const promise = Promise.any(known.map(format=>format.urlToRaster(urlStr)));

	if (fillCache) {
		cache.set(urlStr, promise);
	}
	return promise;
}

/**
 * @class RasterTileLoader
 * @inherits AbstractTileLoader
 * @relationship compositionOf AcetateStitchedTiles, 1..1, 1..1
 *
 * Loads raster tiles, according to a Gleo `TilePyramid` and a callback function
 * that returns tiles given the tile coordinates.
 *
 * Will automatically spawn an `AcetateStitchedTiles`.
 *
 */
class RasterTileLoader extends AbstractTileLoader {
	#boundOnLevelExpelled;

	// Tile and tile request cache.
	// Raster tile loaders use a sliding window - the cache holds a tile on
	// a position given by the modulo of the tile XY coordinate.
	// The cache itself is a simple key-value JS object, keyed by the names
	// of the pyramid levels.
	// Each value is an `Array` of tiles/tile requests. The array is 1-dimensional,
	// and has a set maximum size (tileWrapX times tileWrapY);  the index of
	// the array comes from the tile coordinates modulo tileWrapX/tileWrapY.
	// Each tile/tile request is a JS object of the form: {x, y, req, data, abortController}
	#cached = {};

	#opts = {};
	#zIndex = 0;
	#tileFn;
	#fallback;
	#retry;

	#pendingReqs = 0;
	#lastLevel;
	#fadeInDuration;
	#cleanupTimeout;

	/**
	 * @section
	 *
	 * A `RasterTileLoader` needs a `TilePyramid` and a function that, given the
	 * pyramid level ("`z`"), the coordinates of a tile within that level
	 * ("`x`" and "`y`"), and an instance of `AbortController`, returns an
	 * instance of `HTMLImageElement`, or a `Promise` to such an image. The
	 * promise should be rejected whenever the abort controller's signal is
	 * activated.
	 *
	 * @constructor TileLoader(pyramid:TilePyramid, tileFn: Function, opts: TileLoader Options)
	 */
	constructor(
		pyramid,
		fn,
		{
			/// FIXME: tile resolution is per pyramid level, not global!!
			/**
			 * @section TileLoader Options
			 * @option tileResX: Number = 256; Horizontal size, in source raster pixels, of each tile.
			 * @alternative
			 * @option tileResX: Object of String to Number
			 * A map of level identifier to horizontal raster size (in source raster pixels).
			 * e.g. `{"0": 512, "1": 256}`
			 * @option tileResY: Number = 256; Vertical size, in source raster pixels, of each tile.
			 * @option tileResY: Object of String to Number
			 * A map of level identifier to vertical raster size (in source raster pixels).
			 * e.g. `{"0": 512, "1": 256}`
			 * @option zIndex: Number = -5500; The z-index of the acetate for these tiles.
			 */
			tileResX = 256,
			tileResY = 256,

			zIndex = -5500,

			/**
			 * @option fallback: HTMLImageElement
			 * An image to use as fallback is loading a tile fails.
			 * @alternative
			 * @option fallback: URL
			 * Idem, but using the `URL` to an image.
			 * @alternative
			 * @option fallback: String
			 * Idem, but using a `String` containing a URL
			 */
			fallback,

			/**
			 * @option retry: Boolean = false
			 * When `true`, tiles that failed to load will be re-requested
			 * the next time the tile extent changes (i.e. moving the map enough
			 * so that new tiles become visible). This can potentially
			 * lead to lots of requests for missing tiles.
			 */
			retry = false,

			/// TODO: Additional option to enable/disable scale snap points

			/**
			 * @section Options passed to spawned acetate
			 * A `RasterTileLoader` creates a `AcetateStitchedTiles` under the hood.
			 * The following options are passed through to this acetate.
			 * @option interpolate: Boolean = false
			 * Whether to use bilinear pixel interpolation or not.
			 *
			 * In other words: `false` means pixellated, `true` means smoother.
			 * @option fadeInDuration: Number = 250
			 * Duration, in milliseconds, of the tile fade-in animation.
			 * @option maxLoadedLevels: Number = 3
			 * Number of maximum tile levels to keep loaded in their textures.
			 * Higher values can provide a slightly better experience when
			 * zooming in and out, but will use more GPU RAM.
			 * @option resizablePlatina: Boolean = true
			 * Whether the platina can be expected to be resized up to the size
			 * of the screen. When `false`, less GPU RAM is used for the textures.
			 */
			fadeInDuration = 250,

			...opts
		} = {}
	) {
		super(pyramid, opts);

		this.#boundOnLevelExpelled = this.#onLevelExpelled.bind(this);
		this.#tileFn = fn;
		this.#tileResX = tileResX;
		this.#tileResY = tileResY;
		this.#zIndex = zIndex;
		this.#opts = opts;
		if (fallback) {
			this.#fallback = imagePromise(fallback);
		} else {
			this.#fallback;
		}
		this.#retry = retry;
		this.#fadeInDuration = fadeInDuration;
	}

	#tileResX;
	#tileResY;
	// 	#textureSizeX;
	// 	#textureSizeY;

	addTo(target) {
		super.addTo(target);

		let maxTileSize = 0;
		if (isFinite(this.#tileResX)) {
			maxTileSize = this.#tileResX;
		} else {
			maxTileSize = Math.max.apply(null, Object.values(this.#tileResX));
		}
		if (isFinite(this.#tileResY)) {
			maxTileSize = Math.max(maxTileSize, this.#tileResY);
		} else {
			maxTileSize = Math.max.apply(null, Object.values(this.#tileResY));
		}

		const minTextureSize =
			// 	this.platina.resizable && typeof screen !== undefined
			// 		? getMaxScreenSize() :
			Math.max.apply(null, this.platina.pxSize) + maxTileSize;
		// const minTextureSize = 1024;

		this._ac = new AcetateStitchedTiles(this.platina.glii, {
			...this.#opts,

			pyramid: this.pyramid,
			tileResX: this.#tileResX,
			tileResY: this.#tileResY,
			minTextureSize,
			// textureSizeX: this.#textureSizeX,
			// textureSizeY: this.#textureSizeY,
			zIndex: this.#zIndex,
			fadeInDuration: this.#fadeInDuration,
		});
		if (target.addAcetate) {
			target.addAcetate(this._ac);
			this._ac._platina = this.platina;
		} else {
			this.platina.addAcetate(this._ac);
		}

		this.pyramid.forEachLevel((_name, def) => {
			this.platina.setScaleStop(this.pyramid.crs.name, def.scale);
		});

		//this.platina.on("viewchanged", this._boundOnViewChange);
		this._ac.on("levelexpelled", this.#boundOnLevelExpelled);

		if (target.actuators && target.actuators.get("zoomsnap")) {
			// Trigger the map setter, and thus the ZoomYawSnapActuator functionality
			target.scale = target.scale;
		}

		this._boundOnViewChange();

		return this;
	}

	remove() {
		this._ac.off("levelexpelled", this.#boundOnLevelExpelled);

		/// remove acetate from map
		this._ac.destroy();

		super.remove();
		/// TODO: Remove the scale stops
		return this;
	}

	_abortLevel(level) {
		this.#cached[level].forEach(({ data, abortController, x, y }) => {
			if (!data) {
				abortController?.abort();
				// console.log("aborted", level, x, y);
			}
		});
	}

	_onRangeChange(level, minX, minY, maxX, maxY) {
		if (!this.#cached[level]) {
			// Init cache for level
			// console.log("Create tile cache for level", level);
			const levelInfo = this._ac.getLevelsInfo()[level];
			this.#cached[level] = new Array(levelInfo.wrapX * levelInfo.wrapY)
				.fill(0)
				.map(() => {
					return {
						x: undefined,
						y: undefined,
						req: undefined,
						data: undefined,
						abortController: undefined,
					};
				});
		}

		const cachedLevel = this.#cached[level];
		this.#lastLevel = level;

		// console.log(cachedLevel);

		const { spanX, spanY } = this.pyramid.getLevelDef(level);

		if ((maxX - minX) * (maxY - minY) > 256) {
			// This amount of tiles shouldn't appear during normal operation
			console.warn("Attempted to load too many raster tiles");
			return;
		}

		// Abort tiles outside the range, by looping through all
		// the cache slots in the current level.
		cachedLevel.forEach(({ x, y, abortController }) => {
			// Check if the request is outside the range,
			// accounting for the non-trivial case of comparing
			// a maxX that wraps around spanX
			if (
				(maxX > spanX ? x < minX && x > maxX % spanX : x < minX || x > maxX) ||
				(maxY > spanY ? y < minY && y > maxY % spanY : y < minY || y > maxY)
			) {
				// console.log("Aborting", cachedLevel, x, y);
				/// Abort tiles in the level, but outside the range.
				abortController?.abort();
			}
		});

		let levelInfo = this._ac.getLevelsInfo()[level];
		// const reqCount = 0;

		// Load tiles inside the range, by looping through the range.
		for (let i = minX; i < maxX; i++) {
			for (let j = minY; j < maxY; j++) {
				const x = i % spanX;
				const y = j % spanY;

				const xmod = (x % levelInfo.wrapX) * levelInfo.wrapY;
				const ymod = y % levelInfo.wrapY;
				const cacheSlot = cachedLevel[xmod + ymod];

				if (
					cacheSlot.x !== x ||
					cacheSlot.y !== y ||
					cacheSlot.abortController?.signal?.aborted
				) {
					cacheSlot.abortController?.abort();
					cacheSlot.data = undefined;
					cacheSlot.x = x;
					cacheSlot.y = y;

					const abortController = (cacheSlot.abortController =
						new AbortController());
					const req = (cacheSlot.req = Promise.resolve(
						this.#tileFn(level, x, y, abortController)
					));

					this.#pendingReqs++;

					req.then((data) => {
						this.#decreasePendingReqs();
						const [lastMinX, lastMinY, lastMaxX, lastMaxY] =
							this.currentRange;

						/// Async, so compare against the current range, not the range
						/// inside the closure
						if (
							this.currentLevel !== level ||
							i < lastMinX ||
							i > lastMaxX ||
							j < lastMinY ||
							j > lastMaxY
						) {
							// Async, non-abortable tile finished loading when
							// the viewport already changed
							return;
						}
						cacheSlot.data = data;
						this._onTileLoad(level, x, y, data);

						// this.#prune(level, x, y);
					}).catch((err) => {
						this.#decreasePendingReqs();
						const [lastMinX, lastMinY, lastMaxX, lastMaxY] =
							this.currentRange;
						if (
							this.currentLevel !== level ||
							i < lastMinX ||
							i > lastMaxX ||
							j < lastMinY ||
							j > lastMaxY
						) {
							// Async, non-abortable tile failed when
							// the viewport already changed
							return;
						}

						if (this.#retry) {
							// Invalidate this cache slot
							cacheSlot.x = NaN;
							cacheSlot.y = NaN;
							cacheSlot.data = undefined;
						}

						if (this.#fallback) {
							this.#fallback.then((f) =>
								this._onTileLoad(level, x, y, f, true)
							);
						} else {
							this._onTileError(level, x, y, err);
						}
					});
				}
			}
		}
		// console.log("range change; pending:", this.#pendingReqs);

		if (this.#pendingReqs) {
			clearTimeout(this.#cleanupTimeout);
		}
	}

	_onTileLoad(level, x, y, img, isFallback = false) {
		const bounds = this.pyramid.tileCoordsToBbox(level, [x, y]);
		const geom = new Geometry(
			this.pyramid.crs,
			[
				[bounds[0], bounds[1]],
				[bounds[2], bounds[1]],
				[bounds[2], bounds[3]],
				[bounds[0], bounds[3]],
			],
			{ wrap: false }
		);
		this._ac.add(new Tile(geom, level, x, y, img));
		if (isFallback) {
			super._onTileError(level, x, y);
		} else {
			super._onTileLoad(level, x, y, img);
		}
	}

	#decreasePendingReqs() {
		this.#pendingReqs--;

		// console.log("pending:", this.#pendingReqs);
		if (this.#pendingReqs == 0) {
			this.#cleanupTimeout = setTimeout(() => {
				// console.log("cleanup");
				// Tell the acetate to destroy textures
				this._ac.destroyHigherScaleLevels(this.#lastLevel);

				// Mark tiles from those levels as invalid
				const acLevels = this._ac.getLevelsInfo();
				const scale = acLevels[this.#lastLevel].scale;

				Object.entries(acLevels).forEach(([name, level]) => {
					if (level.scale < scale) {
						delete this.#cached[name];
					}
				});
				// console.log(this.#cached);
			}, this.#fadeInDuration);
		}
	}

	#onLevelExpelled(ev) {
		const level = ev.detail.levelName;

		/// TODO: Expel the level from the acetate (mark as unavailable, free the texture, etc)
		delete this.#cached[level];

		//console.log("Level invalidated", ev.detail.levelName);
	}
}

/**
 * @namespace Util
 *
 * @function abortableImagePromise(url: String, controller?: AbortController): Promise
 *
 * Returns a `Promise` to an `HTMLImageElement`, given a URL for the image.
 *
 * If an `AbortController` is given, the `Promise` will reject whenever its
 * signal is activated.
 *
 * @alternative
 * @function abortableImagePromise(url: URL, controller?: AbortController): Promise
 * As before, but can take an instance of `URL` instead of a `String`.
 */

/// TODO: Does using `fetch` offer any benefit?? The logic could be changed.

function abortableImagePromise(url, controller) {
	if (!controller) {
		controller = new AbortController();
	}

	const img = new Image();
	return new Promise((res, rej) => {
		img.addEventListener("load", (ev) => res(ev.target));
		img.addEventListener("error", rej);
		img.addEventListener("abort", rej);
		controller.signal.addEventListener("abort", (reason) => {
			img.src = "";
			rej(reason);
		});

		img.crossOrigin = true;
		img.src = url;
	});
}

/**
 * Meaning is as per the OGC WMTS
 * spec (portal.opengeospatial.org/files/?artifact_id=35326):
 *
 * 4.13
 * tile matrix set
 * a collection of tile matrices defined at different scales
 *
 * 4.12
 * tile matrix
 * a collection of tiles for a fixed scale
 *
 */

/**
 * @class TilePyramid
 *
 * A `TilePyramid` defines the size and disposition of raster tiles.
 *
 * The concept is equivalent to the "Tile Matrix Set" in the
 * [OGC WMTS specification](portal.opengeospatial.org/files/?artifact_id=35326),
 * and also equivalent to OpenLayer's `TileGrid`s.
 *
 * Tile pyramids do not have a concept of "tile size" but rather per-level "scale".
 * A level will be loaded when the map's (platina's) scale is equal or breater
 * than the level's.
 *
 * @example
 * ```
 * const epsg3857zoom0 = new TilePyramid(
 * 	epsg3857,
 * 	{
 * 		"0": {	// (string) identifier of the pyramid level
 * 			scale: 156543,03390625	// scale, in CRS units per CSS pixel
 * 			bbox: [-l, l, l, -l],	// x1,y1, x2,y2
 * 			spanX: 1,	// horizontal tiles in the level
 * 			spanY: 1,	// vertical tiles in the level
 * 		}
 * 	}
 * );
 * ```
 */

class TilePyramid {
	#crs;
	#scales; // Ordered array of scale factors
	#levels;
	#ids; // Map of scale factor to level name
	#orderedIds; // Ids ordered by scale

	/**
	 * @constructor TilePyramid(crs: BaseCRS, levels: Object of Object)
	 * Defines a new `TilePyramid`, given its CRS and a set of pyramid levels,
	 * indexed by the scale of each.
	 *
	 * Scales are Gleo scales: CRS units per CSS pixel.
	 */
	constructor(crs, levels) {
		this.#crs = crs;
		this.#levels = levels;
		this.#ids = Object.fromEntries(
			Object.entries(levels).map(([id, { scale }]) => [String(scale), id])
		);
		// .map(Object.fromEntries);

		// NOTE: ordering is ascending, so first item is the level
		// with the smallest scale - which means the highest zoom.
		this.#scales = Object.values(levels)
			.map(({ scale }) => Number(scale))
			.sort((a, b) => a - b);

		this.#orderedIds = this.#scales.map((scale) => this.#ids[scale]);
	}

	/**
	 * @method ceilLevel(scale: Number): String
	 * Given a scale (in terms of CRS units per CSS pixel), returns the
	 * identifier of the pyramid level with the nearest known scale in
	 * the pyramid that is *equal or higher* than the given one.
	 *
	 * Returns `undefined` if there's no known equal-or-higher scale.
	 */
	ceilLevel(scale) {
		// Yes, a bisect search would be slightly more efficient, I know.
		for (let l = this.#scales.length, i = l; i > 0; i--) {
			if (this.#scales[i] >= scale) {
				return this.#ids[this.#scales[i]];
			}
		}
		return undefined;
	}

	/**
	 * @method floorLevel(scale: Number): String
	 * Given a scale (in terms of CRS units per CSS pixel), returns the
	 * identifier of the pyramid level with the nearest known scale in
	 * the pyramid that is *equal or higher* than the given one.
	 *
	 * Returns `undefined` if there's no known equal-or-lower scale.
	 */
	floorLevel(scale) {
		for (let l = this.#scales.length, i = 0; i < l; i++) {
			if (this.#scales[i] <= scale) {
				return this.#ids[this.#scales[i]];
			}
		}
		return undefined;
	}

	/**
	 * @method nearestLevel(scale:Number): String
	 * Given a scale, returns the identifier of the level with the *nearest*
	 * scale known in the pyramid levels,
	 * "nearest" in terms of "minimum distance in terms of base-2 logarithm"
	 */
	nearestLevel(scale) {
		const l = this.#scales.length - 1;

		if (scale <= this.#scales[0]) {
			// Smaller than the smallest available scale
			return this.#ids[this.#scales[0]];
		}
		if (scale >= this.#scales[l]) {
			// Bigger than the biggest available scale
			return this.#ids[this.#scales[l]];
		}

		for (let i = 0; i < l; i++) {
			const lower = this.#scales[i];
			const upper = this.#scales[i + 1];
			if (lower < scale && scale <= upper) {
				const log2scale = Math.log2(scale);
				const log2upper = Math.log2(upper);
				const log2lower = Math.log2(lower);

				if (Math.abs(log2upper - log2scale) < Math.abs(log2lower - log2scale)) {
					return this.#ids[upper];
				} else {
					return this.#ids[lower];
				}
			}
		}
	}

	/**
	 * @method bboxToTileRange(levelId: String, bbox: Array of Number): Array of Number
	 * Given a bounding box of the form `[x1,y1, x2,y2]` and the string
	 * identifier for a level of the pyramid, returns a bounding box
	 * containing the integer min/max tile coordinates that *overlap* the given
	 * bbox.
	 *
	 * The return values can be higher than the span. This is a safeguard against
	 * misbehaviour and negative coordinates when requesting tiles across the
	 * antimeridian. When looping through this values, modulo by the tile span.
	 *
	 * The bbox is expected to be in the same CRS as the tile pyramid.
	 */
	bboxToTileRange(levelId, [x1, y1, x2, y2]) {
		const level = this.#levels[levelId];

		if (!level) {
			throw new Error(`Level identifier ${levelId} does not exist in the pyramid.`);
		}

		const [minx, miny, maxx, maxy] = level.bbox;
		const w = maxx - minx;
		const h = maxy - miny;

		let tx1 = (level.spanX * (x1 - minx)) / w;
		let ty1 = (level.spanY * (y1 - miny)) / h;
		let tx2 = (level.spanX * (x2 - minx)) / w;
		let ty2 = (level.spanY * (y2 - miny)) / h;

		// console.log(tx1, ty1, tx2, ty2);

		const range = [
			Math.floor(Math.min(tx1, tx2)),
			Math.floor(Math.min(ty1, ty2)),
			Math.ceil(Math.max(tx1, tx2)),
			Math.ceil(Math.max(ty1, ty2)),
		];

		if (range[2] - range[0] > level.spanX) {
			range[0] = 0;
			range[2] = level.spanX;
		}
		if (range[3] - range[1] > level.spanY) {
			range[1] = 0;
			range[3] = level.spanY;
		}

		if (range[0] < 0) {
			if (this.#crs.wrapPeriodX !== Infinity) {
				const i = Math.ceil(-range[0] / level.spanX);
				range[0] += level.spanX * i;
				range[2] += level.spanX * i;
			} else {
				range[0] = 0;
				range[2] = Math.min(range[2], level.spanX);
			}
		}
		if (range[1] < 0) {
			if (this.#crs.wrapPeriodY !== Infinity) {
				const i = Math.ceil(-range[1] / level.spanY);
				range[1] += level.spanX * i;
				range[3] += level.spanX * i;
			} else {
				range[1] = 0;
				range[3] = Math.min(range[3], level.spanY);
			}
		}

		return range;
	}

	/**
	 * @method tileRangeToBbox(levelId: String, range: Array of Number): Array of Number
	 *
	 * Given the identifier of a pyramid level and a tile range of the form
	 * `[minX, minY, maxX, maxY]`, returns the bounding box (in the pyramid's
	 * CRS) that encloses the tiles within the given range.
	 *
	 */
	tileRangeToBbox(levelId, [tx1, ty1, tx2, ty2]) {
		const level = this.#levels[levelId];

		if (!level) {
			throw new Error(`Level identifier ${levelId} does not exist in the pyramid.`);
		}

		const [minx, miny, maxx, maxy] = level.bbox;
		const w = maxx - minx;
		const h = maxy - miny;

		const x1 = (tx1 / level.spanX) * w + minx;
		const y1 = (ty1 / level.spanY) * h + miny;
		const x2 = ((tx2 + 1) / level.spanX) * w + minx;
		const y2 = ((ty2 + 1) / level.spanY) * h + miny;

		return [x1, y1, x2, y2];
	}

	/**
	 * @method tileCoordsToBbox(levelId: String, coords: Array of Number): Array of Number
	 *
	 * Given the coordinates of a tile (the identifier of a level plus an array
	 * of the form `[x,y]`), returns a bounding box (of the form `[x1,y1, x2,y2]`)
	 * with the boinding box for that tile (in the pyramid's CRS).
	 */
	tileCoordsToBbox(levelId, [x, y]) {
		return this.tileRangeToBbox(levelId, [x, y, x, y]);
	}

	/**
	 * @method childTiles(levelId: String, x: Number, y: Number): Array of Array of Number
	 * For a tile of the given level and coordinates, returns an array of
	 * tile coordinates for the child tiles: tiles from a lower level (one with
	 * more detail) whose bounding box overlap that of the given tile.
	 * This will be an empty array if there are no child tiles.
	 */
	childTiles(levelId, x, y) {
		return this.#familyTiles(levelId, x, y, -1);
	}

	/**
	 * @method parentTiles(levelId: String, x: Number, y: Number): Array of Array of Number
	 * Akin to `childTiles()`, but for the parent tiles: tiles from a higher
	 * level (one with less detail).
	 * This will be an empty array if there are no parent tiles.
	 */
	parentTiles(levelId, x, y) {
		return this.#familyTiles(levelId, x, y, 1);
	}

	// Functionality common to both childTiles() and parentTiles()
	#familyTiles(levelId, x, y, levelOffset) {
		const levelIdx = this.#scales.indexOf(this.#levels[levelId].scale);
		const children = [];
		const nextLevelId = this.#orderedIds[levelIdx + levelOffset];
		if (!nextLevelId) {
			return children;
		}
		const bbox = this.tileCoordsToBbox(levelId, [x, y]);
		const [minX, minY, maxX, maxY] = this.bboxToTileRange(nextLevelId, bbox);
		const { spanX, spanY } = this.#levels[nextLevelId];

		for (let x = minX; x < maxX; x++) {
			for (let y = minY; y < maxY; y++) {
				children.push([(x + 0) % spanX, (y + 0) % spanY]);
			}
		}
		return children;
	}

	/**
	 * @property crs: BaseCRS
	 * Read-only getter to the pyramid's CRS.
	 */
	get crs() {
		return this.#crs;
	}

	/**
	 * @section Level iterators
	 * @method forEachLevel(fn: Function): this
	 * Runs the given `Function` `fn` on each level of the pyramid.
	 *
	 * The function will receive two parameters: the name of the level (as a `String`), and
	 * the level definition (as an `Object` with `scale`, `bbox`, `spanX`, `spanY` properties).
	 */
	forEachLevel(fn) {
		Object.entries(this.#levels).forEach(([name, def]) => fn(name, def));

		return this;
	}

	/**
	 * @method mapLevels(fn: Function): Array
	 * Runs the given `Function` `fn` on each level of the pyramid, and returns an array
	 * containing all the return values from each call.
	 *
	 * In other words, works akin to [`Array.prototype.map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map.html).
	 *
	 * The function will receive two parameters: the name of the level (as a `String`), and
	 * the level definition (as an `Object` with `scale`, `bbox`, `spanX`, `spanY` properties).
	 */
	mapLevels(fn) {
		return Object.entries(this.#levels).map(([name, def]) => fn(name, def));
	}

	/**
	 * @method getLevelsCount(): Number
	 * Returns the number of levels in this pyramid.
	 *
	 * Note that the names of the levels might not be numeric: this is just the lenght
	 * of an hypothetical array containing the levels.
	 */
	getLevelsCount() {
		return Object.keys(this.#levels).length;
	}

	/**
	 * @method getLevelDef(name: String): Object
	 *
	 * Returns the definition of a pyramid level given its identifier/name (or `undefined`
	 * if there's no level with that identifier).
	 */
	getLevelDef(name) {
		return this.#levels[name];
	}
}

/**
 * @namespace Pyramid3857
 * @relationship associated epsg3857
 * @relationship associated TilePyramid
 *
 * Factory for tile pyramids fitting the EPSG:3857 CRS (`epsg3857`).
 * Assumes pyramid level 0 spans the whole surface.
 *
 * @example
 * ```
 * import { create3857Pyramid } from 'gleo/src/geometry/Pyramid3857';
 *
 * const myPyramid = create3857Pyramid(0, 18);
 * ```
 */

const limit = 20037508.34;
const scale0 = limit * 2;
const bbox = [-limit, limit, limit, -limit]; // x1, y1, x2, y2

/**
 * @function create3857Pyramid(min: Number, max: Number, tileSize: Number = 256): TilePyramid
 *
 * Creates a `TilePyramid` for the `epsg3857` crs, with one pyramid level for
 * each "zoom level" between the given minimum and maximum.
 *
 * The pyramid constructor also takes the (square) size of each tile, **in
 * CSS pixels**, in order to calculate the right zoom level to load on any
 * given scale. Note that the pyramid takes in CSS pixels, but the `RasterTileLoader`
 * takes source raster pixels instead.
 */
function create3857Pyramid(min, max, tileSize = 256) {
	const pyramid = {};
	if (max < min || !isFinite(min) || !isFinite(max)) {
		throw new Error("Invalid min/max levels for mercator tile pyramid");
	}
	for (let i = min; i <= max; i++) {
		const j = 1 << i;
		pyramid[i] = {
			scale: scale0 / j / tileSize,
			bbox: bbox,
			spanX: j,
			spanY: j,
		};
	}

	return new TilePyramid(epsg3857, pyramid);
}

// Template regexp and function straight from Leaflet

// @namespace Util
// @function template(str: String, data: Object): String
// Simple templating facility, accepts a template string of the form `'Hello {a}, {b}'`
// and a data object like `{a: 'foo', b: 'bar'}`, returns evaluated string
// `('Hello foo, bar')`. You can also specify functions instead of strings for
// data values — they will be evaluated passing `data` as an argument.

const templateRe = /\{ *([\w_ -]+) *\}/g;

function template(str, data) {
	return str.replace(templateRe, function (str, key) {
		var value = data[key];

		if (value === undefined) {
			throw new Error("No value provided for variable " + str);
		} else if (typeof value === "function") {
			value = value(data);
		}
		return value;
	});
}

/**
 * @class MercatorTiles
 * @inherits RasterTileLoader
 * @relationship compositionOf epsg3857, 0..n, 1..1
 *
 * Convenience wrapper for `RasterTileLoader`. Loads tilesets in the de-facto
 * standard for Web Mercator tiles.
 *
 * This aims to expose a minimalistic Leaflet-like API, instead of needing to use
 * a configurable `TilePyramid` like `TileLoader` does.
 *
 * @example
 *
 * ```js
 * new MercatorTiles("https://tile.osm.org/{z}/{y}/{x}.png", {
 * 	maxZoom: 10,
 * 	attribution: "<a href='http://osm.org/copyright'>© OpenStreetMap contributors</a>",
 * }).addTo(myGleoMap);
 * ```
 */
class MercatorTiles extends RasterTileLoader {
	/**
	 * @constructor MercatorTiles(templateStr: String, options: MercatorTiles Options)
	 */
	constructor(templateStr, options = {}) {
		/**
		 * @section
		 * @aka MercatorTiles Options
		 * @option minZoom: Number = 0
		 * The minimum zoom level for tiles to be loaded.
		 * @option maxZoom: Number = 18
		 * The maximum zoom level for tiles to be loaded.
		 * @option tileSize: Number = 256
		 * The size of the tiles, **in CSS pixels**.
		 */
		const pyramid = create3857Pyramid(
			options.minZoom || 0,
			options.maxZoom || 18,
			options.tileSize || 256
		);

		function fetchImage(z, x, y, controller) {
			return abortableImagePromise(
				template(templateStr, { x, y, z, ...options }),
				controller
			);
		}

		super(pyramid, fetchImage, options);
	}
}

/// These constants are used in the `_setPerPointStrides` method of symbols.


// A point extrudes as a line cap - a butt or square
// If here's a centerline, it's the 2nd vertex (offset 1)
const LINECAP = Symbol("LINECAP");

// 90 degrees, in radians
const Δϕ90 = Math.PI / 2;

// 150 degrees, in radians
const Δϕ150 = Math.PI / 1.2;

/**
 * @class AcetateChain
 * @inherits AcetateVertices
 *
 * An `Acetate` that draws lines as `Chain`s of overlapping 2-point segments
 *
 */
class AcetateChain extends AcetateVertices {
	/**
	 * @constructor AcetateChain(target: GliiFactory)
	 */
	constructor(target, opts) {
		super(target, { zIndex: 1500, ...opts });

		// this._indices = new this.glii.SparseIndices({
		// 	type: this.glii.UNSIGNED_INT,
		// 	drawMode: this.glii.POINTS,
		// });

		// Could be done as a SingleAttribute, but is a InterleavedAttributes for
		// compatibility with the `intensify` decorator.

		this._attrs = new this.glii.InterleavedAttributes(
			{
				size: 1,
				growFactor: 1.2,
				usage: this.glii.STATIC_DRAW,
			},
			[
				{
					// RGBA Colour
					glslType: "vec4",
					type: Uint8Array,
					normalized: true,
				},
				{
					// Width, in 256ths of CSS pixels.
					// Used for fading.
					glslType: "float",
					type: Uint16Array,
					normalized: false,
				},
			]
		);

		this._geomAttrs = new this.glii.InterleavedAttributes(
			{
				size: 1,
				growFactor: 1.2,
				usage: this.glii.STATIC_DRAW,
			},
			[
				{
					// Vertex extrusion amount
					glslType: "vec2",
					type: Float32Array,
					normalized: false,
				},
				{
					// Segment length: lenght at vertex (either 0 or full),
					// and segment lenght.
					// Used for fading. The values will be interpolated in the
					// non-cap triangles of each segment.
					glslType: "vec2",
					type: Float32Array,
					normalized: false,
				},
			]
		);
	}

	glProgramDefinition() {
		const opts = super.glProgramDefinition();

		return {
			...opts,
			attributes: {
				aColour: this._attrs.getBindableAttribute(0),
				aWidth: this._attrs.getBindableAttribute(1),
				aExtrude: this._geomAttrs.getBindableAttribute(0),
				aLength: this._geomAttrs.getBindableAttribute(1),
				...opts.attributes,
			},
			uniforms: {
				uPixelSize: "vec2",
				uScale: "float",
				...opts.uniforms,
			},
			vertexShaderMain: `
				vColour = aColour;
				vLength = aLength / uScale;
				vWidth = aWidth / 512.;

				gl_Position = vec4(
					vec3(aCoords, 1.0) * uTransformMatrix
					+ vec3(aExtrude * uPixelSize, 0.0)
					, 1.0);
			`,
			varyings: {
				vColour: "vec4",
				vLength: "vec2",
				vWidth: "float", // *half* the width
				// vExterior: "float",
				// vDashArray: "vec4",
				// vAccLength: "float",
				// vMiter: "float", // Only for joins: px distance to node
			},
			fragmentShaderMain: `
				gl_FragColor = vColour;

				float position = min(vLength.x, vLength.y - vLength.x);
				float opacity = 0.5 + min(position / vWidth, 1.0) / 2.;

				gl_FragColor.a *= opacity;
			`,
			blend: {
				equationRGB: this.glii.FUNC_ADD,
				equationAlpha: this.glii.FUNC_ADD,

				srcRGB: this.glii.ONE_MINUS_DST_ALPHA,
				srcAlpha: this.glii.ONE,
				dstRGB: this.glii.DST_ALPHA,
				dstAlpha: this.glii.ONE,
			},
		};
	}

	resize(w, h) {
		super.resize(w, h);
		const dpr2 = (devicePixelRatio ?? 1) * 2;
		this._programs.setUniform("uPixelSize", [dpr2 / w, dpr2 / h]);
	}

	runProgram() {
		this._programs.setUniform("uScale", this.platina.scale);
		super.runProgram();
	}

	_getStridedArrays(maxVtx, maxIdx) {
		return [
			// Indices
			this._indices.asTypedArray(maxIdx),

			// Width (for fading)
			this._attrs.asStridedArray(1, maxVtx),
		];
	}

	_getGeometryStridedArrays(maxVtx, maxIdx) {
		return [
			// CRS coords
			this._coords.asStridedArray(maxVtx),

			// Extrusion
			this._geomAttrs.asStridedArray(0, maxVtx),

			// Segment length (and relative length position)
			this._geomAttrs.asStridedArray(1),

			// Point strides
			this._getPerPointStridedArrays(maxVtx, maxIdx),

			// Segment strides
			this._getPerSegmentStridedArrays(maxVtx, maxIdx),
		];
	}

	_commitStridedArrays(baseVtx, vtxLength, baseIdx, idxLength) {
		this._attrs.commit(baseVtx, vtxLength);
		this._indices.commit(baseIdx, idxLength);
	}

	_commitGeometryStridedArrays(baseVtx, vtxLength /*, baseIdx, totalIndices*/) {
		this._geomAttrs.commit(baseVtx, vtxLength);
		this._attrs.commit(baseVtx, vtxLength);
		this._commitPerPointStridedArrays(baseVtx, vtxLength);
	}

	_getPerPointStridedArrays(_maxVtx, _maxIdx) {
		return [];
	}

	_getPerSegmentStridedArrays(maxVtx, _maxIdx) {
		return [
			// Colour
			this._attrs.asStridedArray(0, maxVtx),
		];
	}

	multiAdd(syms) {
		super.multiAdd(syms);
		super.multiAllocate(syms);

		return this;
	}

	reproject(start, length, symbols) {
		const end = start + length;

		// In most cases, it's safe to assume that relevant symbols in the same
		// attribute allocation block have their vertex attributes in a
		// compacted manner.
		// The exception is tiles: tile vertex attributes are allocated in bulk
		// (enough to fill a whole texture atlas), before actually instantiating
		// tile symbols. Tile acetates shall overload this method.

		const stridedCoords = this._coords.asStridedArray(end);
		const geomStrides = this._getGeometryStridedArrays(end);

		const relevantSymbols =
			symbols ??
			this._knownSymbols.filter((symbol, attrIdx) => {
				return attrIdx >= start && attrIdx + symbol.attrLength <= start + length;
			});

		relevantSymbols.forEach((s) => {
			const geom = s.geometry.toCRS(this._crs);
			// stridedCoords.set(geom.coords, s.attrBase);
			s._setGeometryStrides(geom, ...geomStrides);
		});

		this._coords.commit(start, length);
		this._commitGeometryStridedArrays(start, length);

		const coordData = new Float32Array(stridedCoords.buffer, start * 8, length * 2);
		super.expandBBox(coordData);
		return coordData;
	}
}

/**
 * @class Chain
 * @inherits GleoSymbol
 * @relationship drawnOn AcetetateChain
 *
 * Draws line geometries as a set of overlapping 2-point segments.
 *
 * Behaves similar to `Stroke` symbols, but handles the line joins ("corners")
 * differently: instead of calculating joins, corner points are drawn twice
 * at half the opacity.
 *
 * Compared with `Stroke`s, `Chain`s produce less graphical artefacts when
 * drawing thick, short lines. The downside is reduced fidelity for corners
 * between long segments.
 *
 */

class Chain extends GleoSymbol {
	static Acetate = AcetateChain;

	#colour;
	#width;
	// #dashArray;
	// #centerline;

	/**
	 * @constructor Chain(geom: Geometry, opts?: Chain Options)
	 */
	constructor(
		geom,
		{
			/**
			 * @section
			 * @aka Stroke Options
			 * @option colour: Colour = '#3388ff'
			 * The colour of the chain.
			 * @alternative
			 * @option colour: Array of Colour
			 * The colour of each segment of the chain. There must be enough elements.
			 */
			colour = "#3388ff",
			/**
			 * @option width: Number = 4
			 * The width of the chain, in CSS pixels
			 */
			width = 4,

			...opts
		} = {}
	) {
		super(geom, opts);

		this.#calcStorage();

		this.#colour = this.constructor._parseColour(colour);
		if (this.#colour === null && Array.isArray(colour)) {
			this.#colour = colour.map(this.constructor._parseColour);
		}

		this.#width = width;
	}

	#segmentCount;

	#calcStorage() {
		const segmentCount = (this.#segmentCount =
			this.geometry.coords.length / this.geometry.dimension -
			this.geometry.rings.length -
			this.geometry.hulls.length -
			1);

		// Each segment has 10 vertices and 10 triangles (30 triangle primitive indices)
		this.attrLength = segmentCount * 10;
		this.idxLength = segmentCount * 30;
	}

	_setGlobalStrides(typedIdxs, strideWidth) {
		/*
		 * Vertices connect as follows, 1 and 6 being the offset-zero points
		 * of the segment.
		 *
		 *      0---5
		 *     /|\  |\
		 *    3 | \ | 8
		 *    |\|  \|/|
		 *    | 1---6 |
		 *    |/|\  |\|
		 *    4 | \ | 9
		 *     \|  \|/
		 *      2---7
		 *
		 * (This is compatible with the LINECAP point extrusion type: line caps have
		 * the centerline at the 2nd (offset 1) vertex).
		 */

		// prettier-ignore
		const idxMap = [
			1, 0, 3,
			1, 3, 4,
			1, 4, 2,
			1, 6, 0,
			0, 6, 5,
			1, 7, 6,
			1, 2, 7,
			6, 8, 5,
			6, 9, 8,
			6, 7, 9,
		];

		let idx = this.idxBase;

		for (let i = 0; i < this.#segmentCount; i++) {
			const offset = this.attrBase + i * 10;
			typedIdxs.set(
				idxMap.map((n) => n + offset),
				idx
			);
			idx += 30;
		}

		let w = this.#width * 256;
		for (let i = 0; i < this.attrLength; i++) {
			strideWidth.set([w], this.attrBase + i);
		}
	}

	_setGeometryStrides(
		geom,
		strideCoords,
		strideExtrude,
		strideLength,
		perPointStrides,
		perSegmentStrides
	) {
		const w = this.#width / 2;

		geom.mapRings((start, end, _length, _r) => {
			for (let i = start + 1; i < end; i++) {
				const coordAx = geom.coords[(i - 1) * geom.dimension];
				const coordAy = geom.coords[(i - 1) * geom.dimension + 1];
				const coordBx = geom.coords[i * geom.dimension];
				const coordBy = geom.coords[i * geom.dimension + 1];

				const Δx = coordBx - coordAx;
				const Δy = coordBy - coordAy;
				const ϕ = Math.atan2(Δy, Δx);

				// Plus 90 degrees counter-clockwise
				const ϕ90 = ϕ + Δϕ90;
				const cosϕ90 = w * Math.cos(ϕ90);
				const sinϕ90 = w * Math.sin(ϕ90);

				// Plus 150 degrees counter-clockwise
				const ϕ150 = ϕ + Δϕ150;
				const cosϕ150 = w * Math.cos(ϕ150);
				const sinϕ150 = w * Math.sin(ϕ150);

				// Plus 210 degrees counter-clockwise
				const ϕ210 = ϕ - Δϕ150;
				const cosϕ210 = w * Math.cos(ϕ210);
				const sinϕ210 = w * Math.sin(ϕ210);

				const vtx = this.attrBase + i * 10 - 10;

				strideExtrude.set([cosϕ90, sinϕ90], vtx + 0);
				strideExtrude.set([0, 0], vtx + 1);
				strideExtrude.set([-cosϕ90, -sinϕ90], vtx + 2);
				strideExtrude.set([cosϕ150, sinϕ150], vtx + 3);
				strideExtrude.set([cosϕ210, sinϕ210], vtx + 4);

				strideExtrude.set([cosϕ90, sinϕ90], vtx + 5);
				strideExtrude.set([0, 0], vtx + 6);
				strideExtrude.set([-cosϕ90, -sinϕ90], vtx + 7);
				strideExtrude.set([-cosϕ210, -sinϕ210], vtx + 8);
				strideExtrude.set([-cosϕ150, -sinϕ150], vtx + 9);

				// prettier-ignore
				strideCoords.set([
					coordAx, coordAy,
					coordAx, coordAy,
					coordAx, coordAy,
					coordAx, coordAy,
					coordAx, coordAy,

					coordBx, coordBy,
					coordBx, coordBy,
					coordBx, coordBy,
					coordBx, coordBy,
					coordBx, coordBy,
				], vtx);

				// Length of segment
				const l = Math.sqrt(Δx * Δx + Δy * Δy);

				// Five first vertices are at position zero, five last ones
				// are at position 100% length
				for (let i = 0; i < 5; i++) {
					strideLength.set([0, l], vtx + i);
				}
				for (let i = 5; i < 10; i++) {
					strideLength.set([l, l], vtx + i);
				}

				/// TODO: Trick lengths at first and last point in the geometry
				/// ring, unless the ring loops

				this._setPerSegmentStrides(
					i - 1,
					this.attrBase + i * 10 - 10,
					10,
					geom,
					...perSegmentStrides
				); /// TODO!!!!

				this._setPerPointStrides(
					i - 1,
					LINECAP,
					this.attrBase + i * 10 - 10,
					5,
					...perPointStrides
				);
				this._setPerPointStrides(
					i,
					LINECAP,
					this.attrBase + i * 10 - 5,
					5,
					...perPointStrides
				);
			}
		});
	}

	_setPerPointStrides(_n, _pointType, _vtx, _vtxCount, _geom, ..._strides) {
		// noop
	}

	_setPerSegmentStrides(n, vtx, vtxCount, _geom, strideColour) {
		const segmentColour =
			Array.isArray(this.#colour) && Array.isArray(this.#colour[0])
				? this.#colour[n]
				: this.#colour;
		for (let i = 0; i < vtxCount; i++) {
			strideColour.set(segmentColour, vtx + i);
		}
	}

	static _parseColour = parseCSSColor;
}

/**
 * @class ExtrudedPoint
 * @inherits GleoSymbol
 *
 * Abstract class, containing functionality common to symbols displayed as
 * triangles whose vertices are extruded from a central point, which
 * corresponds to the point `Geometry` of the symbol.
 *
 * i.e. `Sprite`, `CircleFill`, `CircleStroke`, and `Pie` so far.
 */

class ExtrudedPoint extends GleoSymbol {
	constructor(
		geom,
		{
			/**
			 * @option draggable: Boolean = false
			 * When set to `true`, the symbol can be dragged around with the pointer,
			 * and will fire `dragstart`/`drag`/`dragend` events.
			 */
			draggable = false,
			interactive = true,

			/**
			 * @option offset: Array of Number = [0,0]
			 * The amount of CSS pixels that the symbol will be offset from its
			 * geometry. The amount is up-right in `[x, y]` or `[up, right]` form.
			 */
			offset = [0, 0],

			...opts
		} = {}
	) {
		super(geom, { ...opts, interactive });

		this.#offset = offset;

		this._assertGeom(this.geometry);

		this.draggable = draggable;
	}

	#offset;

	get geometry() {
		return super.geometry;
	}
	set geometry(geom) {
		super.geometry = geom;
		if (this._inAcetate && this.attrBase !== undefined) {
			this._inAcetate.reproject(this.attrBase, this.attrLength);
			if ("dirty" in this._inAcetate) {
				this._inAcetate.dirty = true;
			}
		}
	}

	/**
	 * @property offset: Array of Number
	 * Getter/setter for the symbol's offset, as per the homonymous option.
	 */
	get offset() {
		return this.#offset;
	}
	set offset(offset) {
		this.#offset = offset;
		if (this._inAcetate && this.attrBase !== undefined) {
			const strideExtrusion = this._inAcetate._extrusions.asStridedArray();
			this._setStridedExtrusion(strideExtrusion);
			this._inAcetate._extrusions.commit(this.attrBase, this.attrLength);
			this._inAcetate.dirty = true;
		}
	}

	// Asserts that the geometry passed is a point geometry.
	_assertGeom(geom) {
		if (geom.coords.length !== geom.dimension) {
			/// TODO: Treat multi-point geometries as multipoints. See
			/// https://gitlab.com/IvanSanchez/gleo/-/issues/37
			throw new Error(
				"Geometry passed to ExtrudedPoint symbol is not a single point (is a line or polygon instead)."
			);
		}
	}

	#draggable = false;

	/**
	 * @section Subclass interface
	 * @uninheritable
	 * @method _setStridedExtrusion(strideExtrusion: StridedTypedArray): undefined
	 * Must be implemented by subclasses; must set values into the given
	 * `StridedTypedArray`.
	 *
	 * @method _setGlobalStrides(*): undefined
	 * Must be implemented by subclasses. Will receive a variable number of
	 * arguments depending on the Acetate implementaion: strided attribute arrays,
	 * strided index buffer, and constants. The implementation must fill the
	 * strided arrays appropriately.
	 */

	/**
	 * @section
	 * @property draggable: Boolean
	 * Whether the symbol can be dragged with pointer events. By (re)setting its
	 * value, dragging is enabled or disabled.
	 */
	/// TODO: Dragging behaviour with multipoint geometries is very tricky (for
	/// one, all instances of the symbol would share the same internal ID for
	/// pointer event target detection).
	/// For now, the dragging logic assumes single point geometry.
	get draggable() {
		return this.#draggable;
	}

	set draggable(d) {
		d = !!d;
		if (d === this.#draggable) {
			return;
		}
		if (d) {
			// enable
			this.#boundOnPointerDown ??= this.#onPointerDown.bind(this);
			this.#boundOnPointerMove ??= this.#onPointerMove.bind(this);
			this.#boundOnPointerUp ??= this.#onPointerUp.bind(this);

			this.on("pointerdown", this.#boundOnPointerDown);
			this.on("pointerup", this.#boundOnPointerUp);
			this.on("pointercancel", this.#boundOnPointerUp);
		} else {
			// disable
			this.off("pointerdown", this.#boundOnPointerDown);
			// this.off('pointermove', this.#boundOnPointerMove);
			this.off("pointerup", this.#boundOnPointerUp);
			this.off("pointercancel", this.#boundOnPointerUp);
		}

		this.#draggable = d;
	}

	#boundOnPointerDown;
	#boundOnPointerMove;
	#boundOnPointerUp;

	#pxDelta; // Delta between the symbol's geometry and the initial pointer event

	#onPointerDown(ev) {
		this.on("pointermove", this.#boundOnPointerMove);
		this.setPointerCapture(ev.pointerId);

		// Calculate the delta between the pointer hit point and the
		// symbol's geometry
		const geomPx = this._inAcetate._platina.geomToPx(this.geom);
		const evPx = getMousePosition(ev);
		this.#pxDelta = [evPx[0] - geomPx[0], evPx[1] - geomPx[1]];

		/**
		 * @section
		 * @event dragstart
		 * Fired whenever the user starts dragging a draggable `ExtrudedPoint`.
		 */
		this.fire("dragstart");

		ev.stopPropagation();
	}
	#onPointerMove(ev) {
		ev.stopPropagation();
		ev.preventDefault();

		const evPx = getMousePosition(ev);
		const geomPx = [evPx[0] - this.#pxDelta[0], evPx[1] - this.#pxDelta[1]];
		this.geometry = this._inAcetate._platina.pxToGeom(geomPx);
		/**
		 * @event drag
		 * Fired whenever the user keeps dragging a draggable `ExtrudedPoint`.
		 */
		this.fire("drag");
	}
	#onPointerUp(ev) {
		this.off("pointermove", this.#boundOnPointerMove);
		ev.stopPropagation();
		/**
		 * @event dragend
		 * Fired whenever the user stops dragging a draggable `ExtrudedPoint`.
		 */
		this.fire("dragend");
	}
}

/// TODO: Turn this into a mixin. There might be a need for interactive `AcetateDot`s.

/**
 * @class AcetateInteractive
 * @inherits AcetateVertices
 *
 * @relationship associated GleoEvent, 0..1, 0..n
 *
 * An `Acetate` that renders its symbols into an invisible framebuffer
 * so pointer events can query it to know the symbol that has been rendered
 * in a given pixel.
 */
class AcetateInteractive extends AcetateVertices {
	constructor(
		target,
		{
			/**
			 * @section AcetateInteractive Options
			 * @option interactive: Boolean = true
			 * When set to `false`, disables all interactivity of symbols in this
			 * acetate, regardless of the symgols' settings. *Should* improve
			 * performance a bit when off.
			 */
			interactive = true,

			/**
			 * @option pointerTolerance: Number = 3
			 * The distance, in CSS pixels, that the pointer can be away from
			 * a symbol to trigger a pointer event.
			 *
			 * (This is achieved internally by extruding vertices this
			 * extra amount; it does **not** perfectly buffer the visible
			 * symbol, but rather makes the clickable triangles slightly larger
			 * than the visible triangles)
			 *
			 * (This assumes that the sprite image somehow fills its space;
			 * transparent regions in the sprite image will shift and may behave
			 * unintuitively; a transparent border will effectively lower the
			 * extra tolerance)
			 */
			pointerTolerance = 3,

			...opts
		} = {}
	) {
		super(target, opts);

		if (interactive) {
			this.#isInteractive = true;
			this.#pointerTolerance = pointerTolerance;
			try {
				if (!(this.glii.gl instanceof WebGL2RenderingContext)) {
					// This enables the *creation* of floating point textures
					this.glii.loadExtension("OES_texture_float");
				}
				// This enables *rendering* to a floating point texture
				this.glii.loadExtension("EXT_color_buffer_float");

				// This enables *overlapping* triangles on the floating point texture
				this.glii.loadExtension("EXT_float_blend");

				this.#webgl2 = true;
			} catch (ex) {
				this.#webgl2 = false;
			}

			if (this.#webgl2) {
				// The default is to use R32F textures, which needs WebGL2 or a
				// bunch of extensions.
				this.#ids = new this.glii.SingleAttribute({
					size: 1,
					growFactor: 1.2,
					usage: this.glii.STATIC_DRAW,

					glslType: "float",
					type: Float32Array,
					normalized: true,
				});
			} else {
				// IDs are always integers, and are stored as 1-byte vec4s.
				// This is done in order to simplify the GL workflow: when rendering
				// into a texture (into a framebuffer with a texture as its 0th
				// colour attachment), the texture must be RGBA/UNSIGNED_BYTE.
				// In order to avoid as many calculations inside the shaders,
				// the JS layer will hack int32s into int24s into 3x int8s
				// into 3x 8-bit RGBA, the shaders will only handle 8-bit vec3s,
				// filling the alpha byte to 0xff; reading
				// from the framebuffer will return 4x 8-bit RGBA, and the JS
				// layer will glue together the int24 from that.
				this.#ids = new this.glii.SingleAttribute({
					size: 1,
					growFactor: 1.2,
					usage: this.glii.STATIC_DRAW,

					glslType: "vec4",
					type: Uint8Array,
					normalized: true,
				});
			}

			// The internal `Map` from numerical ID to `GleoSymbol` instance.
			this.#idMap = new Map();

			this.#nextSymbolId = 1;
		} else {
			this.#isInteractive = false;
		}
	}

	#isInteractive;
	#pointerTolerance;
	#webgl2;
	#ids;
	#idMap;
	#nextSymbolId;

	#idsTexture;
	#idsFramebuffer;
	#idProgram;

	// Needed for setPointerCapture/releasePointerCapture functionality.
	#pointerCaptureMap = new Map();

	/**
	 * @property isInteractive: Boolean
	 * Whether the acetate has interactivty (pointer events) enabled. Read-only.
	 */
	get isInteractive() {
		return this.#isInteractive;
	}

	resize(x, y) {
		super.resize(x, y);
		if (!this.#isInteractive) {
			return this;
		}

		const glii = this.glii;
		const opts = this.glIdProgramDefinition();

		if (!this.#idsFramebuffer) {
			// 		this.#idsTexture && this.#idsTexture.destroy();
			// 		this.#idsFramebuffer && this.#idsFramebuffer.destroy();
			if (this.#webgl2) {
				// R32F texture
				this.#idsTexture = new glii.Texture({
					format: glii.gl.RED,
					internalFormat: glii.gl.R32F,
					type: glii.FLOAT,
				});
			} else {
				// Default RGBA8 output texture
				this.#idsTexture = new glii.Texture({});
			}

			this.#idsFramebuffer = new glii.FrameBuffer({
				color: [this.#idsTexture],
				depth: new glii.RenderBuffer({
					width: x,
					height: y,
					internalFormat: glii.DEPTH_COMPONENT16,
				}),
				width: x,
				height: y,
			});
		} else {
			this.#idsFramebuffer.resize(x, y);
		}

		if (this.#idProgram) {
			this.#idProgram.setTarget(this.#idsFramebuffer);
		} else {
			opts.fragmentShaderSource += opts.fragmentShaderMain
				? `\nvoid main(){${opts.fragmentShaderMain}}`
				: "";
			opts.target = this.#idsFramebuffer;
			this.#idProgram = new glii.WebGL1Program(opts);

			this._programs.addProgram(this.#idProgram);
		}

		// Assuming that a resize means that the devicePixelRatio
		// might have changed. This is common in desktop browsers with
		// Ctrl+'+' / Ctrl+'-'
		this.#idProgram.setUniform(
			"uPointerTolerance",
			this.#pointerTolerance * (devicePixelRatio ?? 1)
		);

		const depthClear =
			opts.depth === glii.LEQUAL || opts.depth === glii.LESS ? 1 : -1;

		this._idClear = new glii.WebGL1Clear({
			color: [0, 0, 0, 0],
			// color: [1, 1, 1, 1],
			target: this.#idsFramebuffer,
			// depth: 1 << 15,
			depth: depthClear,
			// depth: 0.6,
		});

		return this;
	}

	/**
	 * @property idsTexture: Texture
	 * Read-only accessor to the Glii `Texture` holding the internal IDs of
	 * interactive symbols.
	 */
	get idsTexture() {
		return this.#idsTexture;
	}

	/**
	 * @section Subclass interface
	 * @uninheritable
	 *
	 * Subclasses of `Acetate` can provide/define the following methods:
	 *
	 * @method glIdProgramDefinition(): Object
	 * Returns a set of `WebGL1Program` options, that will be used to create the WebGL1
	 * program to be run at every refresh to create the texture containing the symbol IDs.
	 * This is needed for the `getSymbolAt()` functionality to work.
	 *
	 * By default, the non-interactive program (i.e. the result of `glProgramDefinition`)
	 * is reused. The ID attribute `aId` is added, a new varying `vId` is added,
	 * the vertex shader is modified to dump the new attribute into the new varying,
	 * and the fragment shader is replaced.
	 *
	 * The default interactive fragment shader dumps `vId` to the RGB component and
	 * sets the alpha value. It looks like:
	 * ```glsl
	 * void main() {
	 * 	gl_FragColor.rgb = vId;
	 * 	gl_FragColor.a = 1.0;
	 * }`
	 * ```
	 *
	 * Subclasses can redefine the fragment shader source if desired; a use case is to apply
	 * masking so that transparent fragments of the `GleoSymbol` are `discard`ed
	 * within the interactive fragment shader (see the implementation of `AcetateSprite`).
	 * It's recommended that subclasses don't change any other bits of this program definition.
	 */
	glIdProgramDefinition() {
		const def = this.glProgramDefinition();

		/// TODO: Modify this shader so that if aID.a is (lower than) zero, then
		/// the vertex's gl_Position is (0,0,0,0) and no fragments are spawned.

		const regexpExtrude = /(\W)aExtrude(\W)/g;
		const replacementExtrude = function replacement(_, pre, post) {
			return `${pre}(aExtrude + uPointerTolerance * sign(aExtrude))${post}`;
		};

		return {
			...def,
			attributes: {
				aId: this.#ids,
				...def.attributes,
			},
			uniforms: {
				uPointerTolerance: "float",
				...def.uniforms,
			},
			vertexShaderSource:
				def.vertexShaderSource.replace(regexpExtrude, replacementExtrude) +
				(this.#webgl2
					? `
				void main() {
					// if (aId > 0.0) {
						vId = aId;
						${def.vertexShaderMain}
					// }
				}`
					: `
				void main() {
					if (aId.a > 0.0) {
						vId = aId;
						${def.vertexShaderMain}
					}
				}`),
			varyings: {
				vId: this.#webgl2 ? "float" : "vec4",
				...def.varyings,
			},
			fragmentShaderMain: this.#webgl2
				? `gl_FragColor.r = vId;`
				: `gl_FragColor = vId;`,
			// depth: this.glii.LESS,
			// depth: this.glii.GREATER,
			unusedWarning: false,
			blend: {
				equationRGB: this.glii.FUNC_ADD,
				equationAlpha: this.glii.FUNC_ADD,

				srcRGB: this.glii.ONE,
				srcAlpha: this.glii.ONE,
				dstRGB: this.glii.ZERO,
				dstAlpha: this.glii.ZERO,
			},
		};
	}

	/**
	 * @method multiAddIds(symbols: Array of GleoSymbol, baseVtx: Number, maxVtx?: Number): this
	 * Given an array of symbols (as per `multiAdd`) and a base vertex index,
	 * assigns a numerical ID to each symbol (unique in the acetate), packs
	 * the data, and updates the corresponding attribute buffer.
	 *
	 * This is meant to be called from within the `multiAdd()` method of subclasses.
	 */
	multiAddIds(symbols, baseVtx, maxVtx) {
		if (!this.#isInteractive) {
			return this;
		}

		if (!maxVtx) {
			maxVtx = 0;
			symbols.forEach(
				(s) => (maxVtx = Math.max(maxVtx, s.attrBase + s.attrLength))
			);
		}

		/// TODO: Use a Glii `Allocator` instead of an incrementing counter.
		/// There is no foreseeable case where 2^24 (16m777k216) symbols will
		/// be added to an acetate, though.

		// const strideIds = this.#ids.asStridedArray(baseVtx + symbols.length);
		const strideIds = this.#ids.asStridedArray(maxVtx);

		if (this.#webgl2) {
			symbols.forEach((s) => {
				if (s.interactive) {
					const id = s._id ?? (this.#nextSymbolId += 1);
					this.#idMap.set(id, s);
					s._id = id;
					for (
						let i = s.attrBase, end = s.attrBase + s.attrLength;
						i < end;
						i++
					) {
						strideIds.set([id], i);
					}
				}
			});
		} else {
			let packedId = new Uint8Array(4);
			symbols.forEach((s) => {
				if (s.interactive) {
					const id = s._id ?? (this.#nextSymbolId += 1);
					s._id = id;
					this.#idMap.set(id, s);
					// packedId[0] = id & 0x3f;
					// packedId[1] = (id >> 6) & 0x3f;
					// packedId[2] = (id >> 12) & 0x3f;
					packedId[0] = id & 0xff;
					packedId[1] = (id & 0xff00) >> 8;
					packedId[2] = (id & 0xff0000) >> 16;
					packedId[3] = 0xff;
				} else {
					packedId.fill(0);
				}
				for (let i = s.attrBase, end = s.attrBase + s.attrLength; i < end; i++) {
					strideIds.set(packedId, i);
				}
			});
		}
		this.#ids.commit(baseVtx, maxVtx - baseVtx);

		return this;
	}

	/**
	 * @method deallocate(symbol: GleoSymbol): this
	 * Deallocates the symbol from this acetate (so it's not drawn on the next refresh),
	 * and removes the reference from its numerical ID.
	 */
	remove(symbol) {
		if (!this.#isInteractive) {
			return super.remove(symbol);
		}
		if (symbol === this.#hoveredSymbol && symbol.cursor) {
			this.platina.unqueueCursor(symbol.cursor);
			this.#hoveredSymbol = undefined;
		}
		this.#idMap.delete(symbol._id);
		symbol._id = undefined;
		return super.remove(symbol);
	}

	clear() {
		if (this.#isInteractive) {
			this._idClear?.run();
		}
		return super.clear();
	}

	/**
	 * @section Internal Methods
	 * @uninheritable
	 *
	 * @method getSymbolAt(x: Number, y: Number): GleoSymbol
	 * Given the (CSS) pixel coordinates of a point (relative to the upper-left corner of
	 * the `GleoMap`'s `<canvas>`), returns the `GleoSymbol` that has been drawn
	 * at that pixel.
	 *
	 * Returns `undefined` if there is no `GleoSymbol` being drawn at the given
	 * pixel.
	 */
	getSymbolAt(x, y) {
		if (!this.#isInteractive || !this.#idsFramebuffer) {
			return undefined;
		}

		// Textures are inverted in the Y axis because WebGL shenanigans. I know.
		const h = this.#idsFramebuffer.height;
		const dpr = devicePixelRatio ?? 1;
		const [r, g, b, a] = this.#idsFramebuffer.readPixels(dpr * x, h - dpr * y, 1, 1);

		if (this.#webgl2) {
			return this.#idMap.get(r);
		} else {
			if (!a) {
				return undefined;
			}

			const id = r + 0x100 * g + 0x10000 * b;
			return this.#idMap.get(id);
		}
	}

	#hoveredSymbol;

	/**
	 * @method setPointerCapture(pointerId: Number, symbol: GleoSymbol): this
	 * Sets pointer capture for the given pointer ID to the given symbol.
	 * When pointer capture is set (for a pointer ID), normal hit detection is
	 * skipped, and the capturing symbol will receive the event instead.
	 *
	 * See [`Element.setPointerCapture()`](https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture)
	 */
	setPointerCapture(pointerId, symbol) {
		this.#pointerCaptureMap.set(pointerId, symbol);
		return this;
	}

	/**
	 * @method releasePointerCapture(pointerId: Number): this
	 * Clears pointer capture for the given pointer ID. Inverse of `setPointerCapture`.
	 *
	 * See [`Element.releasePointerCapture()`](https://developer.mozilla.org/docs/Web/API/Element/releasePointerCapture)
	 */
	releasePointerCapture(pointerId) {
		/// TODO: Should this take a `GleoSymbol` as well, to provide a sanity check?
		/// i.e. only a capturing symbol should release capture on a pointer ID.
		this.#pointerCaptureMap.delete(pointerId);
		return this;
	}

	/**
	 * @method dispatchPointerEvent(ev: GleoPointerEvent, evInit: Object): Boolean
	 * Given a event, finds what symbol in this acetate should receive the event
	 * and, if any, makes that symbol dispatch the event. If the symbol event
	 * is not `preventDefault`ed, the acetate itself dispatches the event afterwards.
	 *
	 * This is meant to be called *only* from the containing `GleoMap`.
	 *
	 * Since a `GleoPointerEvent` of type `pointermove` might mean entering/leaving
	 * a symbol, extra `pointerenter`/`pointerover`/`pointerout`/`pointerleave`
	 * might be dispatched as well. To internally ease that, dispatching an event
	 * requires a `evInit` dictionary with which to instantiate these new
	 * synthetic events.
	 *
	 * Return value as per `EventTarget`'s `dispatchEvent`: Boolean `false`
	 * if the event is `preventDefault()`ed, at either the symbol or the acetate level.
	 *
	 * FIXME: This **assumes** that the bbox of the acetate and the containing map
	 * are the same. It should be needed to modify the logic and rely on the `geom`
	 * property of the decorated `GleoPointerEvent` instead.
	 *
	 * That would involve caching the (direct) CRS affine matrix from the last
	 * time the acetate was drawn, apply it to the event's `geom` and then round the
	 * resulting pixel coordinate.
	 */
	dispatchPointerEvent(ev, init) {
		if (this.queryable) {
			ev.colour = init.colour = this.getColourAt(ev.canvasX, ev.canvasY);
		}
		if (!this.#isInteractive) {
			return this.dispatchEvent(ev);
		}

		let symbol;
		if (
			ev.type !== "pointercancel" &&
			ev.type !== "pointerleave" &&
			ev.type !== "pointerout"
		) {
			const capturingSymbol = this.#pointerCaptureMap.get(ev.pointerId);
			if (capturingSymbol) {
				symbol = capturingSymbol;
			} else {
				symbol = this.getSymbolAt(ev.canvasX, ev.canvasY);
			}
		}

		if (ev.type === "pointerup" || ev.type === "pointercancel") {
			this.releasePointerCapture(ev.pointerId);
		}

		// Same as map's _onPointerEvent, events should always be MouseEvent, but
		// Firefox doesn't respect that bit of the standard (as of now)
		const EventProto = ev instanceof PointerEvent ? GleoPointerEvent : GleoMouseEvent;

		if (this.#hoveredSymbol && this.#hoveredSymbol !== symbol) {
			this.#hoveredSymbol.dispatchEvent(new EventProto("pointerout", init));
			this.#hoveredSymbol.dispatchEvent(new EventProto("pointerleave", init));
			if (this.#hoveredSymbol.cursor) {
				this.platina.unqueueCursor(this.#hoveredSymbol.cursor);
			}
		}

		if (symbol) {
			if (this.#hoveredSymbol !== symbol) {
				symbol.dispatchEvent(new EventProto("pointerenter", init));
				symbol.dispatchEvent(new EventProto("pointerover", init));
				if (symbol.cursor) {
					this.platina.queueCursor(symbol.cursor);
				}
			}
			if (!symbol.dispatchEvent(ev)) {
				return false;
			}
			if (!symbol._eventParents.every((s) => s.dispatchEvent(ev))) {
				return false;
			}
			// } else {
			// 	this.releasePointerCapture(ev.pointerId);
		}

		this.#hoveredSymbol = symbol;

		return this.dispatchEvent(ev);
	}

	/// DEBUG
	get _idsTexture() {
		return this.#idsTexture;
	}
}

/**
 * @class AcetateExtrudedPoint
 * @inherits AcetateInteractive
 *
 * Abstract class, containing functionality common to acetates that draw point
 * symbols (`Sprite`, `Pie`, etc).
 */
class AcetateExtrudedPoint extends AcetateInteractive {
	constructor(glii, opts) {
		super(glii, opts);

		this._extrusions = new this.glii.SingleAttribute({
			usage: this.glii.STATIC_DRAW,
			size: 1,
			growFactor: 1.2,

			glslType: "vec2",
			type: Float32Array,
			normalized: false,
		});
	}

	glProgramDefinition() {
		const opts = super.glProgramDefinition();
		return {
			...opts,
			attributes: {
				...opts.attributes,
				aExtrude: this._extrusions,
			},
		};
	}

	_commitStridedArrays(baseVtx, vtxCount, baseIdx, idxCount) {
		this._extrusions.commit(baseVtx, vtxCount);
		this._attrs.commit(baseVtx, vtxCount);
		return super._commitStridedArrays(baseVtx, vtxCount, baseIdx, idxCount);
	}

	multiAdd(syms) {
		super.multiAdd(syms);
		return super.multiAllocate(syms);
	}

	/**
	 * @section Internal Methods
	 * @uninheritable
	 *
	 * @method reproject(start: Number, length: Number, symbols: Array of GleoSymbol): Array of Number
	 * Dumps a new set of values to the `this._coords` attribute buffer, based on the known
	 * set of symbols added to the acetate (only those which have their attribute offsets
	 * between `start` and `start+length`. Each symbol will spawn as many
	 * coordinate `vec2`s as their `attrLength` property.
	 *
	 * Returns the data set into the attribute buffer: a plain array of coordinates
	 * in the form `[x1,y1, x2,y2, ... xn,yn]`.
	 */
	reproject(start, length, symbols) {
		let relevantSymbols =
			symbols ??
			this._knownSymbols.filter((symbol, attrIdx) => {
				return (
					symbol.attrBase !== undefined &&
					attrIdx >= start &&
					attrIdx + symbol.attrLength <= start + length
				);
			});

		let addr = 0;

		// In most cases, it's safe to assume that relevant symbols in the same
		// attribute allocation block have their vertex attributes in a
		// compacted manner.

		const coordData = new Float64Array(length * 2);

		relevantSymbols.forEach((symbol) => {
			const projected = symbol.geometry.toCRS(this.platina.crs).coords;

			/// TODO: Debug edge case when offsetting CRS with clusters.
			// if (symbol.attrBase !== start + addr/2) {debugger;}

			for (let i = 0; i < symbol.attrLength; i++) {
				coordData.set(projected, addr);
				addr += 2;
			}
		});

		//console.log("Symbol reprojected:", coordData);
		this.multiSetCoords(start, coordData);

		this.dirty = true;

		return coordData;
	}
}

/**
 * @class AcetateSolidBorder
 * @inherits AcetateExtrudedPoint
 *
 * An `Acetate` for solid extrusions with two colours: fill and border.
 *
 * Used in `HeadingTriangle` and `Circle`.
 *
 */
class AcetateSolidBorder extends AcetateExtrudedPoint {
	constructor(target, opts) {
		super(target, { zIndex: 2500, opts });

		this._attrs = new this.glii.InterleavedAttributes(
			{
				usage: this.glii.STATIC_DRAW,
				size: 1,
				growFactor: 1.2,
			},
			[
				{
					// Fill RGBA colour
					glslType: "vec4",
					type: Uint8Array,
					normalized: true,
				},
				{
					// Border RGBA colour
					glslType: "vec4",
					type: Uint8Array,
					normalized: true,
				},
				{
					// Border width and feather width (in CSS pixels)
					glslType: "vec2",
					type: Float32Array,
					normalized: false,
				},
				{
					// Per-vertex distance from farthest edge. In a HeadingTriangle,
					// each vertex will have values like N-0-0, 0-N-0, 0-0-N.
					// In a Circle, all values are the same.
					// Units should be CSS pixels.
					glslType: "vec3",
					type: Float32Array,
					normalized: false,
				},
			]
		);
	}

	glProgramDefinition() {
		const opts = super.glProgramDefinition();
		return {
			...opts,
			attributes: {
				aFillColour: this._attrs.getBindableAttribute(0),
				aBorderColour: this._attrs.getBindableAttribute(1),

				// Per-triangle border and feather width
				aBorder: this._attrs.getBindableAttribute(2),

				// Per-vertex distance to edge
				aEdge: this._attrs.getBindableAttribute(3),

				...opts.attributes,
			},
			uniforms: {
				uPixelSize: "vec2",
				...opts.uniforms,
			},
			vertexShaderMain: `
				vFillColour = aFillColour;
				vBorderColour = aBorderColour;
				vBorder = aBorder;
				vEdge = aEdge;

				gl_Position = vec4(
						vec3(aCoords, 1.0) * uTransformMatrix +
						vec3(aExtrude * uPixelSize, 0.0)
						, 1.0);

			`,
			varyings: {
				vFillColour: "vec4",
				vBorderColour: "vec4",
				vBorder: "vec2",
				vEdge: "vec3",
			},
			fragmentShaderMain: `
				float edgeDistance = min(min(vEdge.x, vEdge.y), vEdge.z);

				if (edgeDistance < vBorder.x) {
					gl_FragColor = vBorderColour;
					gl_FragColor.a *= min(1., edgeDistance / vBorder.y);
				} else {
					// gl_FragColor = vFillColour /** edgeDistance / 16.*/;
					gl_FragColor = mix(vBorderColour, vFillColour, min(edgeDistance - vBorder.y / vBorder.x, 1.0));
				}

				// gl_FragColor.rgb = vEdge / 16.;
				// gl_FragColor.a = 1.;
			`,
		};
	}

	_getStridedArrays(maxVtx, maxIdx) {
		return [
			// Extrusion
			this._extrusions.asStridedArray(maxVtx),
			// Fill colour
			this._attrs.asStridedArray(0, maxVtx),
			// Border colour
			this._attrs.asStridedArray(1),
			// Border+feather
			this._attrs.asStridedArray(2),
			// Distance to edge
			this._attrs.asStridedArray(3),
			// Triangle indices
			this._indices.asTypedArray(maxIdx),
		];
	}

	// The map will call resize() on acetates when needed - besides redoing the
	// framebuffer with the new size, this needs to reset the uniform uPixelSize.
	resize(w, h) {
		super.resize(w, h);
		const dpr2 = (devicePixelRatio ?? 1) * 2;
		this._programs.setUniform("uPixelSize", [dpr2 / w, dpr2 / h]);
	}
}

/**
 * @class Circle
 * @inherits ExtrudedPoint
 * @relationship drawnOn AcetateSolidBorder
 *
 * A circle with both fill and stroke (i.e. perimeter line).
 *
 * Renders with a different `Acetate` than the simpler `CircleFill` and
 * `CircleStroke`.
 *
 * @example
 * ```js
 * new Circle([0, 0], {
 * 	fillColour: "red",
 * 	strokeColour: "black",
 * 	width: 3,
 * 	radius: 40
 * }).addTo(map);
 * ```
 */

class Circle extends ExtrudedPoint {
	/// @section Static properties
	/// @property Acetate: Prototype of AcetateSolidExtrusion
	// The `Acetate` class that draws this symbol.
	static Acetate = AcetateSolidBorder;

	#radius;
	#width;
	#fillColour;
	#strokeColour;
	#feather;

	/**
	 * @constructor CircleFill(geom: Geometry, opts?: CircleFill Options)
	 */
	constructor(
		geom,
		{
			/**
			 * @section
			 * @aka Circle Options
			 * @option radius: Number = 20; Radius of the circle, in CSS pixels
			 * @option width: Number = 4; Width of the border, in CSS pixels
			 * @option fillColour: Colour = '#3388ff33'; The fill colour
			 * @option strokeColour: Colour = '#3388ff33'; The border stroke colour
			 */
			radius = 20,
			width = 4,
			fillColour = "#3388ff33",
			strokeColour = "#3388ff",
			/**
			 * @option feather: Number = 0.5
			 * The width of the antialiasing feather, in CSS pixels.
			 */
			feather = 0.5,

			...opts
		} = {}
	) {
		super(geom, opts);

		this.#radius = radius;
		this.#width = width * 2;
		this.#fillColour = this.constructor._parseColour(fillColour);
		this.#strokeColour = this.constructor._parseColour(strokeColour);
		this.#feather = feather;

		// Length of circumference
		const length = Math.PI * 2 * this.#radius;
		// Divide in triangles so there's a triangle per...
		// 6 pixels of circumference length. That should be enough.
		this.steps = Math.max(7, Math.ceil(length / 6));
		// this.steps = 4;

		this.attrLength = this.steps + 1;
		this.idxLength = this.steps * 3;
	}

	/**
	 * @section Acetate interface
	 * @method _setGlobalStrides(strideExtrusion: StridedTypedArray, strideColour: StridedTypedArray, strideFeather: StridedTypedArray, typedIdxs: TypedArray): undefined
	 * Sets the appropriate values into the strided arrays, based on the
	 * symbol's `attrBase` and `idxBase`.
	 *
	 * Receives the width of the feathering as a parameter, in pixels.
	 */
	_setGlobalStrides(
		strideExtrusion,
		strideFillColour,
		strideBorderColour,
		strideBorder,
		strideEdgeDistance,
		typedIdxs
	) {
		// const feather = this._inAcetate.feather;

		// Radian increment per step
		const ɛ = (Math.PI * 2) / this.steps;

		const ρ = this.#radius + this.#feather / 2;
		const [Δx, Δy] = this.offset;

		// Attributes start with the center point
		strideExtrusion.set([Δx, Δy], this.attrBase);
		strideFillColour?.set(this.#fillColour, this.attrBase);
		strideBorderColour?.set(this.#strokeColour, this.attrBase);
		strideEdgeDistance.set([this.#radius, this.#radius, this.#radius], this.attrBase);

		let θ = 0;
		let vtx = this.attrBase + 1;
		let idx = this.idxBase;
		for (let i = 0; i < this.steps; i++) {
			strideExtrusion.set([Math.sin(θ) * ρ + Δx, Math.cos(θ) * ρ + Δy], vtx);
			strideFillColour?.set(this.#fillColour, vtx);
			strideBorderColour?.set(this.#strokeColour, vtx);

			// Vertices of the i-th triangle are: center, current, next
			if (i !== this.steps - 1) {
				typedIdxs?.set([this.attrBase, vtx, vtx + 1], idx);
			} else {
				typedIdxs?.set([this.attrBase, vtx, this.attrBase + 1], idx);
			}

			strideEdgeDistance.set([0, 0, 0], vtx);
			strideBorder.set([this.#width, this.#feather], vtx);

			θ += ɛ;
			vtx++;
			idx += 3;
		}
	}

	_setStridedExtrusion(strideExtrusion) {
		this._setGlobalStrides(strideExtrusion);
	}

	// Can be overriden by subclasses or the `intensify` decorator
	static _parseColour = parseCSSColor;
}

/**
 * @namespace Util
 *
 * @function imagifyFetchResponse(r: Response): Promise to HTMLImageElement
 *
 * Given a `Response` from a `fetch` call, wraps it into an image - meant for
 * `fetch` operations that are supposed to retrieve an image.
 *
 * If the parameter is not a `Response`, it will be passed through transparently.
 *
 */

function imagifyFetchResponse(r) {
	if (r instanceof Response) {
		return new Promise((res, rej) => {
			const img = new Image();
			img.addEventListener("load", (ev) => res(ev.target));
			img.addEventListener("error", rej);
			img.addEventListener("abort", rej);
			img.crossOrigin = true;
			r.blob().then((blob) => (img.src = URL.createObjectURL(blob)));
		});
	} else {
		return r;
	}
}

/**
 * ISC License
 *
 * Copyright (c) 2016, Mapbox
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose
 * with or without fee is hereby granted, provided that the above copyright notice
 * and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 * OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
 * TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
 * THIS SOFTWARE.
 */

/**
 * Create a new ShelfPack bin allocator.
 *
 * Uses the Shelf Best Height Fit algorithm from
 * http://clb.demon.fi/files/RectangleBinPack.pdf
 *
 * @ class  ShelfPack
 * @ param  {number}  [w=64]  Initial width of the sprite
 * @ param  {number}  [h=64]  Initial width of the sprite
 * @ param  {Object}  [options]
 * @ param  {boolean} [options.autoResize=false]  If `true`, the sprite will automatically grow
 * @ example
 * var sprite = new ShelfPack(64, 64, { autoResize: false });
 */
class ShelfPack {
	constructor(w, h, options) {
		options = options || {};
		this.w = w || 64;
		this.h = h || 64;
		this.autoResize = !!options.autoResize;
		this.shelves = [];
		this.freebins = [];
		this.stats = {};
		this.bins = {};
		this.maxId = 0;
	}

	/**
	 * Batch pack multiple bins into the sprite.
	 *
	 * @ param   {Object[]} bins       Array of requested bins - each object should have `width`, `height` (or `w`, `h`) properties
	 * @ param   {number}   bins[].w   Requested bin width
	 * @ param   {number}   bins[].h   Requested bin height
	 * @ param   {Object}   [options]
	 * @ param   {boolean}  [options.inPlace=false] If `true`, the supplied bin objects will be updated inplace with `x` and `y` properties
	 * @ returns {Bin[]}    Array of allocated Bins - each Bin is an object with `id`, `x`, `y`, `w`, `h` properties
	 * @ example
	 * var bins = [
	 *     { id: 1, w: 12, h: 12 },
	 *     { id: 2, w: 12, h: 16 },
	 *     { id: 3, w: 12, h: 24 }
	 * ];
	 * var results = sprite.pack(bins, { inPlace: false });
	 */
	pack(bins, options) {
		bins = [].concat(bins);
		options = options || {};

		var results = [],
			w,
			h,
			id,
			allocation;

		for (var i = 0; i < bins.length; i++) {
			w = bins[i].w || bins[i].width;
			h = bins[i].h || bins[i].height;
			id = bins[i].id;

			if (w && h) {
				allocation = this.packOne(w, h, id);
				if (!allocation) {
					continue;
				}
				if (options.inPlace) {
					bins[i].x = allocation.x;
					bins[i].y = allocation.y;
					bins[i].id = allocation.id;
				}
				results.push(allocation);
			}
		}

		// Shrink the width/height of the sprite to the bare minimum.
		// Since shelf-pack doubles first width, then height when running out of shelf space
		// this can result in fairly large unused space both in width and height if that happens
		// towards the end of bin packing.
		if (this.shelves.length > 0) {
			var w2 = 0;
			var h2 = 0;

			for (var j = 0; j < this.shelves.length; j++) {
				var shelf = this.shelves[j];
				h2 += shelf.h;
				w2 = Math.max(shelf.w - shelf.free, w2);
			}

			this.resize(w2, h2);
		}

		return results;
	}

	/**
	 * Pack a single bin into the sprite.
	 *
	 * Each bin will have a unique identitifer.
	 * If no identifier is supplied in the `id` parameter, one will be created.
	 * Note: The supplied `id` is used as an object index, so numeric values are fastest!
	 *
	 * Bins are automatically refcounted (i.e. a newly packed Bin will have a refcount of 1).
	 * When a bin is no longer needed, use the `ShelfPack.unref` function to mark it
	 *   as unused.  When a Bin's refcount decrements to 0, the Bin will be marked
	 *   as free and its space may be reused by the packing code.
	 *
	 * @ param    {number}         w      Width of the bin to allocate
	 * @ param    {number}         h      Height of the bin to allocate
	 * @ param    {number|string}  [id]   Unique identifier for this bin, (if unsupplied, assume it's a new bin and create an id)
	 * @ returns  {Bin}            Bin object with `id`, `x`, `y`, `w`, `h` properties, or `null` if allocation failed
	 * @ example
	 * var results = sprite.packOne(12, 16, 'a');
	 */
	packOne(w, h, id) {
		var best = { freebin: -1, shelf: -1, waste: Infinity },
			y = 0,
			bin,
			shelf,
			waste,
			i;

		// if id was supplied, attempt a lookup..
		if (typeof id === "string" || typeof id === "number") {
			bin = this.getBin(id);
			if (bin) {
				// we packed this bin already
				this.ref(bin);
				return bin;
			}
			if (typeof id === "number") {
				this.maxId = Math.max(id, this.maxId);
			}
		} else {
			id = ++this.maxId;
		}

		// First try to reuse a free bin..
		for (i = 0; i < this.freebins.length; i++) {
			bin = this.freebins[i];

			// exactly the right height and width, use it..
			if (h === bin.maxh && w === bin.maxw) {
				return this.allocFreebin(i, w, h, id);
			}
			// not enough height or width, skip it..
			if (h > bin.maxh || w > bin.maxw) {
				continue;
			}
			// extra height or width, minimize wasted area..
			if (h <= bin.maxh && w <= bin.maxw) {
				waste = bin.maxw * bin.maxh - w * h;
				if (waste < best.waste) {
					best.waste = waste;
					best.freebin = i;
				}
			}
		}

		// Next find the best shelf..
		for (i = 0; i < this.shelves.length; i++) {
			shelf = this.shelves[i];
			y += shelf.h;

			// not enough width on this shelf, skip it..
			if (w > shelf.free) {
				continue;
			}
			// exactly the right height, pack it..
			if (h === shelf.h) {
				return this.allocShelf(i, w, h, id);
			}
			// not enough height, skip it..
			if (h > shelf.h) {
				continue;
			}
			// extra height, minimize wasted area..
			if (h < shelf.h) {
				waste = (shelf.h - h) * w;
				if (waste < best.waste) {
					best.freebin = -1;
					best.waste = waste;
					best.shelf = i;
				}
			}
		}

		if (best.freebin !== -1) {
			return this.allocFreebin(best.freebin, w, h, id);
		}

		if (best.shelf !== -1) {
			return this.allocShelf(best.shelf, w, h, id);
		}

		// No free bins or shelves.. add shelf..
		if (h <= this.h - y && w <= this.w) {
			shelf = new Shelf(y, this.w, h);
			return this.allocShelf(this.shelves.push(shelf) - 1, w, h, id);
		}

		// No room for more shelves..
		// If `autoResize` option is set, grow the sprite as follows:
		//  * double whichever sprite dimension is smaller (`w1` or `h1`)
		//  * if sprite dimensions are equal, grow width before height
		//  * accomodate very large bin requests (big `w` or `h`)
		if (this.autoResize) {
			var h1, h2, w1, w2;

			h1 = h2 = this.h;
			w1 = w2 = this.w;

			if (w1 <= h1 || w > w1) {
				// grow width..
				w2 = Math.max(w, w1) * 2;
			}
			if (h1 < w1 || h > h1) {
				// grow height..
				h2 = Math.max(h, h1) * 2;
			}

			this.resize(w2, h2);
			return this.packOne(w, h, id); // retry
		}

		return null;
	}

	/**
	 * Called by packOne() to allocate a bin by reusing an existing freebin
	 *
	 * @private
	 * @ param    {number}         index  Index into the `this.freebins` array
	 * @ param    {number}         w      Width of the bin to allocate
	 * @ param    {number}         h      Height of the bin to allocate
	 * @ param    {number|string}  id     Unique identifier for this bin
	 * @ returns  {Bin}            Bin object with `id`, `x`, `y`, `w`, `h` properties
	 * @ example
	 * var bin = sprite.allocFreebin(0, 12, 16, 'a');
	 */
	allocFreebin(index, w, h, id) {
		var bin = this.freebins.splice(index, 1)[0];
		bin.id = id;
		bin.w = w;
		bin.h = h;
		bin.refcount = 0;
		this.bins[id] = bin;
		this.ref(bin);
		return bin;
	}

	/**
	 * Called by `packOne() to allocate bin on an existing shelf
	 *
	 * @private
	 * @ param    {number}         index  Index into the `this.shelves` array
	 * @ param    {number}         w      Width of the bin to allocate
	 * @ param    {number}         h      Height of the bin to allocate
	 * @ param    {number|string}  id     Unique identifier for this bin
	 * @ returns  {Bin}            Bin object with `id`, `x`, `y`, `w`, `h` properties
	 * @ example
	 * var results = sprite.allocShelf(0, 12, 16, 'a');
	 */
	allocShelf(index, w, h, id) {
		var shelf = this.shelves[index];
		var bin = shelf.alloc(w, h, id);
		this.bins[id] = bin;
		this.ref(bin);
		return bin;
	}

	/**
	 * Return a packed bin given its id, or undefined if the id is not found
	 *
	 * @ param    {number|string}  id  Unique identifier for this bin,
	 * @ returns  {Bin}            The requested bin, or undefined if not yet packed
	 * @ example
	 * var b = sprite.getBin('a');
	 */
	getBin(id) {
		return this.bins[id];
	}

	/**
	 * Increment the ref count of a bin and update statistics.
	 *
	 * @ param    {Bin}     bin  Bin instance
	 * @ returns  {number}  New refcount of the bin
	 * @ example
	 * var bin = sprite.getBin('a');
	 * sprite.ref(bin);
	 */
	ref(bin) {
		if (++bin.refcount === 1) {
			// a new Bin.. record height in stats historgram..
			var h = bin.h;
			this.stats[h] = (this.stats[h] | 0) + 1;
		}

		return bin.refcount;
	}

	/**
	 * Decrement the ref count of a bin and update statistics.
	 * The bin will be automatically marked as free space once the refcount reaches 0.
	 *
	 * @ param    {Bin}     bin  Bin instance
	 * @ returns  {number}  New refcount of the bin
	 * @ example
	 * var bin = sprite.getBin('a');
	 * sprite.unref(bin);
	 */
	unref(bin) {
		if (bin.refcount === 0) {
			return 0;
		}

		if (--bin.refcount === 0) {
			this.stats[bin.h]--;
			delete this.bins[bin.id];
			this.freebins.push(bin);
		}

		return bin.refcount;
	}

	/**
	 * Clear the sprite.  Resets everything and resets statistics.
	 *
	 * @ example
	 * sprite.clear();
	 */
	clear() {
		this.shelves = [];
		this.freebins = [];
		this.stats = {};
		this.bins = {};
		this.maxId = 0;
	}

	/**
	 * Resize the sprite.
	 *
	 * @ param   {number}  w  Requested new sprite width
	 * @ param   {number}  h  Requested new sprite height
	 * @ returns {boolean} `true` if resize succeeded, `false` if failed
	 * @ example
	 * sprite.resize(256, 256);
	 */
	resize = function (w, h) {
		this.w = w;
		this.h = h;
		for (var i = 0; i < this.shelves.length; i++) {
			this.shelves[i].resize(w);
		}
		return true;
	};
}

/**
 * Create a new Shelf.
 *
 * @ private
 * @ class  Shelf
 * @ param  {number}  y   Top coordinate of the new shelf
 * @ param  {number}  w   Width of the new shelf
 * @ param  {number}  h   Height of the new shelf
 * @ example
 * var shelf = new Shelf(64, 512, 24);
 */
class Shelf {
	constructor(y, w, h) {
		this.x = 0;
		this.y = y;
		this.w = this.free = w;
		this.h = h;
	}

	/**
	 * Allocate a single bin into the shelf.
	 *
	 * @private
	 * @ param   {number}         w   Width of the bin to allocate
	 * @ param   {number}         h   Height of the bin to allocate
	 * @ param   {number|string}  id  Unique id of the bin to allocate
	 * @ returns {Bin}            Bin object with `id`, `x`, `y`, `w`, `h` properties, or `null` if allocation failed
	 * @ example
	 * shelf.alloc(12, 16, 'a');
	 */
	alloc(w, h, id) {
		if (w > this.free || h > this.h) {
			return null;
		}
		var x = this.x;
		this.x += w;
		this.free -= w;
		return new Bin(id, x, this.y, w, h);
	}

	/**
	 * Resize the shelf.
	 *
	 * @private
	 * @ param   {number}  w  Requested new width of the shelf
	 * @ returns {boolean}    true
	 * @ example
	 * shelf.resize(512);
	 */
	resize(w) {
		this.free += w - this.w;
		this.w = w;
		return true;
	}
}

/**
 * Create a new Bin object.
 *
 * @ class  Bin
 * @ param  {number|string}  id  Unique id of the bin
 * @ param  {number}         x   Left coordinate of the bin
 * @ param  {number}         y   Top coordinate of the bin
 * @ param  {number}         w   Width of the bin
 * @ param  {number}         h   Height of the bin
 * @ example
 * var bin = new Bin('a', 0, 0, 12, 16);
 */
class Bin {
	constructor(id, x, y, w, h) {
		this.id = id;
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.maxw = w;
		this.maxh = h;
		this.refcount = 0;
	}
}

const percentageRegexp = /(\d+)%$/;

/**
 * @class AcetateSprite
 * @inherits AcetateExtrudedPoint
 * @relationship compositionOf ShelfPack, 1..1, 1..1
 *
 * An `Acetate` that draws square images anchored on points, at a constant screen
 * ratio. The images are "pinned" or "anchored" to a point `Geometry`.
 *
 * Since this acetate supports `Sprites` with different images, this acetate
 * implements a texture atlas. To build it, this leverages
 * [Bryan Housel's `shelf-pack` library](https://github.com/mapbox/shelf-pack).
 */

/// TODO: Angle relative to "up"?

class AcetateSprite extends AcetateExtrudedPoint {
	constructor(
		target,
		{
			/**
			 * @section AcetateSprite Options
			 * @option interpolate: true
			 * Whether to use bilinear pixel interpolation or not.
			 *
			 * Enabled by default to provide a alightly better display
			 * of sprites with yaw rotation applied. If (and only if) all
			 * sprites will have a yaw rotation of zero, it might be a good
			 * idea to set this to `false` to have pixel-accurate sprites.
			 */
			interpolate = true,
			/**
			 * @option maxTextureSize: Number = 2048
			 * Maximum size of the WebGL texture used to hold tiles. Should be
			 * at least the width/height of the screen. Texture size is ultimately
			 * bound by the WebGL capabilities of the browser/OS/GPU, which usually
			 * can support textures 8192 or 16384 pixels wide/high. Using higher
			 * values might cause the web browser (chromium/chrome in particular)
			 * to take a longer time during texture initialization.
			 */
			maxTextureSize = 2048,
			...opts
		} = {}
	) {
		super(target, { zIndex: 4000, ...opts });

		// Two attributes: vertex extrusion amount and texture UV
		// coordinates (relative to the image atlas for the acetate).
		// Vertex extrusion amount is handled by parent class.
		this._attrs = new this.glii.SingleAttribute({
			usage: this.glii.STATIC_DRAW,
			size: 1,
			growFactor: 1.2,

			// Texture UV coords (relative to acetate image atlas)
			glslType: "vec2",
			type: Float32Array,
			normalized: false,
		});

		// Data structures for the texture atlas
		const texSize = (this._texSize = Math.min(
			this.glii.Texture.getMaxSize(),
			maxTextureSize
		));
		this._packer = new ShelfPack(texSize, texSize);

		const texFilter = !!interpolate
			? this.glii.LINEAR
			: this.glii.NEAREST_MIPMAP_LINEAR;
		this._atlas = new this.glii.Texture({
			minFilter: texFilter,
			magFilter: texFilter,
		});
		this._atlas.texArray(texSize, texSize, new Uint8Array(4 * texSize * texSize));

		// Map of HTMLImageElement/blob to atlas coordinate box
		this._images = new Map();
	}

	glProgramDefinition() {
		const opts = super.glProgramDefinition();
		return {
			...opts,
			attributes: {
				...opts.attributes,
				aUV: this._attrs,
			},
			uniforms: {
				uPixelSize: "vec2",
				...opts.uniforms,
			},
			textures: {
				uAtlas: this._atlas,
				...opts.textures,
			},
			vertexShaderMain: `
				vUV = aUV;
				gl_Position = vec4(
					vec3(aCoords, 1.0) * uTransformMatrix +
					vec3(aExtrude * uPixelSize, 0.0)
					, 1.0);
			`,
			varyings: { vUV: "vec2" },
			fragmentShaderMain: `
				gl_FragColor = texture2D(uAtlas,vUV);
			`,
			// 				if (gl_FragColor.a < 1.0) {
			// 					gl_FragColor = vec4(0.,0.,0.,1.);
			// 				}
		};
	}

	glIdProgramDefinition() {
		const opts = super.glIdProgramDefinition();
		return {
			...opts,
			fragmentShaderMain: `if (texture2D(uAtlas, vUV).a > 0.0) {
				${opts.fragmentShaderMain}
			} else {
				discard;
			}`,
		};
	}

	/**
	 * @section Internal Methods
	 * @uninheritable
	 * @method pack(image: HTMLImageElement): Bin
	 * Given an image, returns a ShelfPack `Bin`, containing
	 * the box coordinates for that image inside the acetate's texture atlas.
	 *
	 * Will upload the image to the texture atlas if it's not in the atlas already;
	 * returns a cached result if the image has already been packed in the atlas.
	 * Anyway, it will increase the usage counter for the used portion of the atlas.
	 * @alternative
	 * @method pack(image: ImageData): Bin
	 * Idem, but takes a `ImageData` instance (from e.g. `TextLabel` symbol)
	 */
	pack(image) {
		const known = this._images.get(image);
		if (known) {
			this._packer.ref(known);
			return known;
		}

		let w, h;
		if (image instanceof ImageData) {
			h = image.height;
			w = image.width;
		} else if (image instanceof HTMLImageElement) {
			h = image.naturalHeight;
			w = image.naturalWidth;
		} else {
			throw new Error(
				"Cannot pack symbol's image: must be either HTMLImageElement or ImageData"
			);
		}
		const bin = this._packer.packOne(w, h);

		if (bin === null) {
			throw new Error("Could not allocate sprite image in atlas");
		}

		this._images.set(image, bin);

		this._atlas.texSubImage2D(image, bin.x, bin.y);

		return bin;
	}

	/**
	 * @section
	 * @method multiAdd(sprites: Array of Sprite): this
	 * Adds the sprites to this acetate (so they're drawn on the next refresh),
	 * using as few WebGL calls as feasible.
	 *
	 * Note this call can be asynchronous - if any of the sprites' images has not loaded
	 * yet, that will delay this whole call until all of the images have loaded.
	 *
	 * TODO: Alternatively, split the sprites: ones with loaded images and one set
	 * per unique image. Load each set as soon as ready.
	 *
	 */
	multiAdd(sprites) {
		// Skip already added symbols
		sprites = sprites.filter((s) => !s._inAcetate);
		if (sprites.length === 0) {
			return;
		}

		sprites.forEach((s) => s.updateRefs(this, undefined, undefined));

		Promise.all(sprites.map((s) => s.image))
			.then((resolved) => resolved.map(imagifyFetchResponse))
			.then((loadedImages) => this._syncMultiAdd(sprites, loadedImages))
			.catch((err) => {
				/**
				 * @event spriteerror: Event
				 * Fired when some of the sprites to be added to this acetate have failed
				 * to load their image.
				 */
				this.fire("spriteerror", err);

				throw err;
			});

		return this;
	}

	// Must return a plain array with all the StridedTypedArrays that a symbol
	// might need, as well as any other (pseudo-)constants that the symbol's
	// `_setGlobalStrides()` method might need.
	// Can be overwritten by subclasses.
	_getStridedArrays(maxVtx, maxIdx) {
		return [
			// UV
			this._attrs.asStridedArray(maxVtx),
			// Extrusion
			this._extrusions.asStridedArray(maxVtx),
			// Index buffer
			this._indices.asTypedArray(maxIdx),
			// Texture size (width and height), in texels
			this._texSize,
		];
	}

	_syncMultiAdd(sprites, loadedImages) {
		// Calculate which symbols did not get removed before their image promise resolved
		const actualSprites = sprites.filter((s) => s._inAcetate === this);
		if (actualSprites.length === 0) {
			return;
		}

		const idxLength = actualSprites.reduce((acc, ext) => acc + ext.idxLength, 0);
		const attrLength = actualSprites.reduce((acc, ext) => acc + ext.attrLength, 0);

		let baseVtx = this._attribAllocator.allocateBlock(attrLength);
		let baseIdx = this._indices.allocateSlots(idxLength);
		let vtxAcc = baseVtx;
		let idxAcc = baseIdx;
		let maxVtx = baseVtx + attrLength;
		let stridedArrays = this._getStridedArrays(maxVtx, baseIdx + idxLength);

		sprites.forEach((s, i) => {
			// Skip those symbols that got removed before their image promise resolved
			// (skipping the loaded image as well; using the `actualSprites` array
			// would use references to stale images corresponding to unloaded sprites)
			if (s._inAcetate !== this) {
				return;
			}

			s.updateRefs(this, vtxAcc, idxAcc);
			this._knownSymbols[vtxAcc] = s;
			vtxAcc += s.attrLength;
			idxAcc += s.idxLength;

			// s.bin = this.pack(s.image);
			const img = loadedImages[i];
			s.bin = this.pack(img);

			s._normalizeAnchor();

			s._setGlobalStrides(...stridedArrays);
		});

		this._commitStridedArrays(baseVtx, attrLength);
		this._indices.commit(baseIdx, idxLength);

		if (this._crs) {
			this.reproject(baseVtx, attrLength, actualSprites);
		}

		// The AcetateInteractive will assign IDs to symbol vertices.
		super.multiAddIds(actualSprites, baseVtx);

		// AcetateExtrudedPoint also implements allocation logic, so its
		// implementation has to be skipped - go directly to base Acetate so
		// it fires the "symbolsadded" event.
		Acetate.prototype.multiAdd.call(this, actualSprites);

		this.dirty = true;
	}

	// The map will call resize() on acetates when needed - besides redoing the
	// framebuffer with the new size, this needs to reset the uniform uPixelSize.
	resize(w, h) {
		super.resize(w, h);
		const dpr2 = (devicePixelRatio ?? 1) * 2;
		this._programs.setUniform("uPixelSize", [dpr2 / w, dpr2 / h]);
	}

	/**
	 * @method remove(sprite: Sprite): this
	 * Removes the sprite from this acetate (so it's *not* drawn on the next refresh).
	 *
	 * Also decreases the usage count of the relevant portion of the atlas.
	 */
	remove(sprite) {
		if (sprite.attrBase === undefined) {
			// It's possible that the sprite's image is not ready yet
			/// TODO: Abort the image request. This means also replacing
			/// the `imagePromise` with an `abortableImagePromise`, but what
			/// about the image cache?
			return this;
		}

		const refcount = this._packer.unref(sprite.bin);

		if (refcount === 0) {
			sprite.image.then((img) => this._images.delete(img));
		}

		super.remove(sprite);

		return this;
	}

	/**
	 * @method debugAtlasIntoCanvas(canvas: HTMLCanvasElement): this
	 *
	 * Dumps the contents of the sprite atlas into the given `<canvas>`.
	 *
	 * This is an expensive operation and is meant only for debugging purposes.
	 */
	debugAtlasIntoCanvas(canvas) {
		const [maxh, maxw] = Object.values(this._packer.bins).reduce(
			([h, w], bin) => [Math.max(h, bin.y + bin.h), Math.max(w, bin.x + bin.w)],
			[0, 0]
		);

		// console.log(maxh, maxw, this._packer);

		if (maxh === 0 && maxw === 0) {
			return;
		}

		const data = this._atlas.asImageData(0, 0, maxw, maxh);
		canvas.width = maxw;
		canvas.height = maxh;
		canvas.getContext("2d").putImageData(data, 0, 0);

		return this;
	}

	/**
	 * @method debugAtlasIntoConsole(): this
	 *
	 * Dumps the contents of the sprite atlas into the developer tools' console,
	 * with some `<canvas>` and `console.log("%c")` trickery.
	 *
	 * This is an expensive operation and is meant only for debugging purposes.
	 */
	debugAtlasIntoConsole() {
		let canvas = document.createElement("canvas");
		this.debugAtlasIntoCanvas(canvas);

		// canvas.toBlob((blob)=>{
		// let url = URL.createObjectURL(blob);
		let url = canvas.toDataURL();

		console.log(
			"%c+",
			`
		font-size: 1px;
		padding: ${Math.floor(canvas.height / 2)}px ${Math.floor(canvas.width / 2)}px;
		line-height: ${canvas.height}px;
		background: url(${url});
		background-size: ${canvas.width}px ${canvas.height}px;
		color: transparent;
		`
		);

		return this;
	}
}

/**
 * @class Sprite
 * @inherits ExtrudedPoint
 * @relationship drawnOn AcetateSprite
 * @relationship compositionOf Bin, 1..1, 0..1
 *
 * A rectangular image, displayed at a constant screen ratio.
 *
 * Synonym of "marker"s and "icon"s.
 *
 * Works with point geometries only.
 *
 * @example
 * ```js
 * new Sprite([0, 0], {
 * 	image: "img/marker.png",
 * 	spriteAnchor: [13, 41]
 * }).addTo(map);
 * ```
 */

class Sprite extends ExtrudedPoint {
	/// @section Static properties
	/// @property Acetate: Prototype of AcetateSprite
	// The `Acetate` class that draws this symbol.
	static Acetate = AcetateSprite;

	#spriteStart;
	#spriteScale;
	#yaw;
	#image;

	/**
	 * @constructor Sprite(geom: Geometry, opts?: Sprite Options)
	 * @alternative
	 * @constructor Sprite(geom: Array of Number, opts?: Sprite Options)
	 */
	constructor(
		geom,
		{
			/**
			 * @section
			 * @aka Sprite Options
			 * @option image: HTMLImageElement
			 * The image for the sprite. When given an instance of `HTMLImageElement`, the
			 * image should be completely loaded.
			 * @alternative
			 * @option image: Promise to HTMLImageElement
			 * It might be convenient to instantiate a `Sprite` without knowning if its image
			 * has been loaded. Display of the sprite will be delayed until this `Promise`
			 * resolves.
			 * @alternative
			 * @option image: String
			 * For convenience, a `String` containing a URL can be passed.
			 * @alternative
			 * @option image: URL
			 * For convenience, a `URL` instance can be passed.
			 * @alternative
			 * @option image: Promise to Response
			 * For convenience, the result of a `fetch` call can be passed.
			 */
			image,

			/**
			 * @option spriteAnchor: Array of Number
			 * The coordinates of the pixel which shall display directly on the
			 * sprite's geometry (think "the tip of the pin").
			 *
			 * These coordinates are to be given in `[x, y]` form, in image pixels
			 * relative to the top-left corner of the sprite image.
			 *
			 * Negative values are interpreted as relative to the bottom-right
			 * corner of the image, instead. For this purpose, `+0` and `-0`
			 * are handled as different numbers.
			 * @alternative
			 * @option spriteAnchor: Array of String = ["50%","50%"]
			 * The sprite anchor can be given as two numeric strings ending
			 * with a percent sign (e.g. `["50%", "100%"]`). Anchor percentages
			 * are relative to the size of the image.
			 */
			spriteAnchor = ["50%", "50%"],

			/**
			 * @option spriteStart: Array of Number = [0, 0]
			 * When the image for a `Sprite` is a spritesheet, this is the top-left
			 * offset of the sprite within the spritesheet.
			 *
			 * This is to be given in `[x, y]` form, in image pixels. Defaults to `[0, 0]`,
			 * the top-left corner of the image.
			 */
			spriteStart = [0, 0],

			/**
			 * @option spriteSize: Array of Number = *
			 * The size of the sprite, in `[x, y]` form, in image pixels. Defaults to the
			 * size of the image.
			 *
			 * When the image for a `Sprite` is a spritesheet, this should be set to the
			 * size of the sprite (always smaller than the image itself).
			 */
			spriteSize,

			/**
			 * @option spriteScale: Number = 1
			 * Scale factor between image pixels and CSS pixels. Use `0.5`
			 * (or rather, `1/window.devicePixelRatio`) for "hi-DPI" icons,
			 * or `2` to double the size of the sprite.
			 */
			spriteScale = 1,

			/**
			 * @option yaw: Number = 0
			 * Yaw rotation of the sprite, relative to the "up" direction of the
			 * map's `<canvas>` (**not** relative to the direction of the CRS's `y`
			 * coordinate or "northing"), in clockwise degrees.
			 */
			yaw = 0,
			...opts
		} = {}
	) {
		super(geom, opts);

		/// TODO: Accept HTMLCanvasElement as image
		/// TODO: Accept ImageBitmap as image
		/// See https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D.html#pixels

		this.#image =
			image instanceof Promise
				? image.then(imagifyFetchResponse)
				: imagePromise(image);

		this._anchor = spriteAnchor;
		this.#spriteStart = spriteStart;
		this._spriteSize = spriteSize;
		this.#spriteScale = spriteScale;
		this.#yaw = yaw;

		// Sprites are *always* two triangles (6 primitive slots) from 4 vertices
		this.attrLength = 4;
		this.idxLength = 6;

		/**
		 * @section Acetate interface
		 * @uninheritable
		 * @property bin: Bin
		 * An array of the form `[x1,y1, x2,y2]`, containing the coordinates
		 * of this sprite's image within the acetate's atlas texture.
		 * @property image: HTMLImageElement
		 * The actual image for this sprite. The acetate will copy it into
		 * a texture atlas.
		 */
		this.bin = undefined;
	}

	/**
	 * @section
	 * @property yaw: Number
	 * Runtime value of the `yaw` option: the yaw rotation of the sprite,
	 * in clockwise degrees. Can be updated.
	 */
	set yaw(yaw) {
		this.#yaw = yaw;
		this._refreshExtrusion();
	}
	get yaw() {
		return this.#yaw;
	}

	/**
	 * @property spriteScale: Number
	 * Runtime value of the `spriteScale` option: image pixel to CSS pixel
	 * ratio. Can be updated.
	 */
	set spriteScale(s) {
		this.#spriteScale = s;
		this._refreshExtrusion();
	}
	get spriteScale() {
		return this.#spriteScale;
	}

	/**
	 * @property image: Promise to HTMLImageElement
	 * A `Promise` to the (possibly not loaded yet) image for this sprite.
	 *
	 * Read-only. Use the `replaceImage` method to change the sprite's image
	 * and associated parameters.
	 */
	get image() {
		return this.#image;
	}

	/**
	 * @method replaceImage(opts: Sprite Options, retain: Boolean = false): Promise of this
	 *
	 * Replaces the sprite's image and associated parameters (sprite size,
	 * anchor, origin, scale). The first parameter is an object containing
	 * constructor options (such as `image`, `spriteAnchor`, etc).
	 *
	 * By default, the old image gets expelled from the acetate's texture atlas.
	 * In order to prevent that, set `retain` to true. This is useful in
	 * scenarios where replacing the images of several `Sprite`s in the same
	 * render frame causes artifacts such as the wrong image being displayed. Avoid
	 * retaining large images.
	 *
	 * Returns a `Promise` that resolves when the image has been loaded.
	 */
	async replaceImage(
		{ image, spriteAnchor, spriteStart, spriteSize, spriteScale, yaw } = {},
		retain = false
	) {
		let oldImage = this.#image;
		let i = (this.#image =
			image instanceof Promise
				? image.then(imagifyFetchResponse)
				: imagePromise(image));

		this._anchor = spriteAnchor ?? this._anchor;
		this.#spriteStart = spriteStart ?? this.#spriteStart;
		this._spriteSize = spriteSize;
		this.#spriteScale = spriteScale ?? this.#spriteScale;
		this.#yaw = yaw ?? this.#yaw;

		const ac = this._inAcetate;
		if (!ac) {
			// If the sprite is not in an acetate, skip replacement.
			return this;
		}

		let [loadedImg, loadedOldImg, [allocAttr, allocIdx]] = await Promise.all([
			this.#image,
			oldImage,
			this.allocation,
		]);

		// console.log(loadedImg, loadedOldImg, _allocation);

		if (i !== this.#image) {
			// Image has already been replaced before it could load
			return;
		}
		if (allocAttr !== this.attrBase || allocIdx !== this.idxBase) {
			throw new Error("Sprite reallocated during image load");
		}

		// ac.debugAtlasIntoConsole();

		if (!retain) {
			// Manually unpack the old image from the acetate's atlas. It's important
			// to **not** call the parent functionality (i.e. do not call the
			// remove interactive symbol code)
			const refcount = ac._packer.unref(this.bin);
			if (refcount === 0) {
				ac._images.delete(loadedOldImg);
			}
		}
		this.bin = ac.pack(loadedImg);
		this._normalizeAnchor();

		let strides = ac._getStridedArrays(
			this.attrBase + this.attrLength,
			this.idxBase + this.idxLength
		);
		this._setGlobalStrides(...strides);
		ac._commitStridedArrays(this.attrBase, this.attrLength);
		ac.dirty = true;

		// ac.debugAtlasIntoConsole();

		return this;
	}

	/**
	 * @section Acetate interface
	 * @uninheritable
	 * @method _setGlobalStrides(strideUV: StridedTypedArray, strideExtrude: StridedTypedArray, texSize: Number): this
	 * Sets the appropriate values in the `StridedTypedArray`s.
	 */
	_setGlobalStrides(strideUV, strideExtrude, typedIdxs, texSize) {
		// Texture bounds, normalized 0..1 texture position
		// ss = SpriteStart
		const ssx = this.bin.x + this.#spriteStart[0];
		const ssy = this.bin.y + this.#spriteStart[1];

		// se = SpriteEnd
		const sex = ssx + this._spriteSize[0];
		const sey = ssy + this._spriteSize[1];

		// Texture coords are normalized into 0..1, relative to the size
		// of the texture atlas.
		const tx1 = ssx / texSize;
		const ty1 = ssy / texSize;
		const tx2 = sex / texSize;
		const ty2 = sey / texSize;

		// `strideUV` comes from a `SingleAttribute`, so values for the four
		// vertices could be concatenated together.
		// prettier-ignore
		strideUV.set([tx1, ty1], this.attrBase);
		strideUV.set([tx1, ty2], this.attrBase + 1);
		strideUV.set([tx2, ty2], this.attrBase + 2);
		strideUV.set([tx2, ty1], this.attrBase + 3);

		// prettier-ignore
		typedIdxs.set([
			this.attrBase, this.attrBase + 1, this.attrBase + 2,
			this.attrBase, this.attrBase + 2, this.attrBase + 3,
		], this.idxBase);

		return this._setStridedExtrusion(strideExtrude);
	}

	_setStridedExtrusion(strideExtrude) {
		const s = this.#spriteScale;
		const x1 = s * -this._anchor[0];
		const y1 = s * this._anchor[1];
		const x2 = x1 + s * this._spriteSize[0];
		const y2 = y1 - s * this._spriteSize[1];
		const [offsetX, offsetY] = this.offset;
		let offsets;

		if (this._yaw === 0) {
			// prettier-ignore
			offsets = [
				offsetX + x1, offsetY + y1,
				offsetX + x1, offsetY + y2,
				offsetX + x2, offsetY + y2,
				offsetX + x2, offsetY + y1,
			];
		} else {
			const yawRadians = (-this.#yaw * Math.PI) / 180;
			const s = Math.sin(yawRadians);
			const c = Math.cos(yawRadians);

			// prettier-ignore
			offsets = [
				offsetX + x1*c-y1*s, offsetY + x1*s+y1*c,
				offsetX + x1*c-y2*s, offsetY + x1*s+y2*c,
				offsetX + x2*c-y2*s, offsetY + x2*s+y2*c,
				offsetX + x2*c-y1*s, offsetY + x2*s+y1*c,
			];
		}
		strideExtrude.set(offsets, this.attrBase);

		return this;
	}

	// Ensures the anchor values are image pixels, in particular when given
	// as percentage strings.
	// Also handles default values for the sprite size.
	_normalizeAnchor() {
		if (!this._spriteSize) {
			this._spriteSize = [this.bin.w, this.bin.h];
		}

		// Sprite anchor expressed as percentage
		if (typeof this._anchor[0] === "string") {
			const anchorXRegexp = this._anchor[0].match(percentageRegexp);
			if (anchorXRegexp) {
				this._anchor[0] = (this.bin.w * anchorXRegexp[1]) / 100;
			} else {
				this._anchor[0] = Number(this._anchor[0]);
			}
		}
		if (typeof this._anchor[1] === "string") {
			const anchorYRegexp = this._anchor[1].match(percentageRegexp);
			if (anchorYRegexp) {
				this._anchor[1] = (this.bin.h * anchorYRegexp[1]) / 100;
			} else {
				this._anchor[1] = Number(this._anchor[1]);
			}
		}

		// Sprite anchor expressed as negative - use bottom-left instead of
		// top-right
		// Note use of `Object.is()` instead of `===` - needed to tell apart
		// `+0` and `-0`.
		if (this._anchor[0] < 0 || Object.is(this._anchor[0], -0)) {
			this._anchor[0] = this.bin.w + this._anchor[0];
		}
		if (this._anchor[1] < 0 || Object.is(this._anchor[1], -0)) {
			this._anchor[1] = this.bin.h + this._anchor[1];
		}
	}

	_refreshExtrusion() {
		if (!this._inAcetate || this.attrBase === undefined) {
			return this;
		}

		let strideExtrude = this._inAcetate._extrusions.asStridedArray();
		this._setStridedExtrusion(strideExtrude);

		this._inAcetate._extrusions.commit(this.attrBase, this.attrLength);
		this._inAcetate.dirty = true;
		return this;
	}
}

let textWorker;
let workId = 0;
let textDrawer, textDrawerCanvas;
let canUseExternalWorker;
try {
	// Use the external-file web worker for text rendering only if:
	// - OffscreenCanvas is a thing, and...
	const a = globalThis?.OffscreenCanvas;
	// - ...the name of this module is TextLabel.mjs (which won't happen if it's
	// been bundled)
	const b = import.meta?.url?.match(/TextLabel\.mjs/);
	canUseExternalWorker = !!a && !!b;
} catch (ex) {
	canUseExternalWorker = false;
}

if (canUseExternalWorker) {
	const ownURL = import.meta.url;
	try {
		textWorker = new Worker(ownURL.replace(/TextLabel.mjs$/, "text/textWorker.js"));
	} catch (ex) {
		canUseExternalWorker = false;
	}
}

if (!canUseExternalWorker) {
	if (globalThis?.OffscreenCanvas) {
		try {
			// If external workers are not available but offscreen canvases are,
			// then spawn a blob worker. The code for the blob is copy-pasted
			// from the external worker code.
			const blob = new Blob(
				[
					`
const textDrawerCanvas = new OffscreenCanvas(16, 16);
const textDrawer = textDrawerCanvas.getContext("2d", { willReadFrequently: true });

let devicePixelRatio = 1;

onmessage = function onmessage({
	data: {
		command, // either "render" or "loadFontFace"
		workId,

		str,
		font,
		colour,
		align,
		baseline,
		outlineWidth,
		outlineColour,
		// cache = false,

		family,
		source,
		descriptors,

		...data
	},
	...msg
}) {
	//console.log('Worker: Message received from main script', workId, str);

	if (command === "render") {
		font = font.replace(/\d+/, (n) => n * devicePixelRatio);

		textDrawer.font = font;
		textDrawer.textAlign = align;
		textDrawer.textBaseline = baseline;

		let metrics = textDrawer.measureText(str);

		const left = metrics.actualBoundingBoxLeft + outlineWidth + 1;
		const right = metrics.actualBoundingBoxRight + outlineWidth + 1;
		const up = metrics.actualBoundingBoxAscent + outlineWidth + 1;
		const down = metrics.actualBoundingBoxDescent + outlineWidth + 1;

		const width = Math.ceil(left + right) + 1;
		const height = Math.ceil((textDrawerCanvas.height = up + down)) + 1;

		if (textDrawerCanvas.width < width || textDrawerCanvas.height < height) {
			textDrawerCanvas.width = Math.max(width, textDrawerCanvas.width);
			textDrawerCanvas.height = Math.max(height, textDrawerCanvas.height);
			textDrawer.font = font;
			textDrawer.textAlign = align;
			textDrawer.textBaseline = baseline;
		} else {
			textDrawer.clearRect(0, 0, width, height);
		}

		if (outlineWidth > 0) {
			textDrawer.lineWidth = devicePixelRatio * outlineWidth * 2;
			textDrawer.strokeStyle = outlineColour;
			textDrawer.strokeText(str, left, up);
		}

		textDrawer.fillStyle = colour;
		textDrawer.fillText(str, left, up);

		const imageData = textDrawer.getImageData(0, 0, width, height);

		const returnMsg = {
			workId,
			imageData,
			left: left,
			up: up,
			width: width,
			height: height,
			scale: 1 / devicePixelRatio,
		};

		return postMessage(returnMsg);
	} else if (command === "loadFontFace") {
		const font = new FontFace(family, source, descriptors);
		self.fonts.add(font);
		font.load()
			.catch((ex) =>
				postMessage({
					workId,
					error: ex,
				})
			)
			.then(() => {
				console.log(self.fonts);

				postMessage({
					workId,
				});
			});
	} else if (command === "setDevicePixelRatio") {
		devicePixelRatio = data.devicePixelRatio;
	}
};
		`,
				],
				{ type: "text/javascript" }
			);

			textWorker = new Worker(window.URL.createObjectURL(blob));
		} catch (ex) {}
	}

	try {
		if (!textWorker || !textWorker?.onmessage) {
			textDrawerCanvas = document.createElement("canvas");
			textDrawerCanvas.width = 1;
			textDrawerCanvas.height = 1;
			textDrawer = textDrawerCanvas.getContext("2d", { willReadFrequently: true });

			// document.body.appendChild(textDrawerCanvas);
			// textDrawerCanvas.style.border = "2px solid blue";
		}
	} catch (ex) {
		console.warn("Cannot use TextLabel on headless environments");
	}
}

if (textWorker && textWorker?.postMessage) {
	textWorker?.postMessage({
		command: "setDevicePixelRatio",
		// devicePixelRatio: .1,
		devicePixelRatio: window.devicePixelRatio,
	});

	window.addEventListener("resize", () => {
		textWorker.postMessage({
			command: "setDevicePixelRatio",
			devicePixelRatio: window.devicePixelRatio,
		});
	});
}

const imageCache = new Map();

/**
 * @class TextLabel
 * @inherits Sprite
 * @relationship drawnOn AcetateSprite
 * @relationship compositionOf Bin, 1..1, 0..1
 *
 * A text label anchored to a point geometry.
 *
 * Internally treated like a `Sprite`, by rasterizing the text via 2D Canvas.
 *
 * @example
 * ```js
 * new TextLabel([0, 0], {
 * 	str: "Hello world!",
 * }).addTo(map);
 * ```
 */

class TextLabel extends Sprite {
	/**
	 * @constructor TextLabel(geom: Geometry, opts?: TextLabel Options)
	 */
	constructor(
		geom,
		{
			str,
			font = "16px Sans",
			colour,
			color,
			align = "start",
			baseline = "alphabetic",
			outlineWidth = 0,
			outlineColour = "white",
			cache = false,
			...opts
		} = {}
	) {
		/**
		 * @section
		 * @aka TextLabel options
		 * @option str: String
		 * The text itself
		 * @option font: String = "16px Sans"
		 * A definition of a [CSS font](https://developer.mozilla.org/docs/Web/CSS/font)
		 * @option colour: String = "black"
		 * The CSS colour for the text fill (**not** a gleo `Colour`!).
		 * @option align: String = "start"
		 * Text alignment, as per [2D canvas' `textAlign`](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/textAlign).
		 * @option baseline: String = "alphabetic"
		 * Text baseline, as per [2D canvas' `textBaseline`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline).
		 * @option outlineWidth: Number = 0
		 * Size, in CSS pixels, of the text outline
		 * @option outlineColour: String = "white"
		 * The CSS colour for the text outline (**not** a gleo `Colour`!)
		 * @option cache: Boolean = false
		 * Whether to cache the rendered text for later use. Should be
		 * set to `true` if the text label is expected to be removed/re-added,
		 * or if several `TextLabel`s with the exact same data exist.
		 */

		let key;
		if (cache) {
			key = JSON.stringify({
				str,
				font,
				colour,
				align,
				baseline,
				outlineWidth,
				outlineColour,
			});
			const cached = imageCache.get(key);
			if (cached) {
				return super(geom, {
					image: cached.imageData,
					spriteAnchor: [cached.left, cached.up],
					spriteSize: [cached.width, cached.height],
					spriteScale: cached.scale,
					...opts,
				});
			}
		}

		if (textWorker) {
			const myWorkId = workId++;

			textWorker.postMessage({
				command: "render",
				workId: myWorkId,
				str,
				font,
				colour: colour ?? color ?? "black",
				align,
				baseline,
				outlineWidth,
				outlineColour,
				cache,
				...opts,
			});

			const imageReady = new Promise((res, rej) => {
				function waitMessage(msg) {
					if (msg.data.workId === myWorkId) {
						//console.log("Done", myWorkId, msg);
						textWorker.removeEventListener("message", waitMessage);
						res(msg.data);
					}
				}
				textWorker.addEventListener("message", waitMessage);
			});

			super(geom, {
				image: imageReady.then((i) => {
					if (cache) {
						imageCache.set(key, i);
					}
					this._anchor = [i.left, i.up];
					this._spriteSize = [i.width, i.height];
					this.spriteScale = i.scale;

					return i.imageData;
				}),
				spriteAnchor: [0, 0],
				spriteSize: [16, 16],
				...opts,
			});
		} else {
			font = font.replace(/\d+/, (n) => n * (devicePixelRatio ?? 1));

			textDrawer.font = font;
			textDrawer.textAlign = align;
			textDrawer.textBaseline = baseline;

			let metrics = textDrawer.measureText(str);

			const left = metrics.actualBoundingBoxLeft + outlineWidth + 1;
			const right = metrics.actualBoundingBoxRight + outlineWidth + 1;
			const up = metrics.actualBoundingBoxAscent + outlineWidth + 1;
			const down = metrics.actualBoundingBoxDescent + outlineWidth + 1;

			const width = Math.ceil(left + right) + 1;
			const height = Math.ceil((textDrawerCanvas.height = up + down)) + 1;

			if (textDrawerCanvas.width < width || textDrawerCanvas.height < height) {
				textDrawerCanvas.width = Math.max(width, textDrawerCanvas.width);
				textDrawerCanvas.height = Math.max(height, textDrawerCanvas.height);
				textDrawer.font = font;
				textDrawer.textAlign = align;
				textDrawer.textBaseline = baseline;
			} else {
				textDrawer.clearRect(0, 0, width, height);
			}

			if (outlineWidth > 0) {
				textDrawer.lineWidth = (devicePixelRatio ?? 1) * outlineWidth * 2;
				textDrawer.strokeStyle = outlineColour;
				textDrawer.strokeText(str, left, up);
			}

			textDrawer.fillStyle = colour ?? color ?? "black";
			textDrawer.fillText(str, left, up);

			const imageData = textDrawer.getImageData(0, 0, width, height);
			if (cache) {
				imageCache.set(key, {
					imageData,
					left,
					up,
					width,
					height,
					scale: 1 / (devicePixelRatio ?? 1),
				});
			}

			super(geom, {
				image: imageData,
				spriteAnchor: [left, up],
				spriteSize: [width, height],
				spriteScale: 1 / (devicePixelRatio ?? 1),
				...opts,
			});
		}
	}

	/**
	 * @function addFontFace(family: String, source: String, descriptors?: Object): Promise
	 *
	 * Registers a new font face (AKA typeface) for use with `TextLabel`.
	 *
	 * Note that for technical reasons (i.e. "text is rendered inside a web worker"),
	 * typefaces defined in the document's CSS via `@font-face` are not available
	 * to Gleo.
	 *
	 * The parameters to this static function are the same as the
	 * [`FontFace` constructor](https://developer.mozilla.org/en-US/docs/Web/API/FontFace/FontFace).
	 *
	 * Beware: any relative URLs used in the `source` will be interpreted as
	 * being relative to *the URL of the web worker code module*. Usage of
	 * absolute URLs is therefore highly encouraged.
	 *
	 * Returns a `Promise` that resolves when the font face has been loaded.
	 */
	static addFontFace(family, source, descriptors) {
		if (textWorker) {
			const myWorkId = workId++;

			const fontReady = new Promise((res, rej) => {
				function waitMessage(msg) {
					if (msg.data.workId === myWorkId) {
						//console.log("Done", myWorkId, msg);
						textWorker.removeEventListener("message", waitMessage);
						if (msg.data.error) {
							rej(msg.data.error);
						} else {
							res();
						}
					}
				}
				textWorker.addEventListener("message", waitMessage);
			});

			textWorker.postMessage({
				command: "loadFontFace",
				workId: myWorkId,
				family,
				source,
				descriptors,
			});

			return fontReady;
		} else {
			const font = new FontFace(family, source, descriptors);
			document.fonts.add(font);
			return font.load();
		}
	}
}

export { Chain, Circle, MercatorMap, MercatorTiles, TextLabel };
