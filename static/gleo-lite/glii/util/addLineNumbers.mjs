
export default function addLineNumbers(str) {
	return str
		.split("\n")
		.map((l, i) => `${i}: ${l}`)
		.join("\n");
}
