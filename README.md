# MIDI Pedalboard — public release package

This lightweight package is for users of the **WT9932P4-TINY board with ESP32-P4**. It contains the web app and prebuilt firmware binaries. It does not contain build caches, development logs, the ESP-IDF SDK, or dependency source trees.

> **Supported hardware:** WT9932P4-TINY with ESP32-P4 and the USB routing used by this project. Do not use this firmware or the eFuse procedure on another board or hardware revision unless you have verified its USB wiring.

## Which installation path do I need?

| Board state | What to do |
| --- | --- |
| First installation; FUSB appears as **Espressif USB Serial/JTAG** in Windows | Follow **First-time installation** below. It flashes the firmware and then permanently programs one eFuse. |
| The board already exposes **USB CDC** and **USB MIDI** on FUSB | Do not run the initial installer. Use **Firmware updates** and upload only `firmware/pedaliera-firmware.bin` in the web app. |
| The eFuse is set, but the board does not start or CDC/MIDI do not appear | Stop and request help. The initial installer intentionally refuses to run again; do not try to burn the eFuse a second time. |

## First-time installation (Windows)

This is a one-time setup for a board that has not yet been switched to native USB MIDI. It installs the **prebuilt firmware files included in this repository**; it does not compile the source code. No Arduino IDE, VS Code, or manually installed Python is required.

### Programs and hardware you need

1. **Windows 10 or 11**.
2. **Espressif ESP-IDF 5.4.4 Tools Installer for Windows.** Use Espressif's [installer page](https://dl.espressif.com/dl/esp-idf/) and select version **5.4.4**, or follow the [official ESP32-P4 Windows setup guide](https://docs.espressif.com/projects/esp-idf/en/v5.4/esp32p4/get-started/windows-setup.html). When asked for install folders, use paths without spaces, such as `C:\Espressif`. Choose the ESP-IDF PowerShell environment at the end of setup. The installer provides the required Python environment, `esptool.py`, `espefuse.py`, and other ESP-IDF tools; do not install these separately.
3. **Chrome or Microsoft Edge** for the web app.
4. A **USB data cable** and the supported WT9932P4-TINY / ESP32-P4 board.
5. A way to download/extract the GitHub ZIP. Git is optional; downloading the ZIP in a browser is enough.

### A. Download and prepare the package

1. On the GitHub repository page, choose **Code → Download ZIP**.
2. Extract the ZIP and move/rename the extracted folder to a short path without spaces, for example `C:\pedaliera-release`.
3. Connect the board to the PC with the cable plugged into **FUSB**. Do not use a charge-only cable.
4. Find the correct COM port before continuing:
   - Press **Windows key + X → Device Manager**.
   - Expand **Ports (COM & LPT)**. Find the entry named **Espressif USB Serial/JTAG** (the exact wording may vary); the port is the value in parentheses, for example `COM18`.
   - To confirm which entry belongs to this board, unplug FUSB and note which entry disappears; reconnect FUSB and use the COM entry that returns. Do not choose another device's COM port.
   - You can also list the matching Espressif device from PowerShell with:

     ```powershell
     Get-CimInstance Win32_SerialPort |
       Where-Object { $_.PNPDeviceID -match 'VID_303A&PID_1001' } |
       Select-Object DeviceID, Name, PNPDeviceID
     ```

     Use the `DeviceID` shown, such as `COM18`, in the installer command. The installer checks for this USB ID itself and stops if the selected COM port is not the expected USB Serial/JTAG device.

   If no Espressif entry appears, check that the cable supports data, is connected to **FUSB**, and that the board is still in its initial USB Serial/JTAG state. A board that has already had `USB_PHY_SEL` programmed follows the OTA update procedure instead.

### B. Open the correct terminal and check the tools

