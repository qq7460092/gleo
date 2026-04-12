import { registerFactory } from "../GliiFactory.mjs";
import { default as SparseIndices } from "./SparseIndices.mjs";

export default class TriangleIndices extends SparseIndices {
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
