# Release notes

- Included firmware snapshot: build dated 2026-11-12.
- Declared target: WT9932P4-TINY / ESP32-P4.
- The initial installer permanently programs `USB_PHY_SEL` after flashing the firmware.
- This build adds an adjustable expression-pedal jitter filter and preserves live Toggle con hold handling for the stock FX1 switch, which is also reserved for the mode-switch combination.
- The standalone web app was regenerated from UTF-8 source to preserve accented characters and emoji.
- OTA transfer still needs confirmation on the physical board; the previous OTA verification limitation remains.
- For future releases, document changes, tested hardware, partition/eFuse changes, and the update path.
