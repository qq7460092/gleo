import { registerFactory } from "../GliiFactory.mjs";
import { default as IndexBuffer } from "./IndexBuffer.mjs";
import { default as Allocator } from "../Allocator.mjs";

export default class SparseIndices extends IndexBuffer {
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
