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
	
	"STATIC_DRAW",
	"DYNAMIC_DRAW",
	"STREAM_DRAW",

	
	"BYTE",
	"UNSIGNED_BYTE",
	"SHORT",
	"UNSIGNED_SHORT",
	"INT",
	"UNSIGNED_INT",
	"FLOAT",

	

	//"UNSIGNED_BYTE",
	"UNSIGNED_SHORT_5_6_5",
	"UNSIGNED_SHORT_4_4_4_4",
	"UNSIGNED_SHORT_5_5_5_1",
	//"UNSIGNED_SHORT",
	//"UNSIGNED_INT",
	//"FLOAT",

	
	"POINTS",
	"LINES",
	"LINE_LOOP",
	"LINE_STRIP",
	"TRIANGLES",
	"TRIANGLE_STRIP",
	"TRIANGLE_FAN",

	
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

	
	"NEAREST",
	"LINEAR",
	"NEAREST_MIPMAP_NEAREST",
	"LINEAR_MIPMAP_NEAREST",
	"NEAREST_MIPMAP_LINEAR",
	"LINEAR_MIPMAP_LINEAR",

	
	"REPEAT",
	"CLAMP_TO_EDGE",
	"MIRRORED_REPEAT",

	
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

	
	"NEVER",
	"ALWAYS",
	"LESS",
	"LEQUAL",
	"GREATER",
	"GEQUAL",
	"EQUAL",
	"NOTEQUAL",

	
	"FUNC_ADD",
	"FUNC_SUBTRACT",
	"FUNC_REVERSE_SUBTRACT",
	"MIN",
	"MAX",

	
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

class GliiFactory extends EventTarget {
	
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

	
	getSupportedExtensions() {
		if (this._knownExtensions) {
			return this._knownExtensions;
		}
		return (this._knownExtensions = this.gl.getSupportedExtensions());
	}

	
	isExtensionSupported(extName) {
		return this.getSupportedExtensions().includes(extName);
	}

	
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
	
	return class StridedTypeArray extends arrayType {
		#stride;
		#offset;

		constructor(buffer, stride, offset) {
			super(buffer);

			this.#stride = stride;
			this.#offset = offset;
		}

		
		set(values, index) {
			super.set(values, index * this.#stride + this.#offset);
		}
	};
}

const stridedArrays = new Map(Array.from(typeMap.keys()).map((t) => [t, stridify(t)]));

/// TODO: Somehow implement integer GLSL types for WebGL2.

class SingleAttribute extends AbstractAttributeSet {
	constructor(gl, options) {
		
		const type = options.type || Float32Array;
		const bytesPerElement = type.BYTES_PER_ELEMENT;

		
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

		
		if (options.glslType === "float") {
			this.set = this.setNumber;
		} else {
			this.set = this.setArray;
		}

		this._recordBuf = new type(componentCount);
		this._arrayType = type;
	}

	
	setNumber(index, value) {
		this._recordBuf[0] = value;
		super.setBytes(index, 0, this._recordBuf);
		return this;
	}

	
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

registerFactory("SingleAttribute", function (gl) {
	return class WrappedSingleAttribute extends SingleAttribute {
		constructor(options) {
			super(gl, options);
		}
	};
});

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

	
	setField(vertexIndex, fieldIndex, values) {
		this._typedArrays[fieldIndex].set(values);
		super.setBytes(
			vertexIndex,
			this._fields[fieldIndex].offset,
			this._typedArrays[fieldIndex]
		);

		return this;
	}

	
	setFields(vertexIndex, values) {
		this._typedArrays.forEach((arr, f) => {
			arr.set(values[f]);
		});

		super.setBytes(vertexIndex, 0, this._recordBuf);
		return this;
	}

	
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

	
	destroy() {
		this._gl.deleteBuffer(this._buf);
	}
}

registerFactory("InterleavedAttributes", function (gl) {
	return class WrappedInterleavedAttributes extends InterleavedAttributes {
		constructor(options, fields) {
			super(gl, options, fields);
		}
	};
});

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

	
	drawMe() {
		this._gl.drawArrays(this._drawMode, 0, this._size);
	}

	
	drawMePartial(start, count) {
		this._gl.drawArrays(this._drawMode, start, count);
	}

	
	destroy() {
		return this;
	}
}