1. Open the Start menu and launch **ESP-IDF 5.4.4 PowerShell**. Do not use a regular PowerShell window for the installer.
2. Run these commands one at a time:

   ```powershell
   idf.py --version
   python --version
   $env:IDF_PATH
   Test-Path "$env:IDF_PATH\components\esptool_py\esptool\esptool.py"
   Test-Path "$env:IDF_PATH\components\esptool_py\esptool\espefuse.py"
   ```

   Confirm the ESP-IDF version is **5.4.4** and both `Test-Path` commands return `True`. The Python command should work in this ESP-IDF terminal because its bundled environment has been activated.
3. Change to the extracted package directory:

   ```powershell
   cd C:\pedaliera-release
   ```

   If you chose a different folder, use its actual path.
4. If you did not identify the port in Device Manager, run the filtered PowerShell command in section **A** now and note its `DeviceID` value.

### C. Flash firmware and program the eFuse

Run this command, replacing `COM18` with the port found above:

```powershell
.\installazione-iniziale.ps1 -Port COM18
```

If PowerShell says scripts are disabled, run this command in the **same ESP-IDF PowerShell window**:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

Then run the installer command again. This changes the policy only for that terminal session.

The installer checks that the COM port is the expected Espressif USB Serial/JTAG interface, reads `USB_PHY_SEL`, and verifies that all four firmware files are present. It then asks for the exact confirmation `ATTIVA USB MIDI`. After confirmation it writes the bootloader, partition table, initial OTA data, and application to the ESP32-P4. It programs the eFuse **only if the flash succeeds**. Keep the cable connected and do not close the terminal while it runs.

When it reports completion:

