import { registerFactory } from "../GliiFactory.mjs";
import SequentialIndices from "./SequentialIndices.mjs";
import { default as Allocator } from "../Allocator.mjs";

export default class SequentialSparseIndices extends SequentialIndices {
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
