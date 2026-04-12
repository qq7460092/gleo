import { registerFactory } from "../GliiFactory.mjs";

export default class SequentialIndices {
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