registerFactory("SequentialIndices", function (gl) {
	return class WrappedSequentialIndices extends SequentialIndices {
		constructor(options) {
			super(gl, options);
		}
	};
});

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

	
	truncate(n) {
		this._activeIndices = Math.min(this._activeIndices, n);
		return this;
	}

	
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

	
	bindMe() {
		const gl = this._gl;
		//if (gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) !== this._buf) {
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._buf);
		//}
	}

	
	drawMe() {
		this.bindMe();
		this._gl.drawElements(this._drawMode, this._activeIndices, this._type, 0);
	}

	
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

	
	destroy() {
		this._gl.deleteBuffer(this._buf);
		return this;
	}

	
	asTypedArray(minSize) {
		if (isFinite(minSize)) {
			this.grow(minSize);
		}
		return this._ramData;
	}

	
	commit(start, length) {
		this.bindMe();

		const addr = this._bytesPerSlot * start;
		const data = new this._typedArray(this._ramData.buffer, addr, length);
		const gl = this._gl;

		gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, addr, data);

		this._setActiveIndices(start + length);
	}
}

registerFactory("IndexBuffer", function (gl, gliiFactory) {
	return class WrappedIndexBuffer extends IndexBuffer {
		constructor(options) {
			super(gl, gliiFactory, options);
		}
	};
});

// This is kinda similar to https://github.com/redboltz/number-allocator ,
// but allows allocating a range, and has worse complexity (O(n) instead of
// O(n·log(n)) ).

class Allocator {
	constructor(max = Number.MAX_SAFE_INTEGER) {
		

		this._max = max;
		// The 'points' structure is effectively a linked list of
		// start points of free/allocated regions.
		this._points = new Map();
		this._points.set(0, {
			free: true,
			next: max,
		});
	}

	
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

	
	allocateSlots(count) {
		const start = this._slotAllocator.allocateBlock(count);
		this.grow(start + count);
		return start;
	}

	
	deallocateSlots(start, count) {
		this._slotAllocator.deallocateBlock(start, count);
		return this;
	}

	
	allocateSet(indices) {
		const start = this.allocateSlots(indices.length);
		this.set(start, indices);
		return start;
	}

	
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

registerFactory("SparseIndices", function (gl, gliiFactory) {
	return class WrappedSparseIndices extends SparseIndices {
		constructor(options) {
			super(gl, gliiFactory, options);
		}
	};
});

class SequentialSparseIndices extends SequentialIndices {
	constructor(gl, options = {}) {
		super(gl, options);
		this._slotAllocator = new Allocator();
	}

	
	allocateSlots(count) {
		return this._slotAllocator.allocateBlock(count);
	}

	
	deallocateSlots(start, count) {
		this._slotAllocator.deallocateBlock(start, count);
		return this;
	}

	
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

registerFactory("SequentialSparseIndices", function (gl) {
	return class WrappedSequentialSparseIndices extends SequentialSparseIndices {
		constructor(options) {
			super(gl, options);
		}
	};
});

class TriangleIndices extends SparseIndices {
	constructor(gl, gliiFactory, options = {}) {
		
		options.size = (options.size || 85) * 3;
		super(gl, options);

		const container = this;
		
		this.Triangle = class WrappedTriangle extends Triangle {
			constructor() {
				super(container);
			}
		};

		
		this.Quad = class WrappedQuad extends Quad {
			constructor() {
				super(container);
			}
		};
	}

	
	allocateSlots(count) {
		if (count % 3) {
			throw new Error(
				"Number of vertices to be allocated from a TriangleIndices must be a multiple of 3"
			);
		}
		return super.allocateSlots(count);
	}

	
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

class Triangle {
	constructor(indices) {
		this._container = indices;
		this._idx = indices.allocateSlots(3);
		this._allocated = true;
	}

	
	setVertices(v1, v2, v3) {
		if (!this._allocated) {
			throw new Error(
				"Cannot set vertices in a `Triangle` which has been destroyed."
			);
		}
		this._container.set(this._idx, [v1, v2, v3]);
		return this;
	}

	
	destroy() {
		this._container.deallocateSlots(this._idx, 3);
		this._allocated = false;
		return this;
	}
}

class Quad {
	constructor(indices) {
		this._container = indices;
		this._idx = indices.allocateSlots(6);
		this._allocated = true;
	}

	
	setVertices(v1, v2, v3, v4) {
		if (!this._allocated) {
			throw new Error("Cannot set vertices in a `Quad` which has been destroyed.");
		}
		this._container.set(this._idx, [v1, v2, v3]);
		this._container.set(this._idx + 3, [v1, v3, v4]);
		return this;
	}

	
	destroy() {
		this._container.deallocateSlots(this._idx, 6);
		this._allocated = false;
	}
}

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

	
	get rb() {
		if (!this.#rb) {
			throw new Error("RenderBuffer has been destroyed and cannot be used");
		}
		return this.#rb;
	}

	
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

	
	destroy() {
		this.#gl.deleteRenderbuffer(this.#rb);
		this.#rb = undefined;
	}
}

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

	
	get fb() {
		return this.#fb;
	}

	
	get width() {
		return this.#width;
	}

	
	get height() {
		return this.#height;
	}

	
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

	
	get tex() {
		if (!this.#tex) {
			throw new Error("Texture has been destroyed and cannot be used");
		}
		return this.#tex;
	}

	
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

	
	setParameters(minFilter, maxFilter, wrapS, wrapT) {
		this.minFilter = minFilter ?? this.minFilter;
		this.maxFilter = maxFilter ?? this.maxFilter;
		this.wrapS = wrapS ?? this.wrapS;
		this.wrapT = wrapT ?? this.wrapT;

		this._resetParameters();
		return this;
	}

	
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

	
	texSubImage2D(img, x, y) {
		const gl = this.#gl;
		this._isLoaded = true;

		this.getUnit();
		gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, this.internalFormat, this.type, img);
		this._resetParameters();

