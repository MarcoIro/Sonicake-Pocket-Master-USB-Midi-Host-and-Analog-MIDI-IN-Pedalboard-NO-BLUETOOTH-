# Optional WiFi bridge — control the pedalboard from an iPhone

The WT9932P4-TINY has no WiFi or Bluetooth, and Safari on iPhone/iPad cannot use WebSerial. This optional bridge adds both: a small **ESP32-S3** board creates its own WiFi network, serves the web app and forwards its messages to the pedalboard over a 3-wire serial link.

- Network: **`Pedaliera`**, password **`pedaliera123`** (WPA2). Open **http://192.168.4.1** in Safari.
- No router or Internet is needed; it works on stage. iOS will say "No Internet connection": that is expected.
- From the phone you can do everything except updating the **pedalboard** firmware (USB only).
- If the bridge is off or disconnected, the pedalboard works exactly as without it.
- Firmware: bridge **1.1.3**, requires pedalboard firmware **1.3.4** or later.

> The password is the same for everyone who downloads this release. To change it, rebuild `bridge-firmware` (ESP-IDF 5.4.4, `idf.py menuconfig` → "Ponte WiFi pedaliera").

## Hardware

Tested with the **Waveshare ESP32-S3-Nano** (Arduino Nano ESP32 pin-out). Other ESP32-S3 boards work if their TX/RX pins are GPIO43/GPIO44.

| Wire | Pedalboard (WT9932P4-TINY) | → | ESP32-S3-Nano |
|---|---|---|---|
| 1 | **IO6** | → | **RX** (GPIO44) |
| 2 | **IO9** | → | **TX** (GPIO43) |
| 3 | **GND** | — | **GND** |

- On the WT9932P4-TINY, IO9 and IO6 are the 7th and 8th pins of the header that starts with IO15 (IO15 · IO14 · IO13 · IO12 · IO11 · IO10 · IO9 · IO6 …). Do not touch IO10/IO11 (OLED) or IO15 (MIDI IN).
- On the ESP32-S3-Nano the header order is TX · RX · RESET · GND · D2 …; RESET is not connected.
- The USB connector shells of the WT9932P4-TINY are tied to GND, so a GND wire can also be soldered there.
- Power the ESP32-S3 from its own USB-C port. Do not use VIN (6–21 V) and never connect 5 V to the signal pins. Both boards use 3.3 V logic: connect TX/RX directly.

## 1. Flash the bridge (first time, USB cable)

1. Connect the ESP32-S3 to the PC and find its COM port (Device Manager → Ports).
2. In an **ESP-IDF 5.4.4 PowerShell**, from this folder:

   ```powershell
   esptool.py --chip esp32s3 -p COM7 write_flash --flash_mode dio --flash_freq 80m --flash_size 4MB 0x0 bootloader.bin 0x8000 partition-table.bin 0xd000 ota_data_initial.bin 0x10000 bridge-firmware.bin
   ```

   Replace `COM7` with your port. This erases whatever is on the board.
3. If esptool cannot connect: short the **B1** pin to **GND**, press **RST**, remove the wire and run the command again (the port number may change).
4. Press RST. The `Pedaliera` WiFi network appears.

## 2. Enable the link on the pedalboard

From a computer connected with the USB cable (pedalboard firmware 1.3.4+): web app → tab **Advanced** → **WiFi bridge for iPhone** → tick **Bridge enabled** (the app suggests TX 6 and RX 9) → **Save to ESP32-P4**. A green message confirms the save.

## 3. Use it

Join the `Pedaliera` network, open **http://192.168.4.1**. The page connects by itself and shows "Connected (WiFi)". If something is wrong, a yellow box says what to check (wire IO6 → RX, GND, bridge enabled). With the USB cable connected, Advanced → WiFi bridge also shows how many bytes the pedalboard received from the bridge.

## Updating the bridge later (over WiFi)

Join `Pedaliera`, open **http://192.168.4.1/aggiorna** (also linked in the web app, tab Backup & firmware), choose the new `bridge-firmware.bin` and press **Aggiorna**. The bridge checks the file (it must be an ESP32-S3 image) and restarts after about 10 seconds. If the upload is interrupted, the previous version stays.

## SHA-256

See `SHA256SUMS.txt` in the repository root.
