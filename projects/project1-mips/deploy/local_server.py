import os
from pathlib import Path

from flask import send_from_directory

# Reuse the Vercel-oriented Flask app, but run it locally.
from api.index import app  # noqa: E402


PUBLIC_DIR = (Path(__file__).resolve().parent / "public").resolve()


@app.get("/")
def _root():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.get("/<path:subpath>")
def _static_passthrough(subpath: str):
    # Serve files from deploy/public exactly like Vercel static routing.
    return send_from_directory(PUBLIC_DIR, subpath)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "3001"))
    app.run(host="0.0.0.0", port=port, debug=True)

