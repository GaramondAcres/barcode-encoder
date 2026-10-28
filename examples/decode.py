"""Decode actual upstream GIF bytes independently, and verify their pixels against the module map."""
import hashlib
import importlib.metadata
import json
from pathlib import Path
from PIL import Image
import zxingcpp

root = Path(__file__).resolve().parents[1]
traces = json.loads((root / "proof/traces.json").read_text())
results = []
for case in traces["cases"]:
    if "error" in case:
        results.append({"id": case["id"], "error": case["error"], "passed": False})
        continue
    file = root / "proof" / (case["id"] + ".gif")
    image = Image.open(file).convert("L")
    scale = case["scale"]
    modules = Image.open(root / "proof" / (case["id"] + ".pbm")).convert("L")
    expected = modules.resize(image.size, Image.Resampling.NEAREST)
    pixels_match = image.tobytes() == expected.tobytes()
    decoded = zxingcpp.read_barcodes(image)
    format_id = {"QR Code": zxingcpp.BarcodeFormat.QRCode, "Data Matrix": zxingcpp.BarcodeFormat.DataMatrix, "Aztec": zxingcpp.BarcodeFormat.Aztec}[case["family"]]
    matches = len(decoded) == 1 and decoded[0].bytes == case["input"].encode("utf-8") and decoded[0].format == format_id
    hash_matches = hashlib.sha256(file.read_bytes()).hexdigest()==case["gifSha256"]
    result = {"id":case["id"],"expected":case.get("expected","roundtrip"),"format":case["family"],
        "input":case["input"],"decoded":[{"format":str(b.format),"text":b.text,"bytes":list(b.bytes)} for b in decoded],
        "pixelsMatch":pixels_match,"sha256Match":hash_matches,
        "roundtrip":matches, "passed": pixels_match and matches and hash_matches}
    results.append(result)
    print(case["id"], "PASS" if result["passed"] else "LIMITATION" if case.get("expected") else "FAIL", repr([b.text for b in decoded]))
    if case["id"] in ["qr", "data-matrix", "aztec"]:
        image.save(file.with_suffix(".png"))
report = {"sourceCommit":traces["sourceCommit"],"decoder":"zxing-cpp","decoderVersion":importlib.metadata.version("zxing-cpp"),
    "pillowVersion":importlib.metadata.version("Pillow"),"cases":results}
(root / "proof/verification.json").write_text(json.dumps(report,indent=2)+"\n")
unexpected = [r for r in results if not r.get("pixelsMatch") or not r.get("sha256Match") or (r.get("expected","roundtrip")=="roundtrip" and not r["passed"])]
raise SystemExit(1 if unexpected else 0)
