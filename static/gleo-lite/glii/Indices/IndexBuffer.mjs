import { registerFactory } from "../GliiFactory.mjs";
import { default as SequentialIndices } from "./SequentialIndices.mjs";

export default class IndexBuffer extends SequentialIndices {
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
