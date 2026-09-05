#!/bin/bash
set -u

DURATION=${1:-5}
OUTPUT_FILE=${2:-"output.gif"}
COUNTDOWN=${3:-3}
TEMP_VID="/tmp/capture_temp.mp4"

cleanup() {
  rm -f "$TEMP_VID"
}
trap cleanup EXIT

# 1. Dependency Check
if ! command -v ffmpeg &> /dev/null || ! command -v gifski &> /dev/null; then
    echo "ERROR: Missing dependencies."
    echo "Please run: brew install ffmpeg gifski"
    exit 1
fi

echo "Grabbing active window coordinates..."

# 2. Fetch Active Window Bounds (in points, top-left origin) via AppleScript.
#    Deliberately not using "front window of frontApp" here: some apps
#    (Electron-based ones in particular) register hidden/zero-content
#    utility windows that can sort ahead of the actual visible window in
#    System Events' ordering, which silently records the wrong (tiny or
#    offscreen) region. Scanning all of the frontmost app's windows and
#    picking the largest by area reliably finds the real one instead.
BOUNDS=$(osascript -e 'tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set bestArea to -1
    set bestBounds to ""
    repeat with w in windows of frontApp
        try
            set {ww, wh} to size of w
            set {wx, wy} to position of w
            -- Skip off-screen/phantom windows (negative origin, spanning
            -- a virtual multi-monitor canvas) and degenerate slivers.
            if wx >= 0 and wy >= 0 and ww > 50 and wh > 50 then
                set thisArea to ww * wh
                if thisArea > bestArea then
                    set bestArea to thisArea
                    set bestBounds to (ww as string) & ":" & (wh as string) & ":" & (wx as string) & ":" & (wy as string)
                end if
            end if
        end try
    end repeat
    return bestBounds
end tell' 2>/dev/null)

if [ -z "$BOUNDS" ]; then
    echo "ERROR: Could not get window bounds. Ensure Accessibility permissions are granted to your terminal."
    exit 1
fi

IFS=':' read -r W H X Y <<< "$BOUNDS"

# 3. Find the avfoundation device index for "Capture screen 0" (the main
#    display) instead of assuming a fixed index - avfoundation's device
#    list includes any connected cameras/virtual devices (e.g. a webcam
#    app) ahead of the screen-capture entries, so a hardcoded index can
#    silently record the wrong source entirely.
SCREEN_DEVICE=$(ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | sed -nE 's/.*\[([0-9]+)\] Capture screen 0.*/\1/p' | head -1)
if [ -z "$SCREEN_DEVICE" ]; then
  echo "ERROR: Could not find a 'Capture screen 0' avfoundation device."
  exit 1
fi

# 4. Determine the main display's points->pixels backing scale factor via
#    NSScreen. AppleScript/System Events reports window bounds in points,
#    but avfoundation/ffmpeg capture and crop in native pixels - on a
#    Retina display those differ by 2x, so cropping with raw point values
#    grabs the wrong (quarter-sized, offset) region of the frame.
#    This assumes the recorded window is on the main display (NSScreen's
#    screens[0], which corresponds to avfoundation's "Capture screen 0")
#    - it does not resolve per-window screen placement in a multi-monitor
#    setup.
SCALE=$(osascript -l JavaScript -e '
ObjC.import("AppKit")
$.NSScreen.screens.objectAtIndex(0).backingScaleFactor.toString()
' 2>/dev/null)

if [ -z "$SCALE" ]; then
  SCALE="1"
fi

PW=$(echo "($W * $SCALE) / 1" | bc)
PH=$(echo "($H * $SCALE) / 1" | bc)
PX=$(echo "($X * $SCALE) / 1" | bc)
PY=$(echo "($Y * $SCALE) / 1" | bc)

echo "Recording window at X:$X Y:$Y (Size: ${W}x${H} points, scale ${SCALE}x -> ${PW}x${PH}px @ ${PX},${PY}) for $DURATION seconds..."

if [ "$COUNTDOWN" -gt 0 ]; then
  echo "Switch to the target window now."
  for ((i = COUNTDOWN; i > 0; i--)); do
    echo "Recording starts in $i..."
    sleep 1
  done
fi

# 5. Record Screen
# uyvy422 is requested explicitly because this device does not support
# yuv420p directly at capture time; the format filter converts it after
# cropping so the output file is still yuv420p (broadly compatible, and
# what gifski expects).
ffmpeg -y -f avfoundation -pixel_format uyvy422 -i "$SCREEN_DEVICE:none" -t "$DURATION" -vf "crop=$PW:$PH:$PX:$PY,format=yuv420p" -r 30 "$TEMP_VID" -hide_banner -loglevel error

if [ ! -s "$TEMP_VID" ]; then
    echo "ERROR: Screen recording failed. Ensure Screen Recording permissions are granted to your terminal."
    exit 1
fi

echo "Converting capture to GIF..."

# 6. Convert to High-Quality GIF
if ! gifski -o "$OUTPUT_FILE" --fps 15 "$TEMP_VID" --quiet; then
    echo "ERROR: gifski conversion failed."
    exit 1
fi

echo "Success! Saved GIF to $OUTPUT_FILE"
