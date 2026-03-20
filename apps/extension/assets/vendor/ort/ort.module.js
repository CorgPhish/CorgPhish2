// Simple ES module wrapper around the UMD bundle so we can load ORT via dynamic import without eval.
import "./ort.min.js";

export default globalThis.ort;
