# Release notes — firmware 1.3.4 + WiFi bridge 1.1.3 (2026-11-26)

Firmware for WT9932P4-TINY / ESP32-P4, built with ESP-IDF 5.4.4. Tested on hardware by the author with a Pocket Master running CFW 1.0.3 (Stock MIDI map), including the WiFi bridge on a Waveshare ESP32-S3-Nano and an iPhone.

Update with OTA: open `web-app/index.html`, connect, tab **Backup & firmware**, select `firmware/pedaliera-firmware.bin`. The bootloader, partition table and OTA data are unchanged (first-time installation is the same). Saving a backup of your configuration before updating is recommended.

## New in 1.3.4

### Optional WiFi bridge for iPhone / iPad
- Safari has no WebSerial and the WT9932P4-TINY has no radio, so an ESP32-S3 board (folder `wifi-bridge/`) creates the WiFi network `Pedaliera` and serves the web app at `http://192.168.4.1`. Instructions: `wifi-bridge/README.md`.
- Pedalboard side: UART2 at 921,600 baud on two GPIOs chosen in the web app (IO6/IO9 suggested), disabled by default. Commands from the bridge are processed one at a time with the USB ones; status updates never wait for the bridge, so footswitches and MIDI are not delayed. Firmware updates of the pedalboard stay USB-only.
- The bridge updates itself over WiFi (`http://192.168.4.1/aggiorna`) and verifies the file before switching.
- Diagnostics on both sides: the phone shows what to check when the pedalboard does not answer; the computer shows how much data arrived from the bridge.

### Configuration saving fixed
- Saving could fail with "Unable to save configuration to flash" because the save needed too much RAM and the configuration no longer fitted twice in the small NVS partition. The configuration is now stored compressed (about 10.9 KB → 3.2 KB, CRC-checked) and the save uses far less RAM. A failed save never deletes the stored configuration, and the web app shows the reason. Older stored configurations are read normally.
- The status message reports free RAM (`heap`, `heap_max`).

### Web app
- Layout for phone screens (no horizontal overflow, no Safari zoom on input, "Save" always reachable).
- Clear "saved" / "not saved (reason)" messages after every save, with an automatic read-back.

## Included from 1.2.0
- Reliable multi-action footswitches (ACK-paced SysEx, settle times after preset/scene changes).
- Expression pedals by block → effect → parameter in real units, soft takeover from the preset value, effect-mismatch warning.
- Set parameter (A/B) and Change effect (A/B, with parameters) actions; LEDs follow the real preset state.
- Tap tempo can set the preset BPM on the Pocket Master CFW (CC 68/69); ready-made CFW commands.
- 161 effects including the CFW's own models; Italian / English web app with tabs, backups and automatic configuration read.

## Data sources
Effect data comes from the open-source SonicMaster editor and from the public data of the [Pocket Master CFW web app](https://pocketmaster-cfw.guitar-training-generator.com/). Pocket Master CFW is an unofficial community project; this pedalboard is not affiliated with Sonicake or the CFW authors.
