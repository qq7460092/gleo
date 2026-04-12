
export default class AbstractAttributeSet {
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