		this.#generateMipmap();
		return this;
	}

	
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

	
	isLoaded() {
		return this._isLoaded;
	}

	
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

	
	debugIntoCanvas(canvas) {
		const data = this.asImageData();
		canvas.width = this.width;
		canvas.height = this.height;
		canvas.getContext("2d").putImageData(data, 0, 0);
		return this;
	}

	
	destroy() {
		this.#gl.deleteTexture(this.#tex);
		this.#tex = undefined;
	}
}

registerFactory("Texture", function (gl, glii) {

	
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

		
		static getMaxSize() {
			return gl.getParameter(gl.MAX_TEXTURE_SIZE);
		}
	};
});

const errRegexp = /ERROR: 0:([0-9]+):(.*)\n/;

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
			
			vertexShaderSource,
			
			varyings = {},
			
			fragmentShaderSource,
			
			indexBuffer,
			
			attributes = {},
			
			uniforms = {},
			
			textures = {},
			
			target = null,
			
			depth = 0x0207, /// 0x207 = gl.ALWAYS
			
			blend = false,

			
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

	
	run(lod) {
		this._preRun();
		this._indexBuff.drawMe(lod);
		return this;
	}

	
	runPartial(start, count) {
		this._preRun();
		this._indexBuff.drawMePartial(start, count);
		return this;
	}

	
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

	
	setTexture(name, texture) {
		this._texs[name] = texture;
		return this;
	}

	
	setIndexBuffer(buf) {
		this._indexBuff = buf;
		return this;
	}

	
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

	
	setTarget(target) {
		this._target = target;
		return this;
	}

	
	destroy() {
		this._gl.deleteProgram(this._program);
	}

	
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

registerFactory("WebGL1Clear", function (gl) {
	return class WrappedWebGL1Clear extends WebGL1Clear {
		constructor(opts) {
			super(gl, opts);
		}
	};
});

const knownCRSs = new Map();

// This is a super-simplistic CURIE parser that doesn't take into account
// the full spec (the full list of valid characters), instead parses only
// the brackets, double colon and non-whitespace. See https://www.w3.org/TR/curie/ .
const curieRegexp = /^\[(\S+):(\S+)\]$/;

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

class BaseCRS {
	