1. Unplug the USB cable.
2. Reconnect it to **FUSB** without holding BOOT.
3. In Device Manager, confirm that Windows now detects the board's USB CDC serial port and USB MIDI device.
4. Continue to [Open the web app](#open-the-web-app) and connect to the CDC port.

If the flash fails, the script stops without programming the eFuse. If the eFuse command reports a disconnect, do not run the burn again blindly: reconnect FUSB and check whether CDC and USB MIDI appeared. See [What the eFuse does](#what-the-efuse-does) before asking for recovery help.

### What the eFuse does

On the supported WT9932P4-TINY board, FUSB initially uses the USB Serial/JTAG function. This firmware needs FUSB to operate as USB OTG Full-Speed so it can expose USB CDC (for the web app) and native USB MIDI at the same time. The **`USB_PHY_SEL` eFuse** selects that routing.

Programming this eFuse is **permanent and cannot be undone**. Afterward, FUSB is no longer available for Serial/JTAG flashing or debugging. **HUSB remains the USB host connector for the Pocket Master.** The installer reads the fuse first and stops if it is already set; never run an eFuse burn command manually to get around that check.

The installer writes the bootloader, partition table, OTA data, and app at their required flash offsets. It does not run `erase_flash`. If you are reinstalling a board that already contains settings, export a configuration backup from the web app first; settings may not be compatible with a changed partition layout.

## Open the web app

The web app is a **single self-contained HTML file**. No Python, web server, or separate CSS/JavaScript files are needed.

- **Open locally:** extract the GitHub ZIP, then double-click `web-app/index.html` and open it with Chrome or Microsoft Edge.
- **Open online:** enable GitHub Pages for the repository (Settings → Pages → deploy from the `main` branch and `/(root)`), then visit `https://<your-account>.github.io/<repository>/web-app/`.

Web Serial is available only in supported browsers and secure contexts. A local `file://` page is treated as a secure context by current browsers; if your browser or organization policy blocks serial access from local files, use the GitHub Pages HTTPS link instead. Connect FUSB and press **Connetti Seriale**. The app's interface is currently in Italian. Configuration and firmware update commands require **Pocket Master mode**; native USB MIDI mode suspends those commands.

## Firmware updates

Use this path only after the board already exposes CDC and USB MIDI on FUSB. **Do not burn the eFuse again and do not run the initial installer for a normal update.**

1. Download the new `pedaliera-firmware.bin` from the GitHub **Releases** page.
2. Open the web app, connect the board over FUSB, and switch to **Pocket Master mode**. If the board is in USB MIDI mode, hold the two configured mode-switch footswitches together for about 3 seconds. The button combination can be changed in the configuration.
3. In the web app's firmware update section, select the downloaded `.bin` file and start the update.
4. Keep the USB cable connected and the web app open. Wait for the transfer to finish and for the board to restart.

For OTA, select **only** the application `.bin`. Do not select `bootloader.bin`, `partition-table.bin`, or `ota_data_initial.bin`; those files are for first-time wired installation. OTA writes the application to the inactive app slot and leaves the partition table unchanged. A release that changes the partition table, bootloader, or eFuse requirements must provide its own recovery/update instructions.

## Features

- Controls a Sonicake Pocket Master connected to **HUSB**: reads/synchronizes state, selects among 100 presets, moves to the previous/next preset, sends tap tempo, and toggles effect modules.
- Exposes a composite USB device on **FUSB**: class-compliant USB MIDI for a DAW or MIDI software, plus USB CDC for the web app. A configurable two-footswitch hold switches modes.
- Configures up to 16 footswitch profiles and 6 layers. This firmware snapshot starts with 9 buttons and 2 layers. Actions include short/long press, module toggle, preset selection, tap tempo, layer switching, custom CC, custom SysEx, and patch-scene jumps with return.
- Configures footswitch LEDs and the OLED layout, including preset, layer, USB, BPM, and expression-pedal information.
- Supports up to 6 expression pedals with calibration, soft takeover, parameter assignments, and USB MIDI CC output. Assignments can vary by preset. A configurable footswitch combination can act as an expression killswitch.
- In USB MIDI mode, footswitches can send CC, Note, Program Change, and Tap Tempo messages with configurable values and momentary/toggle behavior. Expression pedals can send CC messages.
- Supports wired MIDI input with passthrough, channel filtering, and remapping of all 16 MIDI channels, depending on the installed hardware wiring.
- The web app provides live status, manual CC/SysEx sending, JSON configuration import/export, and USB firmware updates. Configuration is stored in the board's NVS flash.

Available features depend on the physical pedalboard wiring. FUSB pins are reserved for USB and cannot be assigned to buttons or LEDs.

## Troubleshooting

- **No COM port appears:** try a known data cable and another USB port, then check Device Manager. The initial installer accepts only the Espressif USB Serial/JTAG interface on FUSB.
- **The installer says `USB_PHY_SEL` is already set:** do not run the initial installation again. Use OTA from the web app if CDC is working.
- **The browser does not offer a serial port:** use Chrome or Edge, serve the app through GitHub Pages/HTTPS or `localhost`, and reconnect FUSB.
- **The web app cannot communicate or OTA will not start:** make sure the selected port is the board's CDC port, close other applications using it, and switch to Pocket Master mode.
- **The board disconnects during eFuse programming:** do not retry the burn blindly. Reconnect FUSB and check whether USB CDC and MIDI have appeared.

## Upload this package to GitHub

To publish this folder as a simple end-user repository:

1. Create a new GitHub repository.
2. Upload the **contents** of this `github-release` folder to the repository root. The root should contain this `README.md`, `installazione-iniziale.ps1`, `firmware/`, and `web-app/`.
3. In the repository settings, enable GitHub Pages if you want users to open the web app online. The app URL will end in `/web-app/`.
4. Publish a GitHub Release for each firmware version. Attach at least `pedaliera-firmware.bin` for OTA users. For first-time installs, keep all four files from `firmware/` in the repository and attach them to the release as well.
5. Update `RELEASE.md` and regenerate `SHA256SUMS.txt` whenever you replace the firmware or web app. State the target board, tested hardware, changes, and any special update/recovery steps.

**Included firmware snapshot:** built on 2026-11-06. It does not yet have a semantic version tag. Before calling it a stable public release, assign a version/tag and list the hardware revisions actually tested.

## Licensing and trademarks

Sonicake, Pocket Master, ESP32-P4, and toolchain trademarks belong to their respective owners; names here identify compatibility. Before publishing, choose and add a license for the project's original material and check the licenses of any dependencies you distribute. This package does not assign a license to the code.





