# Release notes — firmware 1.3.8 + WiFi bridge 1.1.6 (2026-11-28)

Firmware for WT9932P4-TINY / ESP32-P4, built with ESP-IDF 5.4.4. Tested on hardware by the author with a Pocket Master running **CFW 1.1.1** (Stock MIDI map), including the WiFi bridge on a Waveshare ESP32-S3-Nano and an iPhone.

Update with OTA: open `docs/index.html` (or the GitHub Pages link), connect, tab **Backup & firmware**, select `firmware/pedaliera-firmware.bin`. The bootloader, partition table and OTA data are unchanged (first-time installation is the same). Saving a backup of your configuration before updating is recommended. The first update to 1.3.8 must be done with the USB cable; after that the pedalboard can also be updated from an iPhone through the WiFi bridge.

WiFi bridge: update it over WiFi (`http://192.168.4.1/aggiorna`) with `wifi-bridge/bridge-firmware.bin`. Its other files are unchanged.

## New in 1.3.8

### Firmware updates from an iPhone / iPad
- The pedalboard now accepts firmware updates sent through the optional WiFi bridge (before, they were USB-only).
- Each chunk carries its position: a lost or repeated chunk is rejected at once instead of at the end.
- An update running from one link (USB or WiFi) cannot be disturbed by the other; after 30 s of silence (for example a phone that went to sleep) a new update can start from either link.
- Safety is unchanged: the image is activated only if it is complete and its SHA-256 is correct, and rollback is enabled. If anything goes wrong the previous firmware stays.
- Web app: larger chunks over WiFi (faster), progress percentage, a clear message when the pedalboard firmware is too old for WiFi updates.

### Scenes in sync with Pocket Master CFW 1.1.1
- With CFW 1.1.x, a preset changed on the Pocket Master while SC1/SC2 is playing is not always announced over USB, so the pedalboard stayed on the old preset and its scene buttons did the opposite. While idle, the pedalboard now asks for the current preset once per second (a 14-byte request that does not wait for acknowledgements, so footswitches are not delayed). If the preset changed, scene, LEDs, OLED and preset values are resynchronized; if not, nothing happens.
- After a preset change while SC1/SC2 was active, the pedalboard also sends Base (CC 85) so the Pocket Master and the pedalboard agree.

### Global EQ slots (CFW 1.1+, CC 116)
- Ready-made CC commands for Global EQ slots 1–4 (Global EQ on/off moved to the same group).
- New footswitch action **Global EQ: next slot**: each press moves to the next ticked slot and shows it on the OLED. After power-on the first press goes to the first ticked slot (the pedalboard cannot read the active slot). The ticked slots are stored in an existing field, so the configuration size does not change. This action is verified on the computer (save / reload) but not yet tested on hardware by the author.

### Diagnostics
- Short Pocket Master messages that the pedalboard does not recognize, plus preset and block notifications, appear in the web app monitor (tab Advanced) as `pm_rx` lines (at most 10 per second, never blocking).
- A firmware line that is not an update command is no longer parsed twice, so a configuration save does not need more RAM.

### Pocket Master CFW 1.1.1
- The effect data of CFW 1.1.1 is identical to CFW 1.0.3: the 161 effects / 730 parameters are unchanged. The only new MIDI function is CC 116 (Global EQ slot).

## Included from 1.3.4
- Optional WiFi bridge for iPhone / iPad (`wifi-bridge/`), compressed configuration saving, phone layout and save confirmation messages.

## Included from 1.2.0
- Reliable multi-action footswitches (ACK-paced SysEx, settle times after preset/scene changes).
- Expression pedals by block → effect → parameter in real units, soft takeover from the preset value, effect-mismatch warning.
- Set parameter (A/B) and Change effect (A/B, with parameters) actions; LEDs follow the real preset state.
- Tap tempo can set the preset BPM on the Pocket Master CFW (CC 68/69); ready-made CFW commands.
- 161 effects including the CFW's own models; Italian / English web app with tabs, backups and automatic configuration read.

## Data sources
Effect data comes from the open-source SonicMaster editor and from the public data of the [Pocket Master CFW web app](https://pocketmaster-cfw.guitar-training-generator.com/). Pocket Master CFW is an unofficial community project; this pedalboard is not affiliated with Sonicake or the CFW authors.
