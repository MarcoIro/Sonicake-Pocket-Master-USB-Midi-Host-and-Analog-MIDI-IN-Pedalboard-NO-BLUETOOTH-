# Release notes — firmware 1.2.0 (2026-11-26)

Firmware for WT9932P4-TINY / ESP32-P4, built with ESP-IDF 5.4.4. Tested on hardware by the author with a Pocket Master running CFW 1.0.3 (Stock MIDI map).

Update with OTA: open `web-app/index.html`, connect, tab **Backup & firmware**, select `firmware/pedaliera-firmware.bin`. The bootloader, partition table and OTA data are unchanged from the previous package (first-time installation is the same).

## Firmware
- Version number (1.2.0) on the OLED at startup and in the web app.
- Reliable multi-action footswitches: each SysEx write waits for the Pocket Master's ACK; preset (300 ms max + 40 ms) and scene (60 ms) changes get a settle time; when presets are scrolled quickly only the latest one is sent.
- Parameters are sent as the device's real float value, so every parameter of every effect can be controlled.
- Reads the active preset from the Pocket Master: effect loaded in each block, every parameter's value, preset BPM.
- Expression pedals: real-unit ranges and soft takeover based on the value stored in the preset.
- New actions: **Set parameter** (A/B) and **Change effect** (A/B, with up to 4 parameter values); LEDs follow the real preset state.
- Tap tempo modes: DLY Time in ms (default, as before) · preset BPM via CFW CC 68/69 · BPM + DLY Time when the delay's Sync is off.
- Effect tables for 186 selectable effects, including the CFW's own models.
- Older saved configurations keep working; new JSON fields have defaults.

## Web app
- Tabs: Live, Buttons, Pedals, USB MIDI, Backup & firmware, Advanced.
- Italian / English.
- Reads the configuration from the pedalboard automatically when connecting.
- Expression targets chosen by block → effect → parameter with real units, Test buttons and effect-mismatch warnings.
- Ready-made Pocket Master CFW commands for CC actions; reorderable additional actions.
- Named and dated backups.

## Data sources
Effect data comes from the open-source SonicMaster editor and from the public data of the [Pocket Master CFW web app](https://pocketmaster-cfw.guitar-training-generator.com/). Pocket Master CFW is an unofficial community project; this pedalboard is not affiliated with Sonicake or the CFW authors.
