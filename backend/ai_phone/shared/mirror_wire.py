"""Optional browser mirror envelopes; Agent messages remain backward compatible.

APM1 + uint32 big-endian JSON-header length + UTF-8 header + raw media bytes.
Only a browser explicitly requesting mirror=binary-v1 receives these messages.
Logs, control messages and older clients keep their original JSON protocol.
"""
from __future__ import annotations

import base64
import binascii
import json
import struct
from typing import Any

MEDIA_TYPES = frozenset({"video_init", "video_segment", "mirror_jpeg"})
MAGIC = b"APM1"
MAX_HEADER = 16 * 1024


def encode_mirror_message(payload: dict[str, Any]) -> bytes | None:
    if payload.get("type") not in MEDIA_TYPES or not isinstance(payload.get("data"), str):
        return None
    try:
        media = base64.b64decode(payload["data"], validate=True)
    except (binascii.Error, ValueError):
        return None
    header = json.dumps(
        {key: value for key, value in payload.items() if key != "data"},
        ensure_ascii=False, separators=(",", ":"),
    ).encode("utf-8")
    if len(header) > MAX_HEADER:
        return None
    return MAGIC + struct.pack(">I", len(header)) + header + media
