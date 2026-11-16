import base64
import json
import struct

import pytest

from ai_phone.shared.mirror_wire import encode_mirror_message
from ai_phone.server.hub import Hub


def test_binary_media_roundtrip_preserves_header_and_bytes():
    media = bytes(range(256)) * 512
    payload = {"type": "video_segment", "serial": "test-device", "stream_id": "stream-2", "ts": 1.5,
               "data": base64.b64encode(media).decode()}
    packed = encode_mirror_message(payload)
    assert packed[:4] == b"APM1"
    length = struct.unpack(">I", packed[4:8])[0]
    header = json.loads(packed[8:8 + length])
    assert header == {k: v for k, v in payload.items() if k != "data"}
    assert packed[8 + length:] == media
    # Compare actual wire lengths for a representative encoded fragment.
    assert len(packed) < len(json.dumps(payload).encode()) * 0.76


@pytest.mark.parametrize("payload", [
    {"type": "log", "data": "aGVsbG8="},
    {"type": "video_segment", "data": "%%%"},
    {"type": "video_init", "data": None},
    {"type": "video_init", "data": "aGVsbG8=", "mime": "x" * 17000},
])
def test_non_media_or_invalid_payload_keeps_json_compatibility(payload):
    assert encode_mirror_message(payload) is None


class Socket:
    def __init__(self):
        self.json = []
        self.binary = []

    async def send_json(self, value):
        self.json.append(value)

    async def send_bytes(self, value):
        self.binary.append(value)


@pytest.mark.asyncio
async def test_mixed_clients_keep_logs_and_media_order_and_unsubscribe_cleans_capability():
    hub = Hub()
    old, new = Socket(), Socket()
    await hub.subscribe("device", old)
    await hub.subscribe("device", new, binary_mirror=True)
    for kind in ["video_init", "video_segment", "mirror_jpeg"]:
        assert await hub.broadcast_to_serial("device", {"type": kind, "data": "aGVsbG8="}) == 2
    log = {"type": "log", "message": "task finished"}
    await hub.broadcast_to_serial("device", log)
    assert [p["type"] for p in old.json] == ["video_init", "video_segment", "mirror_jpeg", "log"]
    assert len(new.binary) == 3 and new.json == [log]
    await hub.unsubscribe("device", new)
    await hub.subscribe("device", new)
    await hub.broadcast_to_serial("device", {"type": "video_segment", "data": "aGVsbG8="})
    assert len(new.binary) == 3 and new.json[-1]["type"] == "video_segment"
