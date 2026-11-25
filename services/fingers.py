"""Capture layouts are explicit; incomplete detections are never silently relabelled."""

LAYOUTS = {
    "thumbs": ["left_thumb", "right_thumb"],
    "fingers": ["left_pinky", "left_ring", "left_middle", "left_index",
                "right_index", "right_middle", "right_ring", "right_pinky"],
    "left_thumb": ["left_thumb"],
    "right_thumb": ["right_thumb"],
    "left_fingers": ["left_pinky", "left_ring", "left_middle", "left_index"],
    "right_fingers": ["right_index", "right_middle", "right_ring", "right_pinky"],
}
FINGER_CODES = {
    f"{hand}_{name}": hand[0] + code
    for hand in ("left", "right")
    for name, code in (("thumb", "t"), ("index", "i"), ("middle", "m"), ("ring", "r"), ("pinky", "p"))
}


def finger_names(count, capture_type="auto"):
    if capture_type == "auto":
        capture_type = {2: "thumbs", 8: "fingers"}.get(count)
    layout = LAYOUTS.get(capture_type, [])
    if count != len(layout):
        return [f"unknown_{index}" for index in range(count)], False
    return list(layout), True
