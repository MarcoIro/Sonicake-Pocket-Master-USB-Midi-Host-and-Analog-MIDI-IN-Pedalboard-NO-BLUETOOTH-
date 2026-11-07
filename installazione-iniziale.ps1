param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^COM\d+$')]
    [string]$Port
)

$ErrorActionPreference = 'Stop'

function Stop-WithMessage([string]$Message) {
    Write-Error $Message
    exit 1
}

if (-not $env:IDF_PATH -or -not (Test-Path -LiteralPath $env:IDF_PATH)) {
    Stop-WithMessage 'Apri ESP-IDF PowerShell con ESP-IDF 5.4.4 attivo e rilancia lo script.'
}

$pythonExe = $null
if ($env:IDF_PYTHON_ENV_PATH) {
    $candidate = Join-Path $env:IDF_PYTHON_ENV_PATH 'python.exe'
    if (Test-Path -LiteralPath $candidate) { $pythonExe = $candidate }
}
if (-not $pythonExe) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) { $pythonExe = $pythonCommand.Source }
}
if (-not $pythonExe) {
    Stop-WithMessage 'Python dell’ambiente ESP-IDF non trovato.'
}

$esptool = Join-Path $env:IDF_PATH 'components\esptool_py\esptool\esptool.py'
$espefuse = Join-Path $env:IDF_PATH 'components\esptool_py\esptool\espefuse.py'
if (-not (Test-Path -LiteralPath $esptool) -or -not (Test-Path -LiteralPath $espefuse)) {
    Stop-WithMessage 'Non trovo esptool.py o espefuse.py nell’installazione ESP-IDF attiva.'
}

$portInfo = Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue |
    Where-Object { $_.DeviceID -eq $Port } |
    Select-Object -First 1
if (-not $portInfo -or $portInfo.PNPDeviceID -notmatch 'VID_303A&PID_1001') {
    Stop-WithMessage "$Port non risulta la USB Serial/JTAG Espressif attesa su FUSB. Se USB_PHY_SEL è già 1, non usare questo installer: aggiorna dalla web app."
}

$packageRoot = Split-Path -Parent $PSCommandPath
$firmwareDir = Join-Path $packageRoot 'firmware'
$requiredFiles = @('bootloader.bin', 'partition-table.bin', 'ota_data_initial.bin', 'pedaliera-firmware.bin')
foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $firmwareDir $file))) {
        Stop-WithMessage "File firmware mancante: firmware\$file"
    }
}

Write-Host "Leggo USB_PHY_SEL su $Port..."
$summary = & $pythonExe $espefuse --chip esp32p4 --port $Port summary 2>&1
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage ("Lettura eFuse non riuscita:`n" + ($summary | Out-String))
}
$summaryText = $summary | Out-String
$fuseMatch = [regex]::Match($summaryText, '(?m)^USB_PHY_SEL\s+\(BLOCK0\).*?=\s+(True|False)\b')
if (-not $fuseMatch.Success) {
    Stop-WithMessage 'La lettura non ha restituito USB_PHY_SEL in modo riconoscibile; non modifico la scheda.'
}
if ($fuseMatch.Groups[1].Value -eq 'True') {
    Stop-WithMessage 'USB_PHY_SEL è già 1. Non ripetere l’installazione iniziale: usa Aggiornamento firmware via USB nella web app.'
}

Write-Host ''
Write-Host 'ATTENZIONE: questo passaggio programma un eFuse irreversibile.' -ForegroundColor Yellow
Write-Host 'FUSB passerà da USB Serial/JTAG a USB CDC + USB MIDI nativa.' -ForegroundColor Yellow
Write-Host 'Dopo il cambio non sarà più possibile usare FUSB per flash/debug Serial/JTAG.' -ForegroundColor Yellow
Write-Host 'La procedura scrive bootloader, tabella partizioni e firmware; non esegue erase_flash.' -ForegroundColor Yellow
Write-Host 'Scheda supportata da questo pacchetto: WT9932P4-TINY con ESP32-P4.' -ForegroundColor Yellow
$confirmation = Read-Host 'Per continuare scrivi ATTIVA USB MIDI'
if ($confirmation -cne 'ATTIVA USB MIDI') {
    Write-Host 'Operazione annullata; flash ed eFuse non sono stati modificati.'
    exit 0
}

Write-Host "Flash del firmware iniziale su $Port..."
& $pythonExe $esptool --chip esp32p4 -p $Port -b 460800 --before default_reset --after hard_reset write_flash --flash_mode dio --flash_size 16MB --flash_freq 80m `
    0x2000 (Join-Path $firmwareDir 'bootloader.bin') `
    0x8000 (Join-Path $firmwareDir 'partition-table.bin') `
    0x10000 (Join-Path $firmwareDir 'ota_data_initial.bin') `
    0x20000 (Join-Path $firmwareDir 'pedaliera-firmware.bin')
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'Flash iniziale non riuscito; non è stata richiesta la modifica eFuse.'
}

Write-Host ''
Write-Host 'Flash completato e scheda riavviata. Controlla che il firmware si avvii (display/LED, se presenti) prima di proseguire.' -ForegroundColor Yellow
Write-Host 'Ora entra manualmente in ROM download mode: tieni premuto BOOT, premi e rilascia RESET, poi rilascia BOOT.' -ForegroundColor Yellow
Write-Host 'Lascia FUSB collegata. Il burn userà --before no_reset per non resettare la scheda fuori dalla download mode.' -ForegroundColor Yellow
$downloadConfirmation = Read-Host 'Quando la scheda è in download mode, scrivi DOWNLOAD MODE'
if ($downloadConfirmation -cne 'DOWNLOAD MODE') {
    Write-Host 'Operazione interrotta. Il firmware è stato flashato, ma USB_PHY_SEL non è stato modificato.'
    exit 0
}

Write-Host 'Programmo USB_PHY_SEL=1 senza resettare la scheda prima del collegamento...'
$burnOutput = & $pythonExe $espefuse --chip esp32p4 --before no_reset --port $Port --do-not-confirm burn_efuse USB_PHY_SEL 1 2>&1
$burnExitCode = $LASTEXITCODE
$burnOutput | ForEach-Object { Write-Host $_ }
if ($burnExitCode -ne 0) {
    Write-Warning 'La connessione può essersi interrotta durante la programmazione/verifica. Non ripetere il burn alla cieca: scollega e ricollega FUSB, poi controlla se compaiono CDC e USB MIDI.'
    exit 2
}

Write-Host ''
Write-Host 'Prima installazione completata. Scollega e ricollega FUSB senza tenere premuto BOOT.'
Write-Host 'Verifica la comparsa di USB MIDI e della porta CDC. Per gli aggiornamenti usa la web app.'

