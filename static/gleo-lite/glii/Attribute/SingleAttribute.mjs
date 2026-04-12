import { default as AbstractAttributeSet } from "./AbstractAttributeSet.mjs";
import { registerFactory } from "../GliiFactory.mjs";
import { default as typeMap } from "../util/typeMap.mjs";
import { parseGlslAttribType } from "../util/parseGlslType.mjs";
import stridedArrays from "./StridedTypedArrays.mjs";

/// TODO: Somehow implement integer GLSL types for WebGL2.

export default class SingleAttribute extends AbstractAttributeSet {
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
		};
		return result;
	}
}

registerFactory("SingleAttribute", function (gl) {
	return class WrappedSingleAttribute extends SingleAttribute {
		constructor(options) {
			super(gl, options);
		}
	};
});
