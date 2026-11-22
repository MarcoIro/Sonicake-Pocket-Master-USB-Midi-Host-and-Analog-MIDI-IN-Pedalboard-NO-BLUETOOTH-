# Release notes

- Firmware package updated from the Pocket Master source build dated 2026-11-22 for WT9932P4-TINY / ESP32-P4.
- Added native Pocket Master scene buttons: base CC 85, scene 1 CC 82, scene 2 CC 83. These scene commands always send value 127. The base scene is active at startup and the assigned footswitch LED follows native scene selection.
- Native scene LEDs reset to base whenever a changed preset is detected (footswitch, MIDI, or web app); pressing the active scene 1 or 2 button returns to base.
- The patch reset also clears latched LED state from older custom CC 82/83 scene assignments.
- Added FREEZE as a named CC 114 toggle: first press sends 127 and lights its LED, next press sends 0, and patch changes reset it to off.
- Pocket Master CFW compatibility is documented for its Stock MIDI map and custom maps that retain these CC assignments.
- Native Pocket Master scene selection is independent of the firmware's preset Scene / Patch Jump action.
- The web app supports up to four actions per Pocket Master footswitch, custom CC fixed/toggle/momentary behavior, and expression pedal CC outputs.
- The public web app is a single self-contained `web-app/index.html`, bundled from the current development sources.
- ESP-IDF 5.4.4 build completed. No hardware test or OTA update was performed for this package.
