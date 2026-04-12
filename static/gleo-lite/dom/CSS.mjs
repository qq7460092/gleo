

const head = document.getElementsByTagName("head")[0];
const el = document.createElement("style");
el.type = "text/css";
head.appendChild(el);

export default function css(str) {
	const styleNode = document.createTextNode(str);
	el.appendChild(styleNode);
}
