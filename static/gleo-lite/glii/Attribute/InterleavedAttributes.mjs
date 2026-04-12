import { default as AbstractAttributeSet } from "./AbstractAttributeSet.mjs";
import { registerFactory } from "../GliiFactory.mjs";
import { default as typeMap } from "../util/typeMap.mjs";
import { parseGlslAttribType } from "../util/parseGlslType.mjs";
import stridedArrays from "./StridedTypedArrays.mjs";

/// TODO: Somehow implement integer GLSL types for WebGL2.

export default class InterleavedAttributes extends AbstractAttributeSet {
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
					)
				};
				return result;
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
