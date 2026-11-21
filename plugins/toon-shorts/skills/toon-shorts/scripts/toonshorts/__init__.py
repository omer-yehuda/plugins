"""toon-shorts: storyboard JSON (+ voice) -> 1080x1920 animated cartoon short."""

__version__ = "1.1.0"

W, H = 1080, 1920          # output frame
M = 150                    # world margin around the frame for camera moves
WW, WH = W + 2 * M, H + 2 * M
GY = int(WH * 0.83)        # ground line (feet) in world pixels
SAFE = 40                  # px kept clear at every frame edge
SR = 44100                 # audio sample rate for the final mix