	constructor(
		name,
		{
			
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

	
	offsetToBase(xy) {
		return xy;
	}

	
	offsetFromBase(xy) {
		return xy;
	}

	

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

class OffsetCRS extends BaseCRS {
	
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

class ExpandBox {
	constructor() {
		this.reset();
	}

	
	reset() {
		
		this.minX = this.minY = Infinity;
		this.maxX = this.maxY = -Infinity;
		return this;
	}

	
	clone() {
		const newBox = new ExpandBox();
		newBox.minX = this.minX;
		newBox.minY = this.minY;
		newBox.maxX = this.maxX;
		newBox.maxY = this.maxY;
		return newBox;
	}

	
	expandPair([x, y]) {
		this.minX = Math.min(this.minX, x);
		this.maxX = Math.max(this.maxX, x);
		this.minY = Math.min(this.minY, y);
		this.maxY = Math.max(this.maxY, y);
		return this;
	}

	
	expandXY(x, y) {
		this.minX = Math.min(this.minX, x);
		this.maxX = Math.max(this.maxX, x);
		this.minY = Math.min(this.minY, y);
		this.maxY = Math.max(this.maxY, y);
		return this;
	}

	
	expandGeometry(geom) {
		const coords = geom.coords;
		for (let i = 0, l = coords.length; i < l; i += 2) {
			this.expandXY(coords[i], coords[i + 1]);
		}
		return this;
	}

	
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

	
	intersectsBox(b) {
		return (
			b.maxX > this.minX &&
			b.minX < this.maxX &&
			b.maxY > this.minY &&
			b.minY < this.maxY
		);
	}

	
	containsBox(b) {
		return (
			b.maxX < this.maxX &&
			b.minX > this.minX &&
			b.maxY < this.maxY &&
			b.minY > this.minY
		);
	}
}

class RawGeometry {
	
	constructor(
		crs,
		coords,
		rings = [],
		hulls = [],
		{ wrap = true, dimension = 2 } = {}
	) {
		
		this.wrap = wrap;
		this.dimension = dimension;
		this.crs = crs;

		
		this.coords = this.wrap ? crs.wrapString(coords) : coords;
		
		this.rings = rings;
		
		this.hulls = hulls;
	}

	
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

	
	asLngLat() {
		return this.toCRS("EPSG:4326").coords;
	}

	#loops;
	
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

	
	bbox() {
		return (this.#cachedBBox ??= new ExpandBox().expandGeometry(this)).clone();
	}
}

/*

Depths:

0  Point
1  Multipoint Linestring
2             Multilinestring Polygon
3                             Multipolygon

 */

class Geometry extends RawGeometry {
	
	constructor(
		crs,
		coords,
		{
			wrap,
			dimension = 2,
			
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

class Evented extends EventTarget {
	
	on() {
		this.addEventListener.apply(this, arguments);
		return this;
	}
	off() {
		this.removeEventListener.apply(this, arguments);
		return this;
	}

	
	once(eventName, handler) {
		return new Promise((resolve) => {
			if (handler) {
				this.on(eventName, handler, { once: true });
			}
			this.on(eventName, resolve, { once: true });
		});
	}

	
	fire(eventName, detail) {
		return this.dispatchEvent(new CustomEvent(eventName, { detail }));
	}
}

class Loader extends Evented {
	#target;
	#platina;

	constructor({ attribution } = {}) {
		super();
		
		this.attribution = attribution;
	}

	
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

	
	get target() {
		return this.#target;
	}

	
	get platina() {
		return this.#platina;
	}

	
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

var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

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

function create() {
  var out = new ARRAY_TYPE(3);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}

function transformMat3(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];
  return out;
}

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

function GleofyEventClass(Base) {
	return class GleoEvent extends Base {
		constructor(type, init) {
			super(type, init);

			
			this.geometry = init.geometry;
			this.canvasX = init.canvasX;
			this.canvasY = init.canvasY;

			
			this.colour = init.colour;

			this._canPropagate = true;
		}

		stopPropagation() {
			this._canPropagate = false;
			return super.stopPropagation();
		}
	};
}

class GleoMouseEvent extends GleofyEventClass(MouseEvent) {}

class GleoPointerEvent extends GleofyEventClass(PointerEvent) {}

const nullGeometry = new RawGeometry({ name: "null" }, [], [], [], { wrap: false });

let currentFactory = function uninitializedDefaultGeometry() {
	throw new Error(
		`A way to spawn geometries without an explicit CRS has not been defined`
	);
};

function setFactory(fn) {
	currentFactory = fn;
}

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

/// TODO: Should this have events for symbols added / removed??

class AbstractSymbolGroup extends Loader {
	constructor(opts) {
		super(opts);

		
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

	
	add(symbol) {
		if (symbol instanceof Loader) {
			this._addLoaders([symbol]);
		} else {
			this._addSymbols([symbol]);
		}
		return this;
	}

	
	_addSymbols(symbols) {
		for (const s of symbols) {
			this.symbols.add(s);
		}
	}

	
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

	
	_removeSymbols(symbols) {
		for (const s of symbols) {
			this.symbols.delete(s);
		}
	}

	
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

	
	multiRemove(symbols) {
		this._removeLoaders(symbols.filter((s) => s instanceof Loader));
		this._removeSymbols(symbols.filter((s) => !(s instanceof Loader)));

		return this;
	}

	
	empty() {
		this.symbols.clear();
		this.#loaders.length = 0;
		return this;
	}

	
	has(s) {
		return this.symbols.has(s) || this.#loaders.includes(s);
	}
}

class GleoSymbol extends Evented {
	#attribution;
	#interactive;
	#geometry;
	#cursor;
	#allocationPromise;

	
	constructor(
		geom,
		{
			
			attribution,
			
			interactive = false,
			
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

		

		this.attrBase = undefined;
		this.idxBase = undefined;
		this.attrLength = undefined;
		this.idxLength = undefined;

		this.#allocationPromise = new Promise((res, _rej) => {
			this.#resolveAllocation = res;
		});
	}

	

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

	
	static Acetate = undefined;

	
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

	
	isActive() {
		return this._inAcetate && this.attrBase !== undefined;
	}

	
	get allocation() {
		return this.#allocationPromise;
	}

	#resolveAllocation = function () {};
	#allocated = false;

	
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

	

	// TODO: Consider having a _setGlobalStridesGeom, that shall run whenever
	// the geometry changes. Some attributes depend on the geometry (e.g.
	// the extrusion in `Stroke`), as do the indices of `Fill`.

	

	
	setPointerCapture(pointerId) {
		this._inAcetate?.setPointerCapture(pointerId, this);
		return this;
	}
	releasePointerCapture(pointerId) {
		this._inAcetate?.releasePointerCapture(pointerId);
	}

	
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

class Acetate extends Evented {
	#framebuffer;
	// #depthAttachment;
	#outTexture;
	#glii;
	#zIndex;
	#attribution;

	// Whether this acetate should be redrawn
	#dirty = false;

	
	constructor(
		target,
		{
			
			queryable = false,

			
			zIndex = 0,

			
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

		
		this.queryable = queryable;

		
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

	
	get glii() {
		return this.#glii;
	}

	get platina() {
		return this._platina ? this._platina : this._inAcetate?._platina;
	}

	
	get attribution() {
		return this.#attribution;
	}

	
	static get PostAcetate() {
		return undefined;
	}

	
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

	
	add(symbol) {
		if (symbol instanceof GleoSymbol) {
			return this.multiAdd([symbol]);
		} else {
			// Assume it's a loader, and has been called through `.addTo(acetate)`
			this._loaders.add(symbol);
		}
	}

	
	multiAdd(symbols) {
		symbols.forEach((sym) => {
			sym._inAcetate = this;
		});
		
		this.fire("symbolsadded", { symbols });
		return this;
	}

	
	get symbols() {
		return this._knownSymbols.filter((s) => !!s);
	}

	
	has(s) {
		return this._knownSymbols.includes(s) || this._loaders.has(s);
	}

	
	// Implemented in `AcetateVertices`, `AcetateDot` and `AcetateFill`, due
	// to needing different handling of dumping vertex data and triangle index
	// data.

	
	reprojectAll() {
		this.bbox.reset();
		this.dirty = true;
		return this;
	}

	
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

		
		this.fire("symbolsremoved", { symbols });
		this.dirty = true;
		return this;
	}

	
	empty() {
		return this.multiRemove(this._knownSymbols);
	}

	
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

	
	clear() {
		this._clear?.run();
		return this;
	}

	
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

	
	get dirty() {
		return this.#dirty;
	}
	set dirty(d) {
		this.#dirty ||= d;
		if (this._inAcetate) {
			this._inAcetate.dirty ||= d;
		}
	}

	
	asTexture() {
		return this.#outTexture;
	}

	
	runProgram() {
		this._programs.run();
		return this;
	}

	
	multiSetCoords(start, coordData) {
		this._coords.multiSet(start, coordData);

		return this.expandBBox(coordData);
	}

	
	expandBBox(coordData) {
		for (let i = 0, l = coordData.length; i < l; i += 2) {
			if (Number.isFinite(coordData[i]) && Number.isFinite(coordData[i + 1])) {
				this.bbox.expandXY(coordData[i], coordData[i + 1]);
			}
		}
		return this;
	}

	
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

	
	get zIndex() {
		return this.#zIndex;
	}

	
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

	
	/// TODO: Allow a WebGLRenderingContext. This is problematic for
	/// the ResizeObserver and the DOM events.
	constructor(
		canvas,
		{
			
			resizable = true,
			
			backgroundColour = [0, 0, 0, 0],

			
			preserveDrawingBuffer = false,

			
			precisionThreshold = undefined,

			
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
		
		this.#boundOnPointerEvent = this._onPointerEvent.bind(this);
		for (let evName of pointerEvents) {
			this.#canvas.addEventListener(evName, this.#boundOnPointerEvent);
		}

		
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

	
	get canvas() {
		return this.#canvas;
	}

	
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

		
		this.dispatchEvent(new Event("render"));
		return this.#queueRedraw();
	}

	
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

	
	setView({
		
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

		
		this.fire("viewchanged", {
			center: this.#center,
			scale: this.#scale,
			matrix: this._crsMatrix,
		});

		this._acetates.forEach((ac) => (ac.dirty = true));

		return this;
	}

	
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

	
	get bbox() {
		return this._bbox;
	}
	set bbox(b) {
		this.fitBounds(b);
	}

	
	get pxSize() {
		return [this._pxWidth, this._pxHeight];
	}

	
	get deviceSize() {
		return [this._devWidth, this._devHeight];
	}

	
	get glii() {
		return this.#glii;
	}

	
	get map() {
		return this.#map;
	}

	
	get resizable() {
		return this.#resizable;
	}

	
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

	
	add(symbol) {
		return this.multiAdd([symbol]);
	}

	
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

	
	remove(symbol) {
		symbol.remove();
		if (symbol instanceof Loader) {
			this.#loaders = this.#loaders.filter((l) => l !== symbol);

			symbol.off("symbolsadded", this.#boundMultiAdd);
			symbol.off("symbolsremoved", this.#boundMultiRemove);
		}

		return this;
	}

	
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

	
	#scaleStopsPerCRS = new Map();
	
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

	
	unqueueCursor(cursor) {
		this.#cursorQueue.splice(this.#cursorQueue.indexOf(cursor), 1);
		this.canvas.style.cursor =
			this.#cursorQueue.length === 0 ? "" : this.#cursorQueue[0];
	}
}

const head = document.getElementsByTagName("head")[0];
const el = document.createElement("style");
el.type = "text/css";
head.appendChild(el);

function css(str) {
	const styleNode = document.createTextNode(str);
	el.appendChild(styleNode);
}

// import AbstractPin from "../pin/AbstractPin.mjs";
const AbstractPin = class {};

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

	
	constructor(container, options = {}) {
		super();
		
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

		
		const corners = [`tl`, `tr`, `bl`, `br`];
		this.controlPositions = new Map();
		for (let corner of corners) {
			const el = document.createElement("div");
			el.className = `gleo-controlcorner ${corner}`;
			this.controlPositions.set(corner, el);
			this.container.appendChild(el);
		}
	}

	
	destroy() {
		this.#platina?.destroy?.();
		this.#platina = undefined;

		this.controlPositions.forEach((corner) => this.container.removeChild(corner));

		
		this.fire("destroy");

		delete this.container._gleo;
		delete this.canvas;
		delete this.container;
	}

	
	get platina() {
		return this.#platina;
	}

	_onPlatinaEvent(ev) {
		const myEv = new ev.constructor(ev.type, ev);
		this.dispatchEvent(myEv);
	}

	
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

	
	get bbox() {
		return this.#platina.bbox;
	}
	set bbox(b) {
		this.fitBounds(b);
	}

	
	get glii() {
		return this.#platina.glii;
	}

	
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

	
	redraw() {
		this.#platina.redraw();
		return this;
	}

	
	registerSetViewFilter(fn) {
		this._setViewFilters.push(fn);
		return this;
	}
	
	unregisterSetViewFilter(fn) {
		const position = this._setViewFilters.indexOf(fn);
		if (position >= 0) {
			this._setViewFilters.splice(position, 1);
		}
		return this;
	}

	
	add(symbol) {
		if (symbol instanceof AbstractPin) {
			symbol.addTo(this);
		} else {
			this.#platina.add(symbol);
		}
		return this;
	}

	
	multiAdd(symbols) {
		this.#platina?.multiAdd(symbols.filter((s) => !(s instanceof AbstractPin)));
		symbols.filter((s) => s instanceof AbstractPin).forEach((s) => s.addTo(this));
		return this;
	}

	
	remove(symbol) {
		if (symbol instanceof AbstractPin) {
			symbol.remove();
		} else {
			this.remove.add(symbol);
		}
		return this;
	}

	
	multiRemove(symbols) {
		this.#platina?.multiRemove(symbols.filter((s) => !(s instanceof AbstractPin)));
		symbols.filter((s) => s instanceof AbstractPin).forEach((s) => s.remove());
		return this;
	}

	
	has(s) {
		return this.platina?.has(s);
	}
	
	addAcetate(ac) {
		this.#platina?.addAcetate(ac);
		ac._map = this;
		return this;
	}
}

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

	
	constructor(map) {
		this.map = map;
		this.platina = map.platina;

		

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

	
	enable() {
		this.platina.canvas.classList.add("nodrag");
		this.platina.addEventListener("pointerdown", this.#boundDown);
		this.platina.addEventListener("pointerup", this.#boundUp);
		this.platina.addEventListener("pointerout", this.#boundUp);
	}

	
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

class PinchActuator {
	#boundDown;
	#boundUp;
	#boundMove;

	
	constructor(map) {
		this.map = map;
		this.platina = map.platina;

		this.#boundDown = this.#onPointerDown.bind(this);
		this.#boundUp = this.#onPointerUp.bind(this);
		this.#boundMove = this.#onPointerMove.bind(this);
	}

	
	enable() {
		this.platina.canvas.classList.add("nopinch");
		this.platina.addEventListener("pointerdown", this.#boundDown);
		this.platina.addEventListener("pointerup", this.#boundUp);
		this.platina.addEventListener("pointerout", this.#boundUp);
	}

	
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

class WheelActuator {
	#boundWheel;
	#boundPreRender;

	
	constructor(map) {
		this.map = map;
		this.canvas = map.canvas;

		this.#boundWheel = this.#onWheel.bind(this);
		this.#boundPreRender = this.#onPreRender.bind(this);

		
		map.wheelPxPerZoomLog2 ??= map.options.wheelPxPerZoomLog2 ?? 60;

		
		map.wheelZoomDuration ??= map.options.wheelZoomDuration ?? 200;

		

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

class InertiaActuator {
	#boundPreRender;

	
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

	
	enable() {
		this.map.setView = (...args) => this.inertialSetView(...args);
	}

	
	disable() {
		this.map.setView = this.origSetView;
	}

	
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
			
			this.map.fire("inertiaend");
		}
	}
}

registerActuator("inertia", InertiaActuator, true);

class SpanClampActuator {
	
	constructor(map) {
		this.map = map;
		this.#boundFilter = this.spanClampFilterSetView.bind(this);

		

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

class ZoomYawSnapActuator {
	
	constructor(map) {
		this.map = map;

		
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

class BoundsClampActuator {
	
	constructor(map) {
		this.map = map;
		this.#boundFilter = this.boundsClampFilterSetView.bind(this);

		
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

class Control extends Evented {
	
	constructor({ position = "tl" } = {}) {
		
		super();
		this.position = position;

		this.spawnElement();
	}

	
	spawnElement() {
		
		this.element = document.createElement("div");
		this.element.className = "gleo-control";
	}

	
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

class Button extends Control {
	constructor({
		
		string,

		
		svgString,

		
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

	
	on() {
		return this.addEventListener.apply(this, arguments);
	}
	off() {
		return this.removeEventListener.apply(this, arguments);
	}

	
	addEventListener(eventName, handler) {
		this.button.addEventListener(eventName, handler);
		return this;
	}

	
	removeEventListener(eventName, handler) {
		this.button.removeEventListener(eventName, handler);
		return this;
	}

	// TODO: disable, enable.
	// TODO: focus, blur
	// TODO: keyboard accesibility (keydown/up for space & enter)
	// TODO: Wrap keyboard & pointer events (i.e. fire "pressstart", "pressend")
}

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

class ScaleBar extends Control {
	
	constructor({
		
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

class Attribution extends Control {
	
	constructor({
		
		separator = " | ",
		
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

class LngLat extends Geometry {
	
	constructor(xy, opts) {
		super(epsg4326, xy, opts);
	}
}

class LatLng extends LngLat {
	
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

class MercatorMap extends GleoMap {
	
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

class AcetateStitchedTiles extends AcetateVertices {
	#MRULevels; // Most Recently Used levels
	#texFilter; // Either glii.NEAREST or glii.LINEAR

	
	#levels = {};
	#levelNames = [];

	#uvAttr;
	#timestampAttr;
	#fadeInDuration;

	constructor(
		glii,
		{
			
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

	
	multiAdd(tiles) {
		/// TODO: Keep track of loaded tiles, in order to fire the `symbolsremoved`
		/// event whenever tiles are overwritten.

		// tiles.forEach(this.allocate.bind(this));
		tiles.forEach((t) => {
			this.allocate(t);
		});

		return super.multiAdd(tiles);
	}

	
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

	
	isLevelAvailable(levelName) {
		return this.#levels[levelName].valid && !!this._textures[levelName];
	}

	
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

class Tile extends GleoSymbol {
	
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

class AbstractTileLoader extends Loader {
	#pyramid;
	// #boundOnViewChange;
	//#tileFn;

	// Pyramid level that was the best fit for the platina's scale during the
	// last viewchange event
	#lastLevel;

	// Tile range fitting the last viewchange event
	#lastRange = [NaN, NaN, NaN, NaN];

	
	constructor(pyramid, { ...opts } = {}) {
		super(opts);
		this.#pyramid = pyramid;
		this._boundOnViewChange = this.#onViewChange.bind(this);
	}

	
	get pyramid() {
		return this.#pyramid;
	}

	
	get currentLevel() {
		return this.#lastLevel;
	}

	
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

			
			this._abortLevel(this.#lastLevel);

			this.#lastRange = [NaN, NaN, NaN, NaN];
		}

		if (this.#lastRange.every((v, i) => v === range[i])) {
			return;
		}

		const [minX, minY, maxX, maxY] = range;

		
		this.fire("rangechange", {
			level,
			minX,
			minY,
			maxX,
			maxY,
		});

		
		this._onRangeChange(level, minX, minY, maxX, maxY, level !== this.#lastLevel);

		this.#lastLevel = level;
		this.#lastRange = range;
	}

	
	_onTileLoad(level, x, y, tile) {
		
		this.dispatchEvent(
			new TileEvent("tileload", {
				tileLevel: level,
				tileX: x,
				tileY: y,
				tile: tile,
			})
		);
	}

	
	_onTileError(level, x, y, err) {
		
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

	
	constructor(
		pyramid,
		fn,
		{
			/// FIXME: tile resolution is per pyramid level, not global!!
			
			tileResX = 256,
			tileResY = 256,

			zIndex = -5500,

			
			fallback,

			
			retry = false,

			/// TODO: Additional option to enable/disable scale snap points

			
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

class TilePyramid {
	#crs;
	#scales; // Ordered array of scale factors
	#levels;
	#ids; // Map of scale factor to level name
	#orderedIds; // Ids ordered by scale

	
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

	
	ceilLevel(scale) {
		// Yes, a bisect search would be slightly more efficient, I know.
		for (let l = this.#scales.length, i = l; i > 0; i--) {
			if (this.#scales[i] >= scale) {
				return this.#ids[this.#scales[i]];
			}
		}
		return undefined;
	}

	
	floorLevel(scale) {
		for (let l = this.#scales.length, i = 0; i < l; i++) {
			if (this.#scales[i] <= scale) {
				return this.#ids[this.#scales[i]];
			}
		}
		return undefined;
	}

	
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

	
	tileCoordsToBbox(levelId, [x, y]) {
		return this.tileRangeToBbox(levelId, [x, y, x, y]);
	}

	
	childTiles(levelId, x, y) {
		return this.#familyTiles(levelId, x, y, -1);
	}

	
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

	
	get crs() {
		return this.#crs;
	}

	
	forEachLevel(fn) {
		Object.entries(this.#levels).forEach(([name, def]) => fn(name, def));

		return this;
	}

	
	mapLevels(fn) {
		return Object.entries(this.#levels).map(([name, def]) => fn(name, def));
	}

	
	getLevelsCount() {
		return Object.keys(this.#levels).length;
	}

	
	getLevelDef(name) {
		return this.#levels[name];
	}
}

const limit = 20037508.34;
const scale0 = limit * 2;
const bbox = [-limit, limit, limit, -limit]; // x1, y1, x2, y2

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

class MercatorTiles extends RasterTileLoader {
	
	constructor(templateStr, options = {}) {
		
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

export { AbstractSymbolGroup, AbstractTileLoader, Acetate, AcetateStitchedTiles, AcetateVertices, GleoMap, GleoSymbol, Loader, MercatorMap, MercatorTiles, Platina, RasterTileLoader, Tile, registerActuator };
