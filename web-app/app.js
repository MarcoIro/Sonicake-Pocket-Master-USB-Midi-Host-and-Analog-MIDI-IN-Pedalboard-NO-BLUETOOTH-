// ═══════════════════════════════════════════════════════════════════
//  ESP32-P4 MIDI Controller Web App
//  Pocket Master USB Host Configurator + Live MIDI Control
// ═══════════════════════════════════════════════════════════════════

// Module IDs & names (must match firmware MODULE_* enum order)
const MODULE_NAMES = [
    { id: 0, name: "NR",  full: "Noise Reduction" },
    { id: 1, name: "FX1", full: "Effects 1" },
    { id: 2, name: "DRV", full: "Drive/Distortion" },
    { id: 3, name: "AMP", full: "Amplifier" },
    { id: 4, name: "IR",  full: "Impulse Response" },
    { id: 5, name: "EQ",  full: "Equalizer" },
    { id: 6, name: "FX2", full: "Effects 2" },
    { id: 7, name: "DLY", full: "Delay" },
    { id: 8, name: "RVB", full: "Reverb" },
];

const MODULE_PARAMS = {
    0: [ // NR
        { alg: 0, name: "Threshold (THRE)" }
    ],
    1: [ // FX1
        { alg: 0, name: "Param 1: Depth (0-100) / Sense (Wah) / Sustain" },
        { alg: 1, name: "Param 2: Rate (0.1 - 10.0 Hz) [Modulation]" },
        { alg: 101, name: "Param 2: Range (0-100) [Touch Wah] / Vol" },
        { alg: 100, name: "Param 1: Rate (0.1 - 10.0 Hz) [Phaser]" },
        { alg: 2, name: "Param 3: Tone / Vol / Q / Attack" },
        { alg: 3, name: "Param 4: Mix / F.Back / Clip" },
        { alg: 4, name: "Param 5: Mode / Bias" },
        { alg: 5, name: "Param 6: Level / Vol" }
    ],
    2: [ // DRV
        { alg: 0, name: "Gain" },
        { alg: 1, name: "Tone" },
        { alg: 2, name: "Volume (VOL)" }
    ],
    3: [ // AMP
        { alg: 0, name: "Gain" },
        { alg: 1, name: "Tone / Gain 2" },
        { alg: 2, name: "Volume (VOL)" },
        { alg: 3, name: "Bass" },
        { alg: 4, name: "Middle" },
        { alg: 5, name: "Treble" },
        { alg: 6, name: "Presence / Master" }
    ],
    4: [ // IR
        { alg: 0, name: "Volume (VOL)" }
    ],
    5: [ // EQ
        { alg: 0, name: "Band 1 (100 Hz)" },
        { alg: 1, name: "Band 2 (250 Hz)" },
        { alg: 2, name: "Band 3 (630 Hz)" },
        { alg: 3, name: "Band 4 (1.6 kHz)" },
        { alg: 4, name: "Band 5 (4 kHz)" },
        { alg: 5, name: "Master Level" }
    ],
    6: [ // FX2
        { alg: 0, name: "Param 1: Depth (0-100) / Low (Octave)" },
        { alg: 1, name: "Param 2: Rate (0.1 - 10.0 Hz) [Modulation]" },
        { alg: 101, name: "Param 2: Wet (0-100) [Detune] / High (Octave)" },
        { alg: 100, name: "Param 1: Rate (0.1 - 10.0 Hz) [Phaser]" },
        { alg: 2, name: "Param 3: Tone / Dry / P.Delay" },
        { alg: 3, name: "Param 4: Mix / F.Back / H-Vol" },
        { alg: 4, name: "Param 5: Bias / L-Vol" },
        { alg: 5, name: "Param 6: Level / Vol" }
    ],
    7: [ // DLY
        { alg: 0, name: "Mix" },
        { alg: 1, name: "Time (20 - 1000 ms)" },
        { alg: 2, name: "Feedback (F.B)" },
        { alg: 3, name: "Tone" },
        { alg: 4, name: "Mod" }
    ],
    8: [ // RVB
        { alg: 0, name: "Mix" },
        { alg: 1, name: "Decay" },
        { alg: 2, name: "Tone" },
        { alg: 3, name: "Pre-Delay" },
        { alg: 4, name: "Mod" }
    ]
};

const EXPR_CURVES = [
    { id: 0, name: "Lineare (Normale)" },
    { id: 1, name: "Invertita (100% → 0%)" },
    { id: 2, name: "Logaritmica (Graduale)" },
    { id: 3, name: "Esponenziale (Rapida)" },
    { id: 4, name: "S-Curve (Sigmoide)" }
];

const ACTION_NAMES = {
    0: "Nessuna azione",
    1: "Toggle Module",
    2: "Select Preset",
    3: "Tap Tempo",
    4: "Switch Layer",
    5: "Preset Up",
    6: "Preset Down",
    7: "Custom SysEx",
    8: "CC personalizzato",
    9: "Scena / Patch Jump"
};
const BUTTON_MODE_NAMES = {
    0: "Toggle standard",
    1: "Momentaneo",
    2: "Toggle con hold"
};
const MAX_BUTTONS = 16;
const MAX_LAYERS = 6;
const MAX_EXPR_PEDALS = 6;

// ═══ Application State ════════════════════════════════════════════
let port = null;
let reader = null;
let writer = null;
let readPipePromise = null;
let writePipePromise = null;
let firmwareAckWaiter = null;
let activeLayer = 0;

// Live device state (synced from ESP32 status messages)
let deviceState = {
    connected: false,
    preset: 0,
    layer: 0,
    mode: 'pocket_master',
    modules: new Array(9).fill(false)
};

// ═══ Standard 5x7 ASCII font (ASCII 32 to 126) for Bit-Perfect OLED Simulation ═══
const FONT5X7 = [
    [0x00, 0x00, 0x00, 0x00, 0x00], // 32 ' '
    [0x00, 0x00, 0x5F, 0x00, 0x00], // 33 '!'
    [0x00, 0x07, 0x00, 0x07, 0x00], // 34 '"'
    [0x14, 0x7F, 0x14, 0x7F, 0x14], // 35 '#'
    [0x24, 0x2A, 0x7F, 0x2A, 0x12], // 36 '$'
    [0x23, 0x13, 0x08, 0x64, 0x62], // 37 '%'
    [0x36, 0x49, 0x55, 0x22, 0x50], // 38 '&'
    [0x00, 0x05, 0x03, 0x00, 0x00], // 39 '''
    [0x00, 0x1C, 0x22, 0x41, 0x00], // 40 '('
    [0x00, 0x41, 0x22, 0x1C, 0x00], // 41 ')'
    [0x14, 0x08, 0x3E, 0x08, 0x14], // 42 '*'
    [0x08, 0x08, 0x3E, 0x08, 0x08], // 43 '+'
    [0x00, 0x50, 0x30, 0x00, 0x00], // 44 ','
    [0x08, 0x08, 0x08, 0x08, 0x08], // 45 '-'
    [0x00, 0x60, 0x60, 0x00, 0x00], // 46 '.'
    [0x20, 0x10, 0x08, 0x04, 0x02], // 47 '/'
    [0x3E, 0x51, 0x49, 0x45, 0x3E], // 48 '0'
    [0x00, 0x42, 0x7F, 0x40, 0x00], // 49 '1'
    [0x42, 0x61, 0x51, 0x49, 0x46], // 50 '2'
    [0x21, 0x41, 0x45, 0x4B, 0x31], // 51 '3'
    [0x18, 0x14, 0x12, 0x7F, 0x10], // 52 '4'
    [0x27, 0x45, 0x45, 0x45, 0x39], // 53 '5'
    [0x3C, 0x4A, 0x49, 0x49, 0x30], // 54 '6'
    [0x01, 0x71, 0x09, 0x05, 0x03], // 55 '7'
    [0x36, 0x49, 0x49, 0x49, 0x36], // 56 '8'
    [0x06, 0x49, 0x49, 0x29, 0x1E], // 57 '9'
    [0x00, 0x36, 0x36, 0x00, 0x00], // 58 ':'
    [0x00, 0x56, 0x36, 0x00, 0x00], // 59 ';'
    [0x08, 0x14, 0x22, 0x41, 0x00], // 60 '<'
    [0x14, 0x14, 0x14, 0x14, 0x14], // 61 '='
    [0x00, 0x41, 0x22, 0x14, 0x08], // 62 '>'
    [0x02, 0x01, 0x51, 0x09, 0x06], // 63 '?'
    [0x32, 0x49, 0x79, 0x41, 0x3E], // 64 '@'
    [0x7E, 0x11, 0x11, 0x11, 0x7E], // 65 'A'
    [0x7F, 0x49, 0x49, 0x49, 0x36], // 66 'B'
    [0x3E, 0x41, 0x41, 0x41, 0x22], // 67 'C'
    [0x7F, 0x41, 0x41, 0x22, 0x1C], // 68 'D'
    [0x7F, 0x49, 0x49, 0x49, 0x41], // 69 'E'
    [0x7F, 0x09, 0x09, 0x09, 0x01], // 70 'F'
    [0x3E, 0x41, 0x49, 0x49, 0x7A], // 71 'G'
    [0x7F, 0x08, 0x08, 0x08, 0x7F], // 72 'H'
    [0x00, 0x41, 0x7F, 0x41, 0x00], // 73 'I'
    [0x20, 0x40, 0x41, 0x3F, 0x01], // 74 'J'
    [0x7F, 0x08, 0x14, 0x22, 0x41], // 75 'K'
    [0x7F, 0x40, 0x40, 0x40, 0x40], // 76 'L'
    [0x7F, 0x02, 0x0C, 0x02, 0x7F], // 77 'M'
    [0x7F, 0x04, 0x08, 0x10, 0x7F], // 78 'N'
    [0x3E, 0x41, 0x41, 0x41, 0x3E], // 79 'O'
    [0x7F, 0x09, 0x09, 0x09, 0x06], // 80 'P'
    [0x3E, 0x41, 0x51, 0x21, 0x5E], // 81 'Q'
    [0x7F, 0x09, 0x19, 0x29, 0x46], // 82 'R'
    [0x46, 0x49, 0x49, 0x49, 0x31], // 83 'S'
    [0x01, 0x01, 0x7F, 0x01, 0x01], // 84 'T'
    [0x3F, 0x40, 0x40, 0x40, 0x3F], // 85 'U'
    [0x1F, 0x20, 0x40, 0x20, 0x1F], // 86 'V'
    [0x3F, 0x40, 0x38, 0x40, 0x3F], // 87 'W'
    [0x63, 0x14, 0x08, 0x14, 0x63], // 88 'X'
    [0x07, 0x08, 0x70, 0x08, 0x07], // 89 'Y'
    [0x61, 0x51, 0x49, 0x45, 0x43], // 90 'Z'
    [0x00, 0x7F, 0x41, 0x41, 0x00], // 91 '['
    [0x02, 0x04, 0x08, 0x10, 0x20], // 92 '\'
    [0x00, 0x41, 0x41, 0x7F, 0x00], // 93 ']'
    [0x04, 0x02, 0x01, 0x02, 0x04], // 94 '^'
    [0x40, 0x40, 0x40, 0x40, 0x40], // 95 '_'
    [0x00, 0x01, 0x02, 0x04, 0x00], // 96 '`'
    [0x20, 0x54, 0x54, 0x54, 0x78], // 97 'a'
    [0x7F, 0x48, 0x44, 0x44, 0x38], // 98 'b'
    [0x38, 0x44, 0x44, 0x44, 0x20], // 99 'c'
    [0x38, 0x44, 0x44, 0x48, 0x7F], // 100 'd'
    [0x38, 0x54, 0x54, 0x54, 0x18], // 101 'e'
    [0x08, 0x7E, 0x09, 0x01, 0x02], // 102 'f'
    [0x0C, 0x52, 0x52, 0x52, 0x3E], // 103 'g'
    [0x7F, 0x08, 0x04, 0x04, 0x78], // 104 'h'
    [0x00, 0x44, 0x7D, 0x40, 0x00], // 105 'i'
    [0x20, 0x40, 0x44, 0x3D, 0x00], // 106 'j'
    [0x7F, 0x10, 0x28, 0x44, 0x00], // 107 'k'
    [0x00, 0x41, 0x7F, 0x40, 0x00], // 108 'l'
    [0x7C, 0x04, 0x18, 0x04, 0x78], // 109 'm'
    [0x7C, 0x08, 0x04, 0x04, 0x78], // 110 'n'
    [0x38, 0x44, 0x44, 0x44, 0x38], // 111 'o'
    [0x7C, 0x14, 0x14, 0x14, 0x08], // 112 'p'
    [0x08, 0x14, 0x14, 0x18, 0x7C], // 113 'q'
    [0x7C, 0x08, 0x04, 0x04, 0x08], // 114 'r'
    [0x48, 0x54, 0x54, 0x54, 0x20], // 115 's'
    [0x04, 0x3F, 0x44, 0x40, 0x20], // 116 't'
    [0x3C, 0x40, 0x40, 0x20, 0x7C], // 117 'u'
    [0x1C, 0x20, 0x40, 0x20, 0x1C], // 118 'v'
    [0x3C, 0x40, 0x30, 0x40, 0x3C], // 119 'w'
    [0x44, 0x28, 0x10, 0x28, 0x44], // 120 'x'
    [0x0C, 0x50, 0x50, 0x50, 0x3C], // 121 'y'
    [0x44, 0x64, 0x54, 0x4C, 0x44], // 122 'z'
    [0x00, 0x08, 0x36, 0x41, 0x00], // 123 '{'
    [0x00, 0x00, 0x77, 0x00, 0x00], // 124 '|'
    [0x00, 0x41, 0x36, 0x08, 0x00], // 125 '}'
    [0x10, 0x08, 0x08, 0x10, 0x08], // 126 '~'
];

const DEFAULT_DISPLAY_CONFIG = {
    patch: { x: 6, y: 4, scale: 2, enabled: true },
    layer: { x: 54, y: 4, scale: 1, enabled: true },
    usb:   { x: 104, y: 4, scale: 1, enabled: true },
    bpm:   { x: 6, y: 24, scale: 2, enabled: true },
    show_dividers: true,
    divider_y: 43,
    expr1: { x: 6, y: 47, width: 12, height: 12, style: 1, show_label: true, show_val: true, enabled: true },
    expr2: { x: 70, y: 47, width: 12, height: 12, style: 1, show_label: true, show_val: true, enabled: true },
    toast_duration_ms: 500
};

let configChunkTransfer = null;

let configData = {
    version: 7,
    hardware: { buttons: [] },
    layers: [
        { id: "layer-1", name: "Moduli", buttons: [] },
        { id: "layer-2", name: "Preset", buttons: [] }
    ],
    expression_pedals: [],
    expression_killswitch: { enabled: true, button_a: 4, button_b: 1, hold_ms: 5000 },
    mode_switch: { enabled: true, button_a: 2, button_b: 7, hold_ms: 3000 },
    usb_midi_buttons: [],
    midi_in: {
        enabled: true,
        rx_gpio: 15,
        passthrough: true,
        channel_mask: 65535,
        channel_remap: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
    },
    settings: {
        long_press_ms: 1000,
        debounce_ms: 50,
        active_layer: 0
    },
    display: JSON.parse(JSON.stringify(DEFAULT_DISPLAY_CONFIG))
};

// ═══ Default Config ═══════════════════════════════════════════════
function initDefaultConfig() {
    const defaultButtonPins = [16, 17, 18, 19, 20, 21, 22, 14, 23];
    const defaultLedPins = [27, 30, 33, 34, 26, 32, 28, null, 29];
    configData = {
        version: 7,
        hardware: {
            layer_led_gpios: [13, 12, 31],
            buttons: defaultButtonPins.map((gpio, index) => ({
                id: `button-${index + 1}`,
                gpio,
                led_gpio: defaultLedPins[index]
            }))
        },
        layers: [
            { id: "layer-1", name: "Moduli", buttons: [] },
            { id: "layer-2", name: "Preset", buttons: [] }
        ],
        expression_pedals: [],
        expression_killswitch: { enabled: true, button_a: 4, button_b: 1, hold_ms: 5000 },
        mode_switch: { enabled: true, button_a: 2, button_b: 7, hold_ms: 3000 },
        usb_midi_buttons: defaultButtonPins.map((_, index) => ({ enabled: true, action: 1, mode: index === 2 || index === 7 ? 1 : 0, channel: 0, number: index, value: 127, off_value: 0, label: `CC ${index}` })),
        midi_in: {
            enabled: true,
            rx_gpio: 15,
            passthrough: true,
            channel_mask: 65535,
            channel_remap: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
        },
        settings: { long_press_ms: 1000, debounce_ms: 50, active_layer: 0 },
        display: JSON.parse(JSON.stringify(DEFAULT_DISPLAY_CONFIG))
    };

    configData.layers[0].buttons = [
        { button_id: "button-1", enabled: true, action: 1, mode: 0, hold_ms: 1000, param1: 8, label: "REV" },
        { button_id: "button-2", enabled: true, action: 3, mode: 0, hold_ms: 1000, param1: 0, label: "TAP" },
        { button_id: "button-3", enabled: true, action: 1, mode: 0, hold_ms: 1000, param1: 1, label: "FX1" },
        { button_id: "button-4", enabled: true, action: 1, mode: 0, hold_ms: 1000, param1: 6, label: "FX2" },
        { button_id: "button-5", enabled: true, action: 1, mode: 0, hold_ms: 1000, param1: 0, label: "NR" },
        { button_id: "button-6", enabled: true, action: 1, mode: 0, hold_ms: 1000, param1: 5, label: "EQ" },
        { button_id: "button-7", enabled: true, action: 1, mode: 0, hold_ms: 1000, param1: 7, label: "DLY" },
        { button_id: "button-8", enabled: true, action: 4, mode: 0, hold_ms: 1000, param1: 0, label: "LAYER" },
        { button_id: "button-9", enabled: true, action: 1, mode: 0, hold_ms: 1000, param1: 2, label: "DRV" }
    ];
    const defaultPresets = [7, 3, 1, 5, 0, 4, 6, 0, 2];
    defaultPresets.forEach((preset, index) => {
        if (index === 7) {
            configData.layers[1].buttons.push({ button_id: "button-8", enabled: true, action: 4, mode: 0, hold_ms: 1000, param1: 0, label: "LAYER" });
        } else {
            configData.layers[1].buttons.push({ button_id: `button-${index + 1}`, enabled: true, action: 2, mode: 0, hold_ms: 1000, param1: preset, label: `P${String(preset + 1).padStart(2, '0')}` });
        }
    });
}
initDefaultConfig();

// ═══ DOM Refs ══════════════════════════════════════════════════════
const connectBtn    = document.getElementById('connectBtn');
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');
const consoleBox    = document.getElementById('consoleBox');
const buttonsGrid   = document.getElementById('buttonsGrid');
const exprGrid      = document.getElementById('exprGrid');
const layerTabs     = document.getElementById('layerTabs');
const saveBtn       = document.getElementById('saveBtn');
const readConfigBtn = document.getElementById('readConfigBtn');
const readConfigHeaderBtn = document.getElementById('readConfigHeaderBtn');
const exportBtn     = document.getElementById('exportBtn');
const importBtn     = document.getElementById('importBtn');
const fileInput     = document.getElementById('fileInput');
const modulesGrid   = document.getElementById('modulesGrid');
const pmStatus      = document.getElementById('pmStatus');
const pmPreset      = document.getElementById('pmPreset');
const pmLayer       = document.getElementById('pmLayer');
const presetSelect  = document.getElementById('presetSelect');
const sysexInput    = document.getElementById('sysexInput');
const sysexByteCount= document.getElementById('sysexByteCount');
const ccSlider      = document.getElementById('ccSlider');
const ccValue       = document.getElementById('ccValue');

// ═══ Logger ════════════════════════════════════════════════════════
function log(msg, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    consoleBox.appendChild(entry);
    if (consoleBox.children.length > 200) consoleBox.removeChild(consoleBox.firstChild);
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

// ═══ Preset Select Population ══════════════════════════════════════
function populatePresetSelect() {
    presetSelect.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `P${String(i+1).padStart(2,'0')}`;
        presetSelect.appendChild(opt);
    }
    for (let i = 50; i < 100; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `F${String(i-49).padStart(2,'0')}`;
        presetSelect.appendChild(opt);
    }
}
populatePresetSelect();

// ═══ Module Grid (Live State) ══════════════════════════════════════
function renderModulesGrid() {
    modulesGrid.innerHTML = '';
    MODULE_NAMES.forEach(mod => {
        const btn = document.createElement('button');
        btn.className = `module-btn ${deviceState.modules[mod.id] ? 'active' : ''}`;
        btn.id = `mod-btn-${mod.id}`;
        btn.title = mod.full;
        btn.innerHTML = `
            <span class="mod-name">${mod.name}</span>
            <span class="mod-state">${deviceState.modules[mod.id] ? 'ON' : 'OFF'}</span>
        `;
        btn.addEventListener('click', () => {
            const newState = !deviceState.modules[mod.id];
            sendToggleModule(mod.id, newState);
        });
        modulesGrid.appendChild(btn);
    });
}

function updateModulesGrid() {
    MODULE_NAMES.forEach(mod => {
        const btn = document.getElementById(`mod-btn-${mod.id}`);
        if (btn) {
            const on = deviceState.modules[mod.id];
            btn.className = `module-btn ${on ? 'active' : ''}`;
            btn.querySelector('.mod-state').textContent = on ? 'ON' : 'OFF';
        }
    });
}

// ═══ Button Config Cards ═══════════════════════════════════════════
function normalizeConfig() {
    configData = configData || {};
    configData.version = Math.max(Number(configData.version) || 1, 7);
    configData.layers = Array.isArray(configData.layers) ? configData.layers : [];
    configData.hardware = configData.hardware || {};
    if (!Array.isArray(configData.hardware.layer_led_gpios)) configData.hardware.layer_led_gpios = [null, null, null];
    configData.hardware.layer_led_gpios = [0, 1, 2].map(index => {
        const pin = configData.hardware.layer_led_gpios[index];
        return pin === '' || pin == null ? null : Number(pin);
    });
    configData.expression_pedals = Array.isArray(configData.expression_pedals) ? configData.expression_pedals.slice(0, MAX_EXPR_PEDALS) : [];
    configData.expression_pedals.forEach((pedal, index) => {
        pedal.id = pedal.id || `expression-${index + 1}`;
        pedal.gpio = pedal.gpio === '' || pedal.gpio == null ? null : Number(pedal.gpio);
        pedal.enabled = Boolean(pedal.enabled);
        pedal.label = pedal.label || `Pedale ${index + 1}`;
        pedal.calib_min = Number.isInteger(pedal.calib_min) ? pedal.calib_min : 50;
        pedal.calib_max = Number.isInteger(pedal.calib_max) ? pedal.calib_max : 3450;
        pedal.usb_midi = pedal.usb_midi || {};
        pedal.usb_midi.enabled = Boolean(pedal.usb_midi.enabled);
        pedal.usb_midi.channel = Math.min(15, Math.max(0, Number(pedal.usb_midi.channel) || 0));
        pedal.usb_midi.cc = Math.min(127, Math.max(0, Number(pedal.usb_midi.cc) || (11 + index)));
        pedal.usb_midi.min = Math.min(127, Math.max(0, Number(pedal.usb_midi.min) || 0));
        pedal.usb_midi.max = Math.min(127, Math.max(0, pedal.usb_midi.max == null ? 127 : Number(pedal.usb_midi.max)));

        // Target 1
        if (!pedal.target1) {
            pedal.target1 = {
                enabled: true,
                soft_takeover: false,
                module_id: Number.isInteger(pedal.module_id) ? pedal.module_id : 7,
                alg_id: Number.isInteger(pedal.alg_id) ? pedal.alg_id : 0,
                min_val: 0,
                max_val: 100,
                curve: 0
            };
        } else {
            pedal.target1.enabled = pedal.target1.enabled !== false;
            pedal.target1.soft_takeover = Boolean(pedal.target1.soft_takeover);
            pedal.target1.module_id = Number.isInteger(pedal.target1.module_id) ? pedal.target1.module_id : 0;
            pedal.target1.alg_id = Number.isInteger(pedal.target1.alg_id) ? pedal.target1.alg_id : 0;
            pedal.target1.min_val = Number.isInteger(pedal.target1.min_val) ? pedal.target1.min_val : 0;
            pedal.target1.max_val = Number.isInteger(pedal.target1.max_val) ? pedal.target1.max_val : 100;
            pedal.target1.curve = Number.isInteger(pedal.target1.curve) ? pedal.target1.curve : 0;
        }

        // Target 2
        if (!pedal.target2) {
            pedal.target2 = {
                enabled: false,
                soft_takeover: false,
                module_id: 8,
                alg_id: 0,
                min_val: 0,
                max_val: 100,
                curve: 0
            };
        } else {
            pedal.target2.enabled = Boolean(pedal.target2.enabled);
            pedal.target2.soft_takeover = Boolean(pedal.target2.soft_takeover);
            pedal.target2.module_id = Number.isInteger(pedal.target2.module_id) ? pedal.target2.module_id : 0;
            pedal.target2.alg_id = Number.isInteger(pedal.target2.alg_id) ? pedal.target2.alg_id : 0;
            pedal.target2.min_val = Number.isInteger(pedal.target2.min_val) ? pedal.target2.min_val : 0;
            pedal.target2.max_val = Number.isInteger(pedal.target2.max_val) ? pedal.target2.max_val : 100;
            pedal.target2.curve = Number.isInteger(pedal.target2.curve) ? pedal.target2.curve : 0;
        }

        // Target 3
        if (!pedal.target3) {
            pedal.target3 = {
                enabled: false,
                soft_takeover: false,
                module_id: 0,
                alg_id: 0,
                min_val: 0,
                max_val: 100,
                curve: 0
            };
        } else {
            pedal.target3.enabled = Boolean(pedal.target3.enabled);
            pedal.target3.soft_takeover = Boolean(pedal.target3.soft_takeover);
            pedal.target3.module_id = Number.isInteger(pedal.target3.module_id) ? pedal.target3.module_id : 0;
            pedal.target3.alg_id = Number.isInteger(pedal.target3.alg_id) ? pedal.target3.alg_id : 0;
            pedal.target3.min_val = Number.isInteger(pedal.target3.min_val) ? pedal.target3.min_val : 0;
            pedal.target3.max_val = Number.isInteger(pedal.target3.max_val) ? pedal.target3.max_val : 100;
            pedal.target3.curve = Number.isInteger(pedal.target3.curve) ? pedal.target3.curve : 0;
        }

        // Keep legacy fields synchronized
        pedal.module_id = pedal.target1.module_id;
        pedal.alg_id = pedal.target1.alg_id;
    });

    // Normalize Expression Patch Settings (up to 16)
    configData.expression_patch_settings = Array.isArray(configData.expression_patch_settings) ?
        configData.expression_patch_settings.slice(0, 16) : [];
    configData.expression_patch_settings.forEach((item, index) => {
        item.enabled = item.enabled !== false;
        item.pedal_index = Number.isInteger(item.pedal_index) ? item.pedal_index : 0;
        item.name = item.name || `Profilo ${index + 1}`;
        item.patches = Array.isArray(item.patches) ? item.patches.filter(p => Number.isInteger(p) && p >= 0 && p < 100) : [];

        ['target1', 'target2', 'target3'].forEach((tKey, tIdx) => {
            if (!item[tKey]) {
                item[tKey] = {
                    enabled: tIdx === 0,
                    soft_takeover: false,
                    module_id: tIdx === 0 ? 2 : (tIdx === 1 ? 7 : 8),
                    alg_id: 0,
                    min_val: 0,
                    max_val: 100,
                    curve: 0
                };
            } else {
                item[tKey].enabled = Boolean(item[tKey].enabled);
                item[tKey].soft_takeover = Boolean(item[tKey].soft_takeover);
                item[tKey].module_id = Number.isInteger(item[tKey].module_id) ? item[tKey].module_id : 0;
                item[tKey].alg_id = Number.isInteger(item[tKey].alg_id) ? item[tKey].alg_id : 0;
                item[tKey].min_val = Number.isInteger(item[tKey].min_val) ? item[tKey].min_val : 0;
                item[tKey].max_val = Number.isInteger(item[tKey].max_val) ? item[tKey].max_val : 100;
                item[tKey].curve = Number.isInteger(item[tKey].curve) ? item[tKey].curve : 0;
            }
        });
    });
    if (!configData.layers.length) configData.layers.push({ id: 'layer-1', name: 'Layer A', buttons: [] });

    // Convert configurations produced by the original fixed 8-button UI.
    if (!Array.isArray(configData.hardware.buttons)) {
        const count = Math.max(8, ...configData.layers.map(layer => Array.isArray(layer.buttons) ? layer.buttons.length : 0));
        const oldLedPins = [34, 33, 32, 26, 27, 28, 29, 30];
        configData.hardware.buttons = Array.from({ length: count }, (_, index) => ({
            id: `button-${index + 1}`,
            gpio: 16 + index,
            led_gpio: oldLedPins[index] ?? null
        }));
    }

    configData.hardware.buttons.forEach((button, index) => {
        button.id = button.id || `button-${index + 1}`;
        button.gpio = button.gpio === '' || button.gpio == null ? null : Number(button.gpio);
        button.led_gpio = button.led_gpio === '' || button.led_gpio == null ? null : Number(button.led_gpio);
    });
    const killswitch = configData.expression_killswitch = configData.expression_killswitch || {};
    killswitch.enabled = Boolean(killswitch.enabled);
    killswitch.button_a = Number.isInteger(killswitch.button_a) ? killswitch.button_a : 0;
    killswitch.button_b = Number.isInteger(killswitch.button_b) ? killswitch.button_b : 1;
    killswitch.hold_ms = Number.isInteger(killswitch.hold_ms) ? killswitch.hold_ms : 5000;
    const maxButtonIndex = Math.max(0, configData.hardware.buttons.length - 1);
    killswitch.button_a = Math.min(maxButtonIndex, Math.max(0, killswitch.button_a));
    killswitch.button_b = Math.min(maxButtonIndex, Math.max(0, killswitch.button_b));
    killswitch.hold_ms = Math.min(60000, Math.max(1000, killswitch.hold_ms));
    const modeSwitch = configData.mode_switch = configData.mode_switch || {};
    modeSwitch.enabled = configData.hardware.buttons.length >= 2 && modeSwitch.enabled !== false;
    modeSwitch.button_a = Number.isInteger(modeSwitch.button_a) ? modeSwitch.button_a : (maxButtonIndex >= 7 ? 2 : 0);
    modeSwitch.button_b = Number.isInteger(modeSwitch.button_b) ? modeSwitch.button_b : (maxButtonIndex >= 7 ? 7 : maxButtonIndex);
    modeSwitch.button_a = Math.min(maxButtonIndex, Math.max(0, modeSwitch.button_a));
    modeSwitch.button_b = Math.min(maxButtonIndex, Math.max(0, modeSwitch.button_b));
    modeSwitch.hold_ms = Math.min(60000, Math.max(1000, Number(modeSwitch.hold_ms) || 3000));
    const savedUsbMidiButtons = Array.isArray(configData.usb_midi_buttons) ? configData.usb_midi_buttons : [];
    configData.usb_midi_buttons = configData.hardware.buttons.map((_, index) => {
        const profile = savedUsbMidiButtons[index] || {
            enabled: true, action: 1,
            mode: index === modeSwitch.button_a || index === modeSwitch.button_b ? 1 : 0,
            channel: 0, number: index,
            value: 127, off_value: 0, label: `CC ${index}`
        };
        profile.enabled = profile.enabled !== false;
        profile.action = Math.min(4, Math.max(0, Number(profile.action) || 0));
        profile.mode = [0, 1, 2, 3].includes(Number(profile.mode)) ? Number(profile.mode) : 0;
        profile.hold_ms = Math.min(10000, Math.max(100, Number(profile.hold_ms) || 1000));
        profile.channel = Math.min(15, Math.max(0, Number(profile.channel) || 0));
        profile.number = Math.min(127, Math.max(0, Number(profile.number) || 0));
        profile.value = Math.min(127, Math.max(0, Number(profile.value) || 0));
        profile.off_value = Math.min(127, Math.max(0, Number(profile.off_value) || 0));
        profile.label = String(profile.label || `MIDI ${index + 1}`).slice(0, 15);
        return profile;
    });
    configData.layers.forEach((layer, layerIndex) => {
        layer.id = layer.id || `layer-${layerIndex + 1}`;
        layer.name = layer.name || `Layer ${String.fromCharCode(65 + layerIndex)}`;
        layer.buttons = Array.isArray(layer.buttons) ? layer.buttons : [];
        layer.buttons.forEach((button, index) => {
            button.button_id = button.button_id || configData.hardware.buttons[button.index ?? index]?.id;
            button.enabled = button.enabled !== false;
            button.mode = [0, 1, 2].includes(Number(button.mode)) ? Number(button.mode) : 0;
            button.hold_ms = Math.min(10000, Math.max(100, Number(button.hold_ms) || 1000));
            button.hold_bidirectional = Boolean(button.hold_bidirectional);
            button.layer_short_mask = Number.isInteger(button.layer_short_mask) ? button.layer_short_mask : (1 << configData.layers.length) - 1;
            button.layer_long_mask = Number.isInteger(button.layer_long_mask) ? button.layer_long_mask : 0;
            button.default_scene_patch = Number.isInteger(button.default_scene_patch) ? button.default_scene_patch : null;
            button.scene_mappings = Array.isArray(button.scene_mappings) ? button.scene_mappings : [];
        });
        configData.hardware.buttons.forEach((hardwareButton, index) => {
            if (!layer.buttons.some(button => button.button_id === hardwareButton.id)) {
                layer.buttons.push({ button_id: hardwareButton.id, enabled: true, action: 0, mode: 0, hold_ms: 1000, hold_bidirectional: false, param1: 0, label: `Tasto ${index + 1}`, default_scene_patch: null, scene_mappings: [] });
            }
        });
    });
    if (activeLayer >= configData.layers.length) activeLayer = configData.layers.length - 1;

    /* Normalize MIDI IN config */
    if (!configData.midi_in) {
        configData.midi_in = {
            enabled: true, rx_gpio: 15, passthrough: true,
            channel_mask: 65535,
            channel_remap: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
        };
    }
    const mi = configData.midi_in;
    mi.enabled = mi.enabled !== false;
    mi.rx_gpio = mi.rx_gpio ?? 15;
    mi.passthrough = mi.passthrough !== false;
    mi.channel_mask = mi.channel_mask ?? 65535;
    if (!Array.isArray(mi.channel_remap) || mi.channel_remap.length !== 16) {
        mi.channel_remap = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
    }

    /* Normalize OLED Display Config */
    const defDisp = DEFAULT_DISPLAY_CONFIG;
    configData.display = configData.display || {};
    configData.display.patch = Object.assign({}, defDisp.patch, configData.display.patch || {});
    configData.display.layer = Object.assign({}, defDisp.layer, configData.display.layer || {});
    configData.display.usb   = Object.assign({}, defDisp.usb, configData.display.usb || {});
    configData.display.bpm   = Object.assign({}, defDisp.bpm, configData.display.bpm || {});
    configData.display.expr1 = Object.assign({}, defDisp.expr1, configData.display.expr1 || {});
    configData.display.expr2 = Object.assign({}, defDisp.expr2, configData.display.expr2 || {});
    configData.display.show_dividers = configData.display.show_dividers !== false;
    configData.display.divider_y = Number.isInteger(configData.display.divider_y) ? configData.display.divider_y : defDisp.divider_y;
    configData.display.toast_duration_ms = Number.isInteger(configData.display.toast_duration_ms) && configData.display.toast_duration_ms > 0
        ? configData.display.toast_duration_ms
        : defDisp.toast_duration_ms;
}

function renderLayerTabs() {
    layerTabs.innerHTML = '';
    configData.layers.forEach((layer, index) => {
        const item = document.createElement('div');
        item.className = 'layer-tab-item';
        const tab = document.createElement('button');
        tab.className = `tab-btn ${index === activeLayer ? 'active' : ''}`;
        tab.dataset.layer = index;
        tab.textContent = `Layer ${String.fromCharCode(65 + index)} (${layer.name})`;
        item.appendChild(tab);
        if (configData.layers.length > 1) {
            const remove = document.createElement('button');
            remove.className = 'btn danger-btn small-btn layer-delete-btn';
            remove.type = 'button';
            remove.dataset.deleteLayer = index;
            remove.title = `Elimina ${layer.name}`;
            remove.textContent = '×';
            item.appendChild(remove);
        }
        layerTabs.appendChild(item);
    });
    document.getElementById('layerTitle').textContent = `⚙️ Programmazione Tasti — Layer ${String.fromCharCode(65 + activeLayer)} (${configData.layers[activeLayer].name})`;
}

function renderButtons() {
    normalizeConfig();
    renderLayerTabs();
    buttonsGrid.innerHTML = '';
    const layer = configData.layers[activeLayer];

    const layerLedCard = document.createElement('div');
    layerLedCard.className = 'btn-config-card';
    layerLedCard.innerHTML = `
        <div class="btn-card-header"><span>LED indicazione Layer</span><span class="badge">Opzionali</span></div>
        <p class="section-note">L1: LED 1 · L2: LED 2 · L3: LED 3 · L4: 1+2 · L5: 2+3 · L6: 1+2+3</p>
        <div class="pin-row">
            ${[0, 1, 2].map(index => `<div class="form-group"><label>GPIO LED ${index + 1}</label><input type="number" min="0" max="54" value="${configData.hardware.layer_led_gpios[index] ?? ''}" placeholder="Opzionale" onchange="updateLayerLedPin(${index}, this.value)"></div>`).join('')}
        </div>`;
    buttonsGrid.appendChild(layerLedCard);

    configData.hardware.buttons.forEach((hardwareButton, i) => {
        const btn = layer.buttons.find(button => button.button_id === hardwareButton.id);
        const card = document.createElement('div');
        card.className = 'btn-config-card';

        let paramHTML = '';
        if (btn.action === 1) {
            paramHTML = `
                <div class="form-group">
                    <label>Modulo Target</label>
                    <select onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'param1', this.value)">
                        ${MODULE_NAMES.map(m => `<option value="${m.id}" ${btn.param1 === m.id ? 'selected' : ''}>${m.name} (${m.full})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Modalità pressione</label>
                    <select onchange="updateBtnMode(${activeLayer}, '${hardwareButton.id}', this.value)">
                        ${Object.entries(BUTTON_MODE_NAMES).map(([id, name]) => `<option value="${id}" ${btn.mode == id ? 'selected' : ''}>${name}</option>`).join('')}
                    </select>
                </div>
                ${btn.mode === 2 ? `
                    <div class="form-group">
                        <label>Tempo hold (ms)</label>
                        <input type="number" min="100" max="10000" step="50" value="${btn.hold_ms || 1000}" onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'hold_ms', this.value)">
                        <small>${btn.hold_bidirectional ? 'Oltre questo tempo, al rilascio il modulo ripristina lo stato precedente (spento o acceso).' : 'Oltre questo tempo, al rilascio il modulo viene spento.'}</small>
                    </div>
                    <label class="toggle-row" style="margin-top: 6px;" title="Se spuntato, l'hold funziona anche quando il modulo è già acceso (ON -> OFF alla pressione -> riaccende al rilascio). Se non spuntato, agisce solo partendo da spento.">
                        <input type="checkbox" ${btn.hold_bidirectional ? 'checked' : ''} onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'hold_bidirectional', this.checked)">
                        Hold bidirezionale (agisce anche da acceso)
                    </label>
                ` : ''}
            `;
        } else if (btn.action === 2) {
            paramHTML = `
                <div class="form-group">
                    <label>Preset Indice (0-99)</label>
                    <input type="number" min="0" max="99" value="${btn.param1}" onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'param1', this.value)">
                </div>
            `;
        } else if (btn.action === 4) {
            const layerChoices = (maskField) => configData.layers.map((item, index) => `
                <label class="toggle-row"><input type="checkbox" ${(Number(btn[maskField] ?? (maskField === 'layer_short_mask' ? (1 << configData.layers.length) - 1 : 0)) & (1 << index)) ? 'checked' : ''} onchange="updateLayerCycleMask(${activeLayer}, '${hardwareButton.id}', '${maskField}', ${index}, this.checked)"> Layer ${String.fromCharCode(65 + index)} (${item.name})</label>
            `).join('');
            paramHTML = `<div class="expr-subpanel"><strong>Ciclo con pressione breve</strong>${layerChoices('layer_short_mask')}<strong style="display:block;margin-top:10px">Ciclo con pressione prolungata</strong>${layerChoices('layer_long_mask')}<div class="form-group" style="margin-top:10px"><label>Soglia pressione prolungata (ms)</label><input type="number" min="100" max="10000" step="50" value="${btn.hold_ms || 1000}" onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'hold_ms', this.value)"><small>Valida per questo tasto Layer Switch.</small></div><small>La pressione lunga non cambia layer se la lista è vuota.</small></div>`;
        } else if (btn.action === 7) {
            paramHTML = `
                <div class="form-group">
                    <label>SysEx Hex</label>
                    <input type="text" value="${btn.sysex_hex || ''}" placeholder="F0 ... F7" onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'sysex_hex', this.value)" style="font-family: monospace; font-size: 0.8em;">
                </div>
            `;
        } else if (btn.action === 8) {
            paramHTML = `
                <div class="pin-row">
                    <div class="form-group"><label>Canale (1–16)</label><input type="number" min="1" max="16" value="${(btn.cc_channel ?? 0) + 1}" onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'cc_channel', this.value)"></div>
                    <div class="form-group"><label>Controller (0–127)</label><input type="number" min="0" max="127" value="${btn.cc_number ?? 0}" onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'cc_number', this.value)"></div>
                </div>
                <div class="form-group"><label>Valore (0–127)</label><input type="number" min="0" max="127" value="${btn.cc_value ?? 0}" onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'cc_value', this.value)"></div>
            `;
        } else if (btn.action === 9) {
            btn.scene_mappings = Array.isArray(btn.scene_mappings) ? btn.scene_mappings : [];
            const mappingsHTML = btn.scene_mappings.map((m, mIdx) => `
                <div class="scene-map-row" style="display: flex; gap: 6px; align-items: center; margin-bottom: 6px; background: rgba(0,0,0,0.25); padding: 6px; border-radius: 4px;">
                    <div style="flex: 1;">
                        <small style="color: var(--text-muted); display: block; font-size: 0.7rem;">Se in Patch:</small>
                        <select class="input-compact" style="width: 100%; font-size: 0.8rem;" onchange="updateSceneMapping(${activeLayer}, '${hardwareButton.id}', ${mIdx}, 'from', this.value)">
                            ${Array.from({length: 100}, (_, p) => `<option value="${p}" ${m.from === p ? 'selected' : ''}>${p < 50 ? 'P' : 'F'}${String((p % 50) + 1).padStart(2, '0')} (${p})</option>`).join('')}
                        </select>
                    </div>
                    <span style="font-weight: bold; color: var(--accent); padding-top: 12px;">➔</span>
                    <div style="flex: 1;">
                        <small style="color: var(--text-muted); display: block; font-size: 0.7rem;">Salta a Scena:</small>
                        <select class="input-compact" style="width: 100%; font-size: 0.8rem;" onchange="updateSceneMapping(${activeLayer}, '${hardwareButton.id}', ${mIdx}, 'to', this.value)">
                            ${Array.from({length: 100}, (_, p) => `<option value="${p}" ${m.to === p ? 'selected' : ''}>${p < 50 ? 'P' : 'F'}${String((p % 50) + 1).padStart(2, '0')} (${p})</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn danger-btn small-btn" style="padding: 2px 6px; margin-top: 14px;" title="Rimuovi regola" onclick="removeSceneMapping(${activeLayer}, '${hardwareButton.id}', ${mIdx})">✕</button>
                </div>
            `).join('');

            paramHTML = `
                <div class="form-group">
                    <label>Modalità pressione</label>
                    <select onchange="updateBtnMode(${activeLayer}, '${hardwareButton.id}', this.value)">
                        ${Object.entries(BUTTON_MODE_NAMES).map(([id, name]) => `<option value="${id}" ${btn.mode == id ? 'selected' : ''}>${name}</option>`).join('')}
                    </select>
                </div>
                ${btn.mode === 2 ? `
                    <div class="form-group">
                        <label>Tempo hold (ms)</label>
                        <input type="number" min="100" max="10000" step="50" value="${btn.hold_ms || 1000}" onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'hold_ms', this.value)">
                        <small>Tocco breve = toggle scena; pressione prolungata oltre questo tempo = temporaneo (torna alla patch d'origine al rilascio).</small>
                    </div>
                    <label class="toggle-row" style="margin-top: 6px;">
                        <input type="checkbox" ${btn.hold_bidirectional ? 'checked' : ''} onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'hold_bidirectional', this.checked)">
                        Hold bidirezionale
                    </label>
                ` : ''}
                <div class="form-group">
                    <label>Destinazione di default (opzionale)</label>
                    <select onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'default_scene_patch', this.value === '' ? null : Number(this.value))">
                        <option value="" ${btn.default_scene_patch == null ? 'selected' : ''}>-- Nessuna (agisce solo su regole specifiche) --</option>
                        ${Array.from({length: 100}, (_, p) => `<option value="${p}" ${btn.default_scene_patch === p ? 'selected' : ''}>${p < 50 ? 'P' : 'F'}${String((p % 50) + 1).padStart(2, '0')} (${p})</option>`).join('')}
                    </select>
                    <small>Usata se la patch di partenza non ha una regola specifica nella tabella sotto.</small>
                </div>
                <div class="expr-subpanel" style="margin-top: 8px;">
                    <div class="expr-subpanel-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Regole Scena per Patch</span>
                        <button class="btn primary-btn small-btn" style="padding: 2px 6px; font-size: 0.75rem;" onclick="addSceneMapping(${activeLayer}, '${hardwareButton.id}')">+ Regola</button>
                    </div>
                    <div style="margin-top: 6px;">
                        ${mappingsHTML || '<p style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0;">Nessuna regola specifica. Clicca "+ Regola" per impostare le destinazioni per patch.</p>'}
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="btn-card-header">
                <span>Footswitch ${i + 1}</span>
                <span class="badge">${hardwareButton.gpio == null ? 'GPIO da assegnare' : `GPIO ${hardwareButton.gpio}`}</span>
            </div>
            <div class="pin-row">
                <div class="form-group">
                    <label>GPIO tasto</label>
                    <input type="number" min="0" max="54" value="${hardwareButton.gpio ?? ''}" placeholder="es. 16" onchange="updateHardwarePin('${hardwareButton.id}', 'gpio', this.value)">
                </div>
                <div class="form-group">
                    <label>GPIO LED associato</label>
                    <input type="number" min="0" max="54" value="${hardwareButton.led_gpio ?? ''}" placeholder="Opzionale" onchange="updateHardwarePin('${hardwareButton.id}', 'led_gpio', this.value)">
                </div>
            </div>
            <label class="toggle-row"><input type="checkbox" ${btn.enabled ? 'checked' : ''} onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'enabled', this.checked)"> Abilitato</label>
            <div class="form-group">
                <label>Etichetta</label>
                <input type="text" value="${btn.label || ''}" onchange="updateBtnParam(${activeLayer}, '${hardwareButton.id}', 'label', this.value)">
            </div>
            <div class="form-group">
                <label>Azione</label>
                <select onchange="updateBtnAction(${activeLayer}, '${hardwareButton.id}', this.value)">
                    ${Object.entries(ACTION_NAMES).map(([id, name]) => `<option value="${id}" ${btn.action == id ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
            </div>
            ${paramHTML}
            <div class="card-actions"><button class="btn danger-btn small-btn" onclick="removeButton('${hardwareButton.id}')">Rimuovi tasto</button></div>
        `;
        buttonsGrid.appendChild(card);
    });
    renderExpressionKillswitch();
    renderUsbMidiProfiles();
}

function renderUsbMidiProfiles() {
    const grid = document.getElementById('usbMidiProfiles');
    if (!grid) return;
    grid.innerHTML = '';
    configData.hardware.buttons.forEach((hardwareButton, index) => {
        const profile = configData.usb_midi_buttons[index];
        const card = document.createElement('div');
        card.className = 'btn-config-card';
        card.innerHTML = `
            <div class="btn-card-header"><span>Tasto ${index + 1} — ${hardwareButton.gpio == null ? 'GPIO non assegnato' : `GPIO ${hardwareButton.gpio}`}</span></div>
            <label class="toggle-row"><input type="checkbox" ${profile.enabled ? 'checked' : ''} onchange="updateUsbMidiButton(${index}, 'enabled', this.checked)"> Abilitato</label>
            <div class="form-group"><label>Azione MIDI</label><select onchange="updateUsbMidiButton(${index}, 'action', this.value)">
                <option value="0" ${profile.action === 0 ? 'selected' : ''}>Nessuna</option>
                <option value="1" ${profile.action === 1 ? 'selected' : ''}>Control Change</option>
                <option value="2" ${profile.action === 2 ? 'selected' : ''}>Program Change</option>
                <option value="3" ${profile.action === 3 ? 'selected' : ''}>Nota</option>
                <option value="4" ${profile.action === 4 ? 'selected' : ''}>Tap tempo (impulso CC)</option>
            </select></div>
            <div class="form-group"><label>Canale (1–16)</label><input type="number" min="1" max="16" value="${profile.channel + 1}" onchange="updateUsbMidiButton(${index}, 'channel', this.value)"></div>
            <div class="form-group"><label>${profile.action === 2 ? 'Programma (0–127)' : profile.action === 3 ? 'Nota (0–127)' : 'Numero CC (0–127)'}</label><input type="number" min="0" max="127" value="${profile.number}" onchange="updateUsbMidiButton(${index}, 'number', this.value)"></div>
            ${profile.action === 1 || profile.action === 3 ? `<div class="form-group"><label>Comportamento</label><select onchange="updateUsbMidiButton(${index}, 'mode', this.value)"><option value="0" ${profile.mode === 0 ? 'selected' : ''}>Momentaneo</option><option value="1" ${profile.mode === 1 ? 'selected' : ''}>Toggle</option><option value="3" ${profile.mode === 3 ? 'selected' : ''}>Toggle con hold</option><option value="2" ${profile.mode === 2 ? 'selected' : ''}>Valore singolo</option></select></div>${profile.mode === 3 ? `<div class="form-group"><label>Soglia hold (ms)</label><input type="number" min="100" max="10000" step="50" value="${profile.hold_ms || 1000}" onchange="updateUsbMidiButton(${index}, 'hold_ms', this.value)"></div>` : ''}` : ''}
            ${profile.action === 1 || profile.action === 3 || profile.action === 4 ? `<div class="pin-row"><div class="form-group"><label>${profile.action === 3 ? 'Velocity ON' : 'Valore ON'}</label><input type="number" min="0" max="127" value="${profile.value}" onchange="updateUsbMidiButton(${index}, 'value', this.value)"></div><div class="form-group"><label>${profile.action === 3 ? 'Velocity OFF' : 'Valore OFF'}</label><input type="number" min="0" max="127" value="${profile.off_value}" onchange="updateUsbMidiButton(${index}, 'off_value', this.value)"></div></div>` : ''}
            <div class="form-group"><label>Etichetta</label><input maxlength="15" value="${profile.label.replaceAll('"', '&quot;')}" onchange="updateUsbMidiButton(${index}, 'label', this.value)"></div>`;
        grid.appendChild(card);
    });
}

function updateUsbMidiButton(index, field, value) {
    const profile = configData.usb_midi_buttons[index];
    if (!profile) return;
    if (field === 'enabled') profile.enabled = Boolean(value);
    else if (field === 'label') profile.label = String(value).slice(0, 15);
    else if (field === 'channel') profile.channel = Math.min(15, Math.max(0, (parseInt(value) || 1) - 1));
    else profile[field] = Number(value);
    renderUsbMidiProfiles();
}

function renderExprPedals() {
    exprGrid.innerHTML = '';
    configData.expression_pedals.forEach((exp, i) => {
        const card = document.createElement('div');
        card.className = 'btn-config-card';

        const t1 = exp.target1 || { enabled: true, soft_takeover: false, module_id: 7, alg_id: 0, min_val: 0, max_val: 100, curve: 0 };
        const t2 = exp.target2 || { enabled: false, soft_takeover: false, module_id: 8, alg_id: 0, min_val: 0, max_val: 100, curve: 0 };
        const t3 = exp.target3 || { enabled: false, soft_takeover: false, module_id: 0, alg_id: 0, min_val: 0, max_val: 100, curve: 0 };

        const t1Params = MODULE_PARAMS[t1.module_id] || [{ alg: 0, name: "Parametro 0" }];
        const t2Params = MODULE_PARAMS[t2.module_id] || [{ alg: 0, name: "Parametro 0" }];
        const t3Params = MODULE_PARAMS[t3.module_id] || [{ alg: 0, name: "Parametro 0" }];

        card.innerHTML = `
            <div class="btn-card-header">
                <span>Pedale Espressione ${i + 1}</span>
                <span class="badge">${exp.enabled ? `ADC GPIO ${exp.gpio ?? 'da assegnare'}` : 'Disabilitato'}</span>
            </div>
            <label class="toggle-row">
                <input type="checkbox" ${exp.enabled ? 'checked' : ''} onchange="updateExprPedal(${i}, 'enabled', this.checked)"> Abilitato
            </label>
            <div class="pin-row">
                <div class="form-group">
                    <label>GPIO ADC (49–54)</label>
                    <input type="number" min="49" max="54" value="${exp.gpio ?? ''}" placeholder="es. 49" onchange="updateExprPedal(${i}, 'gpio', this.value)">
                </div>
                <div class="form-group">
                    <label>Etichetta</label>
                    <input type="text" value="${exp.label || ''}" placeholder="es. Wah / Delay Mix" onchange="updateExprPedal(${i}, 'label', this.value)">
                </div>
            </div>

            <div class="pin-row">
                <div class="form-group">
                    <label>ADC Min (Heel)</label>
                    <input type="number" min="0" max="4095" value="${exp.calib_min ?? 50}" onchange="updateExprPedal(${i}, 'calib_min', this.value)">
                </div>
                <div class="form-group">
                    <label>ADC Max (Toe)</label>
                    <input type="number" min="0" max="4095" value="${exp.calib_max ?? 3450}" onchange="updateExprPedal(${i}, 'calib_max', this.value)">
                </div>
            </div>
            <div class="expr-hint">
                ℹ️ Calibrazione: i potenziometri dei pedali espressione raggiungono ~3450 invece di 4095. Con questa calibrazione si raggiunge il 100% effettivo a fine corsa.
            </div>

            <div class="expr-subpanel">
                <div class="expr-subpanel-title"><span>Uscita USB MIDI (solo modalità MIDI)</span></div>
                <label class="toggle-row"><input type="checkbox" ${exp.usb_midi.enabled ? 'checked' : ''} onchange="updateExprPedal(${i}, 'usb_midi.enabled', this.checked)"> Invia come CC alla DAW</label>
                <div class="pin-row">
                    <div class="form-group"><label>Canale (1–16)</label><input type="number" min="1" max="16" value="${exp.usb_midi.channel + 1}" onchange="updateExprPedal(${i}, 'usb_midi.channel', this.value)"></div>
                    <div class="form-group"><label>CC (0–127)</label><input type="number" min="0" max="127" value="${exp.usb_midi.cc}" onchange="updateExprPedal(${i}, 'usb_midi.cc', this.value)"></div>
                </div>
                <div class="pin-row">
                    <div class="form-group"><label>Valore minimo</label><input type="number" min="0" max="127" value="${exp.usb_midi.min}" onchange="updateExprPedal(${i}, 'usb_midi.min', this.value)"></div>
                    <div class="form-group"><label>Valore massimo</label><input type="number" min="0" max="127" value="${exp.usb_midi.max}" onchange="updateExprPedal(${i}, 'usb_midi.max', this.value)"></div>
                </div>
            </div>

            <!-- TARGET 1: Parametro Primario -->
            <div class="expr-subpanel">
                <div class="expr-subpanel-title">
                    <span>Target 1 (Primario)</span>
                    <label class="toggle-row" style="margin: 0; font-size: 0.8rem;">
                        <input type="checkbox" ${t1.enabled ? 'checked' : ''} onchange="updateExprPedal(${i}, 'target1.enabled', this.checked)"> Attivo
                    </label>
                </div>
                <div class="form-group">
                    <label>Modulo Target</label>
                    <select onchange="updateExprPedal(${i}, 'target1.module_id', this.value)">
                        ${MODULE_NAMES.map(m => `<option value="${m.id}" ${t1.module_id === m.id ? 'selected' : ''}>${m.name} (${m.full})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Parametro Effetto</label>
                    <select onchange="updateExprPedal(${i}, 'target1.alg_id', this.value)">
                        ${t1Params.map(p => `<option value="${p.alg}" ${t1.alg_id === p.alg ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="expr-range-row">
                    <div class="form-group">
                        <label>Min (%)</label>
                        <input type="number" min="0" max="100" value="${t1.min_val ?? 0}" onchange="updateExprPedal(${i}, 'target1.min_val', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Max (%)</label>
                        <input type="number" min="0" max="100" value="${t1.max_val ?? 100}" onchange="updateExprPedal(${i}, 'target1.max_val', this.value)">
                    </div>
                </div>
                <div class="form-group">
                    <label>Curva di risposta</label>
                    <select onchange="updateExprPedal(${i}, 'target1.curve', this.value)">
                        ${EXPR_CURVES.map(c => `<option value="${c.id}" ${t1.curve === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <label class="toggle-row" title="Evita salti: il target riprende il controllo quando il pedale raggiunge il suo ultimo valore inviato.">
                    <input type="checkbox" ${t1.soft_takeover ? 'checked' : ''} onchange="updateExprPedal(${i}, 'target1.soft_takeover', this.checked)"> Soft takeover
                </label>
            </div>

            <!-- TARGET 2: Parametro Secondario (Doppio Controllo) -->
            <div class="expr-subpanel">
                <div class="expr-subpanel-title">
                    <span>Target 2 (Controllo Doppio)</span>
                    <label class="toggle-row" style="margin: 0; font-size: 0.8rem;">
                        <input type="checkbox" ${t2.enabled ? 'checked' : ''} onchange="updateExprPedal(${i}, 'target2.enabled', this.checked)"> Attivo
                    </label>
                </div>
                <div class="form-group">
                    <label>Modulo Target</label>
                    <select ${t2.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target2.module_id', this.value)">
                        ${MODULE_NAMES.map(m => `<option value="${m.id}" ${t2.module_id === m.id ? 'selected' : ''}>${m.name} (${m.full})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Parametro Effetto</label>
                    <select ${t2.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target2.alg_id', this.value)">
                        ${t2Params.map(p => `<option value="${p.alg}" ${t2.alg_id === p.alg ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="expr-range-row">
                    <div class="form-group">
                        <label>Min (%)</label>
                        <input type="number" min="0" max="100" value="${t2.min_val ?? 0}" ${t2.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target2.min_val', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Max (%)</label>
                        <input type="number" min="0" max="100" value="${t2.max_val ?? 100}" ${t2.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target2.max_val', this.value)">
                    </div>
                </div>
                <div class="form-group">
                    <label>Curva di risposta</label>
                    <select ${t2.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target2.curve', this.value)">
                        ${EXPR_CURVES.map(c => `<option value="${c.id}" ${t2.curve === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <label class="toggle-row" title="Evita salti: il target riprende il controllo quando il pedale raggiunge il suo ultimo valore inviato.">
                    <input type="checkbox" ${t2.soft_takeover ? 'checked' : ''} ${t2.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target2.soft_takeover', this.checked)"> Soft takeover
                </label>
            </div>

            <!-- TARGET 3: Parametro Terziario (Controllo Triplo) -->
            <div class="expr-subpanel">
                <div class="expr-subpanel-title">
                    <span>Target 3 (Controllo Triplo)</span>
                    <label class="toggle-row" style="margin: 0; font-size: 0.8rem;">
                        <input type="checkbox" ${t3.enabled ? 'checked' : ''} onchange="updateExprPedal(${i}, 'target3.enabled', this.checked)"> Attivo
                    </label>
                </div>
                <div class="form-group">
                    <label>Modulo Target</label>
                    <select ${t3.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target3.module_id', this.value)">
                        ${MODULE_NAMES.map(m => `<option value="${m.id}" ${t3.module_id === m.id ? 'selected' : ''}>${m.name} (${m.full})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Parametro Effetto</label>
                    <select ${t3.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target3.alg_id', this.value)">
                        ${t3Params.map(p => `<option value="${p.alg}" ${t3.alg_id === p.alg ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="expr-range-row">
                    <div class="form-group">
                        <label>Min (%)</label>
                        <input type="number" min="0" max="100" value="${t3.min_val ?? 0}" ${t3.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target3.min_val', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Max (%)</label>
                        <input type="number" min="0" max="100" value="${t3.max_val ?? 100}" ${t3.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target3.max_val', this.value)">
                    </div>
                </div>
                <div class="form-group">
                    <label>Curva di risposta</label>
                    <select ${t3.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target3.curve', this.value)">
                        ${EXPR_CURVES.map(c => `<option value="${c.id}" ${t3.curve === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <label class="toggle-row" title="Evita salti: il target riprende il controllo quando il pedale raggiunge il suo ultimo valore inviato.">
                    <input type="checkbox" ${t3.soft_takeover ? 'checked' : ''} ${t3.enabled ? '' : 'disabled'} onchange="updateExprPedal(${i}, 'target3.soft_takeover', this.checked)"> Soft takeover
                </label>
            </div>

            <div class="card-actions">
                <button class="btn danger-btn small-btn" onclick="removeExprPedal(${i})">Rimuovi pedale</button>
            </div>
        `;
        exprGrid.appendChild(card);
    });
    renderExprPatchSettings();
}

function renderExpressionKillswitch() {
    normalizeConfig();
    const panel = document.getElementById('expressionKillswitch');
    if (!panel) return;
    const ks = configData.expression_killswitch;
    const ms = configData.mode_switch;
    const modeComboConflict = [ms.button_a, ms.button_b].some(index => {
        const usb = configData.usb_midi_buttons[index];
        const usbMomentary = usb && [1, 3].includes(usb.action) && usb.mode === 0;
        const pocketMomentary = configData.layers.some(layer => {
            const button = layer.buttons.find(item => item.button_id === configData.hardware.buttons[index]?.id);
            return button && button.enabled && button.mode === 1 && [1, 9].includes(button.action);
        });
        return usbMomentary || pocketMomentary;
    });
    const options = configData.hardware.buttons.map((button, index) =>
        `<option value="${index}">Tasto ${index + 1}${button.gpio != null ? ` (GPIO ${button.gpio})` : ''}</option>`
    ).join('');
    panel.innerHTML = `
        <div class="expr-subpanel">
            <div class="expr-subpanel-title"><span>Killswitch pedali espressione</span></div>
            <p class="section-note">Tieni premuti insieme i due tasti scelti: spegne o riattiva al volo tutti i pedali espressione senza cancellarne la configurazione. I tre LED del layer lampeggiano 3 volte allo spegnimento e 5 volte alla riattivazione.</p>
            <label class="toggle-row"><input type="checkbox" ${ks.enabled ? 'checked' : ''} onchange="updateExpressionKillswitch('enabled', this.checked)"> Abilita killswitch</label>
            <div class="pin-row">
                <div class="form-group"><label>Primo tasto</label><select ${configData.hardware.buttons.length < 2 ? 'disabled' : ''} onchange="updateExpressionKillswitch('button_a', this.value)">${options.replace(`value="${ks.button_a}"`, `value="${ks.button_a}" selected`)}</select></div>
                <div class="form-group"><label>Secondo tasto</label><select ${configData.hardware.buttons.length < 2 ? 'disabled' : ''} onchange="updateExpressionKillswitch('button_b', this.value)">${options.replace(`value="${ks.button_b}"`, `value="${ks.button_b}" selected`)}</select></div>
            </div>
            <div class="form-group"><label>Tempo da tenere premuto (secondi)</label><input type="number" min="1" max="60" step="1" value="${ks.hold_ms / 1000}" onchange="updateExpressionKillswitch('hold_seconds', this.value)"></div>
            ${configData.hardware.buttons.length < 2 ? '<p class="section-note">Aggiungi almeno due tasti fisici per poter attivare il killswitch.</p>' : ''}
        </div>
        <div class="expr-subpanel">
            <div class="expr-subpanel-title"><span>Commutazione Pocket Master / MIDI</span></div>
            <p class="section-note">Tieni premuti insieme questi due tasti per il tempo indicato. La combinazione è indipendente dal killswitch; i tasti vengono trattenuti finché non si capisce se la combinazione è stata completata.</p>
            <label class="toggle-row"><input type="checkbox" ${ms.enabled ? 'checked' : ''} onchange="updateModeSwitch('enabled', this.checked)"> Abilita commutazione</label>
            <div class="pin-row">
                <div class="form-group"><label>Primo tasto</label><select onchange="updateModeSwitch('button_a', this.value)">${options.replace(`value="${ms.button_a}"`, `value="${ms.button_a}" selected`)}</select></div>
                <div class="form-group"><label>Secondo tasto</label><select onchange="updateModeSwitch('button_b', this.value)">${options.replace(`value="${ms.button_b}"`, `value="${ms.button_b}" selected`)}</select></div>
            </div>
            <div class="form-group"><label>Tempo da tenere premuto (secondi)</label><input type="number" min="1" max="60" step="1" value="${ms.hold_ms / 1000}" onchange="updateModeSwitch('hold_seconds', this.value)"></div>
            ${ms.button_a === ms.button_b ? '<p class="section-note" style="color:#f85149">Scegli due tasti diversi.</p>' : ''}
            ${ks.enabled && ((ms.button_a === ks.button_a && ms.button_b === ks.button_b) || (ms.button_a === ks.button_b && ms.button_b === ks.button_a)) ? '<p class="section-note" style="color:#f85149">La combinazione coincide con il killswitch: cambiane una.</p>' : ''}
            ${modeComboConflict ? '<p class="section-note" style="color:#f85149">I tasti della combinazione non possono avere azioni momentanee nei profili Pocket Master o MIDI: la pressione viene trattenuta per riconoscere la combo.</p>' : ''}
        </div>`;
}

function updateModeSwitch(field, value) {
    const ms = configData.mode_switch;
    if (field === 'enabled') ms.enabled = Boolean(value);
    else if (field === 'hold_seconds') ms.hold_ms = Math.min(60000, Math.max(1000, (parseInt(value) || 1) * 1000));
    else ms[field] = parseInt(value);
    if (ms.button_a === ms.button_b && configData.hardware.buttons.length > 1)
        ms.button_b = (ms.button_a + 1) % configData.hardware.buttons.length;
    renderExpressionKillswitch();
}

function sendJson(obj) {
    if (deviceState.mode === 'usb_midi' && obj?.cmd !== 'get_status') {
        log('Comandi Web app sospesi: la pedaliera è in modalità MIDI.', 'system');
        return Promise.resolve(false);
    }
    if (!writer) { log('Non connesso!', 'error'); return Promise.resolve(false); }
    const str = JSON.stringify(obj) + '\n';
    return writer.write(str).then(() => {
        log(`TX: ${str.trim()}`, 'tx');
        return true;
    });
}

function updateExpressionKillswitch(field, value) {
    const ks = configData.expression_killswitch;
    if (field === 'enabled') ks.enabled = Boolean(value);
    else if (field === 'hold_seconds') ks.hold_ms = Math.min(60000, Math.max(1000, (parseInt(value) || 1) * 1000));
    else ks[field] = parseInt(value);
    if (ks.button_a === ks.button_b) {
        const count = configData.hardware.buttons.length;
        if (count > 1) ks.button_b = (ks.button_a + 1) % count;
    }
    renderExpressionKillswitch();
}

function updateExprPedal(index, path, value) {
    const pedal = configData.expression_pedals[index];
    if (!pedal) return;

    const targetMatch = path.match(/^target([1-3])\.(.+)$/);
    if (targetMatch) {
        const targetKey = `target${targetMatch[1]}`;
        const sub = targetMatch[2];
        if (sub === 'enabled') {
            pedal[targetKey].enabled = Boolean(value);
        } else if (sub === 'soft_takeover') {
            pedal[targetKey].soft_takeover = Boolean(value);
        } else if (sub === 'module_id') {
            pedal[targetKey].module_id = parseInt(value);
            pedal[targetKey].alg_id = 0;
            if (targetKey === 'target1') {
                pedal.module_id = pedal.target1.module_id;
                pedal.alg_id = 0;
            }
        } else if (sub === 'alg_id') {
            pedal[targetKey].alg_id = parseInt(value);
            if (targetKey === 'target1') {
                pedal.alg_id = pedal.target1.alg_id;
            }
        } else if (sub === 'min_val' || sub === 'max_val') {
            pedal[targetKey][sub] = Math.min(100, Math.max(0, parseInt(value) || 0));
        } else if (sub === 'curve') {
            pedal[targetKey].curve = parseInt(value);
        }
    } else if (path === 'enabled') {
        pedal.enabled = Boolean(value);
    } else if (path === 'gpio') {
        pedal.gpio = value === '' ? null : parseInt(value);
    } else if (path === 'label') {
        pedal.label = value;
    } else if (path === 'calib_min' || path === 'calib_max') {
        pedal[path] = Math.min(4095, Math.max(0, parseInt(value) || 0));
    } else if (path.startsWith('usb_midi.')) {
        const field = path.slice('usb_midi.'.length);
        if (field === 'enabled') pedal.usb_midi.enabled = Boolean(value);
        else if (field === 'channel') pedal.usb_midi.channel = Math.min(15, Math.max(0, (parseInt(value) || 1) - 1));
        else pedal.usb_midi[field] = Math.min(127, Math.max(0, parseInt(value) || 0));
    }
    renderExprPedals();
}

function addExprPedal() {
    normalizeConfig();
    if (configData.expression_pedals.length >= MAX_EXPR_PEDALS) {
        alert(`Il firmware supporta al massimo ${MAX_EXPR_PEDALS} pedali espressione.`);
        return;
    }
    const number = configData.expression_pedals.length + 1;
    configData.expression_pedals.push({
        id: `expression-${Date.now()}`,
        gpio: null,
        enabled: false,
        label: `Pedale ${number}`,
        calib_min: 50,
        calib_max: 3450,
        usb_midi: { enabled: false, channel: 0, cc: 10 + number, min: 0, max: 127 },
        target1: {
            enabled: true,
            soft_takeover: false,
            module_id: 7,
            alg_id: 0,
            min_val: 0,
            max_val: 100,
            curve: 0
        },
        target2: {
            enabled: false,
            soft_takeover: false,
            module_id: 8,
            alg_id: 0,
            min_val: 0,
            max_val: 100,
            curve: 0
        },
        target3: {
            enabled: false,
            soft_takeover: false,
            module_id: 0,
            alg_id: 0,
            min_val: 0,
            max_val: 100,
            curve: 0
        },
        module_id: 7,
        alg_id: 0
    });
    renderExprPedals();
}

function removeExprPedal(index) {
    if (!confirm(`Rimuovere il pedale espressione ${index + 1}?`)) return;
    configData.expression_pedals.splice(index, 1);
    renderExprPedals();
}

function renderExprPatchSettings() {
    const container = document.getElementById('exprPatchSettingsContainer');
    if (!container) return;
    normalizeConfig();

    const count = configData.expression_patch_settings.length;
    let cardsHtml = '';

    if (count === 0) {
        cardsHtml = `
            <div style="background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; padding: 20px; text-align: center; color: var(--text-muted); margin-top: 12px;">
                <p style="margin: 0; font-size: 0.9rem;">Nessun profilo patch-dipendente configurato.</p>
                <p style="margin: 6px 0 0; font-size: 0.8rem;">Tutti i pedali espressione usano la loro configurazione standard su tutte le patch. Clicca <strong>+ Aggiungi Profilo Patch</strong> per creare un'impostazione dedicata.</p>
            </div>
        `;
    } else {
        cardsHtml = `
            <div class="expr-patch-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; margin-top: 12px;">
                ${configData.expression_patch_settings.map((item, idx) => {
                    const t1 = item.target1;
                    const t2 = item.target2;
                    const t3 = item.target3;
                    const t1Params = MODULE_PARAMS[t1.module_id] || [{ alg: 0, name: "Parametro 0" }];
                    const t2Params = MODULE_PARAMS[t2.module_id] || [{ alg: 0, name: "Parametro 0" }];
                    const t3Params = MODULE_PARAMS[t3.module_id] || [{ alg: 0, name: "Parametro 0" }];

                    // Current device preset
                    const curPreset = (typeof deviceState.preset === 'number' && deviceState.preset >= 0) ? deviceState.preset : 0;
                    const curLabel = curPreset < 50 ? `P${String(curPreset + 1).padStart(2, '0')}` : `F${String(curPreset - 49).padStart(2, '0')}`;

                    // Available pedals
                    const pedalOptions = configData.expression_pedals.length > 0
                        ? configData.expression_pedals.map((p, pIdx) =>
                            `<option value="${pIdx}" ${item.pedal_index === pIdx ? 'selected' : ''}>${p.label ? `${p.label} (Pedale ${pIdx + 1})` : `Pedale Espressione ${pIdx + 1}`}</option>`
                          ).join('')
                        : `<option value="0">Pedale 1</option>`;

                    // Assigned patches badges
                    const patchBadges = item.patches.map(p => `
                        <span class="patch-badge" style="display: inline-flex; align-items: center; gap: 4px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; border-radius: 4px; padding: 2px 7px; font-size: 0.75rem; font-weight: 600;">
                            ${p < 50 ? 'P' : 'F'}${String((p % 50) + 1).padStart(2, '0')} (${p})
                            <span style="cursor: pointer; font-weight: bold; margin-left: 3px; font-size: 0.85rem;" title="Rimuovi patch" onclick="removePatchFromExprSetting(${idx}, ${p})">&times;</span>
                        </span>
                    `).join('');

                    const noPatchAlert = item.patches.length === 0 ? `
                        <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 6px; padding: 7px 10px; margin-top: 8px; color: #fbbf24; font-size: 0.78rem; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1rem;">⚠️</span>
                            <span><b>Nessuna patch assegnata:</b> il pedale userà la configurazione generale finché non assegni almeno una patch. Clicca <b>"+ Assegna Patch"</b> o <b>"+ Patch Attiva"</b> sotto.</span>
                        </div>
                    ` : '';

                    return `
                    <div class="btn-config-card expr-patch-card" style="border-top: 3px solid var(--accent); background: rgba(22, 27, 34, 0.95);">
                        <div class="btn-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>🎯 Profilo ${idx + 1}</span>
                                <label class="toggle-row" style="margin: 0; font-size: 0.8rem;">
                                    <input type="checkbox" ${item.enabled ? 'checked' : ''} onchange="updateExprPatchSetting(${idx}, 'enabled', this.checked)"> Attivo
                                </label>
                            </div>
                            <span class="badge" style="font-size: 0.75rem;">${item.patches.length} patch</span>
                        </div>

                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
                            <div class="form-group">
                                <label>Nome Profilo</label>
                                <input type="text" value="${item.name || ''}" placeholder="es. Solo Lead Wah" onchange="updateExprPatchSetting(${idx}, 'name', this.value)">
                            </div>
                            <div class="form-group">
                                <label>Pedale Assegnato</label>
                                <select onchange="updateExprPatchSetting(${idx}, 'pedal_index', this.value)">
                                    ${pedalOptions}
                                </select>
                            </div>
                        </div>

                        <!-- Patch selection section -->
                        <div class="expr-subpanel" style="margin-top: 8px;">
                            <div class="expr-subpanel-title" style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Patch di Validità (Su quali preset attivare questo profilo)</span>
                            </div>
                            <div style="display: flex; gap: 6px; align-items: center; margin-top: 6px; flex-wrap: wrap;">
                                <select id="patchSelect_${idx}" class="input-compact" style="flex: 1; min-width: 140px; font-size: 0.8rem;">
                                    ${Array.from({length: 100}, (_, p) => `<option value="${p}">${p < 50 ? 'P' : 'F'}${String((p % 50) + 1).padStart(2, '0')} (${p})</option>`).join('')}
                                </select>
                                <button class="btn secondary-btn small-btn" style="padding: 3px 8px; font-size: 0.75rem;" onclick="addPatchToExprSetting(${idx}, document.getElementById('patchSelect_${idx}').value)">+ Assegna Patch</button>
                                <button class="btn secondary-btn small-btn" style="padding: 3px 8px; font-size: 0.75rem; border-color: var(--accent); color: var(--accent);" onclick="addPatchToExprSetting(${idx}, ${curPreset})">📍 + Patch Attiva (${curLabel})</button>
                            </div>
                            ${noPatchAlert}
                            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; min-height: 24px;">
                                ${patchBadges}
                            </div>
                        </div>

                        <!-- TARGET 1 -->
                        <div class="expr-subpanel" style="margin-top: 8px;">
                            <div class="expr-subpanel-title">
                                <span>Target 1 (Primario)</span>
                                <label class="toggle-row" style="margin: 0; font-size: 0.8rem;">
                                    <input type="checkbox" ${t1.enabled ? 'checked' : ''} onchange="updateExprPatchSetting(${idx}, 'target1.enabled', this.checked)"> Attivo
                                </label>
                            </div>
                            <div class="form-group">
                                <label>Modulo Target</label>
                                <select ${t1.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target1.module_id', this.value)">
                                    ${MODULE_NAMES.map(m => `<option value="${m.id}" ${t1.module_id === m.id ? 'selected' : ''}>${m.name} (${m.full})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Parametro Effetto</label>
                                <select ${t1.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target1.alg_id', this.value)">
                                    ${t1Params.map(p => `<option value="${p.alg}" ${t1.alg_id === p.alg ? 'selected' : ''}>${p.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="expr-range-row">
                                <div class="form-group">
                                    <label>Min (%)</label>
                                    <input type="number" min="0" max="100" value="${t1.min_val ?? 0}" ${t1.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target1.min_val', this.value)">
                                </div>
                                <div class="form-group">
                                    <label>Max (%)</label>
                                    <input type="number" min="0" max="100" value="${t1.max_val ?? 100}" ${t1.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target1.max_val', this.value)">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Curva di risposta</label>
                                <select ${t1.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target1.curve', this.value)">
                                    ${EXPR_CURVES.map(c => `<option value="${c.id}" ${t1.curve === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                            </div>
                            <label class="toggle-row" title="Evita salti: il target riprende il controllo quando il pedale raggiunge il suo ultimo valore inviato.">
                                <input type="checkbox" ${t1.soft_takeover ? 'checked' : ''} ${t1.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target1.soft_takeover', this.checked)"> Soft takeover
                            </label>
                        </div>

                        <!-- TARGET 2 -->
                        <div class="expr-subpanel" style="margin-top: 8px;">
                            <div class="expr-subpanel-title">
                                <span>Target 2 (Secondario)</span>
                                <label class="toggle-row" style="margin: 0; font-size: 0.8rem;">
                                    <input type="checkbox" ${t2.enabled ? 'checked' : ''} onchange="updateExprPatchSetting(${idx}, 'target2.enabled', this.checked)"> Attivo
                                </label>
                            </div>
                            <div class="form-group">
                                <label>Modulo Target</label>
                                <select ${t2.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target2.module_id', this.value)">
                                    ${MODULE_NAMES.map(m => `<option value="${m.id}" ${t2.module_id === m.id ? 'selected' : ''}>${m.name} (${m.full})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Parametro Effetto</label>
                                <select ${t2.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target2.alg_id', this.value)">
                                    ${t2Params.map(p => `<option value="${p.alg}" ${t2.alg_id === p.alg ? 'selected' : ''}>${p.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="expr-range-row">
                                <div class="form-group">
                                    <label>Min (%)</label>
                                    <input type="number" min="0" max="100" value="${t2.min_val ?? 0}" ${t2.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target2.min_val', this.value)">
                                </div>
                                <div class="form-group">
                                    <label>Max (%)</label>
                                    <input type="number" min="0" max="100" value="${t2.max_val ?? 100}" ${t2.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target2.max_val', this.value)">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Curva di risposta</label>
                                <select ${t2.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target2.curve', this.value)">
                                    ${EXPR_CURVES.map(c => `<option value="${c.id}" ${t2.curve === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                            </div>
                            <label class="toggle-row" title="Evita salti: il target riprende il controllo quando il pedale raggiunge il suo ultimo valore inviato.">
                                <input type="checkbox" ${t2.soft_takeover ? 'checked' : ''} ${t2.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target2.soft_takeover', this.checked)"> Soft takeover
                            </label>
                        </div>

                        <!-- TARGET 3 -->
                        <div class="expr-subpanel" style="margin-top: 8px;">
                            <div class="expr-subpanel-title">
                                <span>Target 3 (Terziario)</span>
                                <label class="toggle-row" style="margin: 0; font-size: 0.8rem;">
                                    <input type="checkbox" ${t3.enabled ? 'checked' : ''} onchange="updateExprPatchSetting(${idx}, 'target3.enabled', this.checked)"> Attivo
                                </label>
                            </div>
                            <div class="form-group">
                                <label>Modulo Target</label>
                                <select ${t3.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target3.module_id', this.value)">
                                    ${MODULE_NAMES.map(m => `<option value="${m.id}" ${t3.module_id === m.id ? 'selected' : ''}>${m.name} (${m.full})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Parametro Effetto</label>
                                <select ${t3.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target3.alg_id', this.value)">
                                    ${t3Params.map(p => `<option value="${p.alg}" ${t3.alg_id === p.alg ? 'selected' : ''}>${p.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="expr-range-row">
                                <div class="form-group">
                                    <label>Min (%)</label>
                                    <input type="number" min="0" max="100" value="${t3.min_val ?? 0}" ${t3.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target3.min_val', this.value)">
                                </div>
                                <div class="form-group">
                                    <label>Max (%)</label>
                                    <input type="number" min="0" max="100" value="${t3.max_val ?? 100}" ${t3.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target3.max_val', this.value)">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Curva di risposta</label>
                                <select ${t3.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target3.curve', this.value)">
                                    ${EXPR_CURVES.map(c => `<option value="${c.id}" ${t3.curve === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                            </div>
                            <label class="toggle-row" title="Evita salti: il target riprende il controllo quando il pedale raggiunge il suo ultimo valore inviato.">
                                <input type="checkbox" ${t3.soft_takeover ? 'checked' : ''} ${t3.enabled ? '' : 'disabled'} onchange="updateExprPatchSetting(${idx}, 'target3.soft_takeover', this.checked)"> Soft takeover
                            </label>
                        </div>

                        <div class="card-actions" style="margin-top: 10px;">
                            <button class="btn danger-btn small-btn" onclick="removeExprPatchSetting(${idx})">Rimuovi profilo</button>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    container.innerHTML = `
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div>
                    <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                        <span>🎯 Profili Espressione per Patch (Override)</span>
                        <span class="badge" style="font-size: 0.75rem;">${count}/16 Profili</span>
                    </h3>
                    <p class="section-note" style="margin: 4px 0 0;">
                        Assegna a uno o più pedali fino a 3 parametri controllabili su specifiche patch (0–99). Se una patch non ha un profilo assegnato, il pedale userà i suoi valori di default sopra.
                    </p>
                </div>
                <button class="btn primary-btn small-btn" ${count >= 16 ? 'disabled' : ''} onclick="addExprPatchSetting()">
                    + Aggiungi Profilo Patch
                </button>
            </div>
            ${cardsHtml}
        </div>
    `;
}

function addExprPatchSetting() {
    normalizeConfig();
    if (configData.expression_patch_settings.length >= 16) {
        alert('Il firmware supporta al massimo 16 profili espressione per patch.');
        return;
    }
    const idx = configData.expression_patch_settings.length + 1;
    const defaultPatch = (typeof deviceState.preset === 'number' && deviceState.preset >= 0) ? deviceState.preset : 0;
    configData.expression_patch_settings.push({
        enabled: true,
        pedal_index: 0,
        name: `Profilo ${idx}`,
        patches: [ defaultPatch ],
        target1: {
            enabled: true,
            soft_takeover: false,
            module_id: 2,
            alg_id: 0,
            min_val: 0,
            max_val: 100,
            curve: 0
        },
        target2: {
            enabled: false,
            soft_takeover: false,
            module_id: 7,
            alg_id: 0,
            min_val: 0,
            max_val: 100,
            curve: 0
        },
        target3: {
            enabled: false,
            soft_takeover: false,
            module_id: 8,
            alg_id: 0,
            min_val: 0,
            max_val: 100,
            curve: 0
        }
    });
    renderExprPatchSettings();
}

function removeExprPatchSetting(index) {
    const item = configData.expression_patch_settings[index];
    if (!item) return;
    if (!confirm(`Rimuovere il profilo espressione "${item.name || index + 1}"?`)) return;
    configData.expression_patch_settings.splice(index, 1);
    renderExprPatchSettings();
}

function updateExprPatchSetting(index, path, value) {
    const item = configData.expression_patch_settings[index];
    if (!item) return;

    const targetMatch = path.match(/^target([1-3])\.(.+)$/);
    if (targetMatch) {
        const targetKey = `target${targetMatch[1]}`;
        const sub = targetMatch[2];
        if (sub === 'enabled') {
            item[targetKey].enabled = Boolean(value);
        } else if (sub === 'soft_takeover') {
            item[targetKey].soft_takeover = Boolean(value);
        } else if (sub === 'module_id') {
            item[targetKey].module_id = parseInt(value);
            item[targetKey].alg_id = 0;
        } else if (sub === 'alg_id') {
            item[targetKey].alg_id = parseInt(value);
        } else if (sub === 'min_val' || sub === 'max_val') {
            item[targetKey][sub] = Math.min(100, Math.max(0, parseInt(value) || 0));
        } else if (sub === 'curve') {
            item[targetKey].curve = parseInt(value);
        }
    } else if (path === 'enabled') {
        item.enabled = Boolean(value);
    } else if (path === 'pedal_index') {
        item.pedal_index = parseInt(value);
    } else if (path === 'name') {
        item.name = value;
    }
    renderExprPatchSettings();
}

function addPatchToExprSetting(settingIndex, patchNum) {
    const item = configData.expression_patch_settings[settingIndex];
    if (!item) return;
    patchNum = parseInt(patchNum);
    if (isNaN(patchNum) || patchNum < 0 || patchNum >= 100) return;
    item.patches = Array.isArray(item.patches) ? item.patches : [];
    if (!item.patches.includes(patchNum)) {
        item.patches.push(patchNum);
        item.patches.sort((a, b) => a - b);
    }
    renderExprPatchSettings();
}

function removePatchFromExprSetting(settingIndex, patchNum) {
    const item = configData.expression_patch_settings[settingIndex];
    if (!item) return;
    patchNum = parseInt(patchNum);
    item.patches = Array.isArray(item.patches) ? item.patches.filter(p => p !== patchNum) : [];
    renderExprPatchSettings();
}

function getLayerButton(layer, buttonId) {
    return configData.layers[layer].buttons.find(button => button.button_id === buttonId);
}

function updateBtnAction(layer, buttonId, actionVal) {
    getLayerButton(layer, buttonId).action = parseInt(actionVal);
    renderButtons();
}

function updateBtnMode(layer, buttonId, modeVal) {
    getLayerButton(layer, buttonId).mode = parseInt(modeVal);
    renderButtons();
}

function updateBtnParam(layer, buttonId, field, val) {
    if (field === 'param1' || field === 'cc_number' || field === 'cc_value' || field === 'hold_ms') val = parseInt(val);
    if (field === 'cc_channel') val = Math.max(0, parseInt(val) - 1);
    getLayerButton(layer, buttonId)[field] = val;
    if (field === 'hold_bidirectional') renderButtons();
}

function updateLayerCycleMask(layer, buttonId, field, layerIndex, enabled) {
    const button = getLayerButton(layer, buttonId);
    const bit = 1 << layerIndex;
    button[field] = enabled ? ((button[field] || 0) | bit) : ((button[field] || 0) & ~bit);
}

function addSceneMapping(layer, buttonId) {
    const btn = getLayerButton(layer, buttonId);
    if (!btn) return;
    btn.scene_mappings = Array.isArray(btn.scene_mappings) ? btn.scene_mappings : [];
    if (btn.scene_mappings.length >= 16) {
        alert('Il firmware supporta al massimo 16 regole di salto scena per tasto.');
        return;
    }
    btn.scene_mappings.push({ from: 0, to: 1 });
    renderButtons();
}

function removeSceneMapping(layer, buttonId, index) {
    const btn = getLayerButton(layer, buttonId);
    if (!btn || !btn.scene_mappings) return;
    btn.scene_mappings.splice(index, 1);
    renderButtons();
}

function updateSceneMapping(layer, buttonId, index, field, value) {
    const btn = getLayerButton(layer, buttonId);
    if (!btn || !btn.scene_mappings || !btn.scene_mappings[index]) return;
    btn.scene_mappings[index][field] = parseInt(value);
    renderButtons();
}

function updateHardwarePin(buttonId, field, value) {
    const button = configData.hardware.buttons.find(item => item.id === buttonId);
    button[field] = value === '' ? null : parseInt(value);
    renderButtons();
}

function updateLayerLedPin(index, value) {
    configData.hardware.layer_led_gpios[index] = value === '' ? null : parseInt(value);
    renderButtons();
}

function addButton() {
    normalizeConfig();
    if (configData.hardware.buttons.length >= MAX_BUTTONS) {
        alert(`Il firmware supporta al massimo ${MAX_BUTTONS} tasti.`);
        return;
    }
    const number = configData.hardware.buttons.length + 1;
    const id = `button-${Date.now()}`;
    configData.hardware.buttons.push({ id, gpio: null, led_gpio: null });
    configData.layers.forEach(layer => layer.buttons.push({ button_id: id, enabled: true, action: 0, mode: 0, hold_ms: 1000, hold_bidirectional: false, param1: 0, label: `Tasto ${number}` }));
    renderButtons();
}

function removeButton(buttonId) {
    const button = configData.hardware.buttons.find(item => item.id === buttonId);
    if (!button || !confirm(`Rimuovere il tasto su GPIO ${button.gpio ?? 'non assegnato'} da tutti i layer?`)) return;
    configData.hardware.buttons = configData.hardware.buttons.filter(item => item.id !== buttonId);
    configData.layers.forEach(layer => { layer.buttons = layer.buttons.filter(item => item.button_id !== buttonId); });
    renderButtons();
}

function addLayer() {
    normalizeConfig();
    if (configData.layers.length >= MAX_LAYERS) {
        alert(`Il firmware supporta al massimo ${MAX_LAYERS} layer.`);
        return;
    }
    const layerNumber = configData.layers.length;
    const name = prompt('Nome del nuovo layer:', `Layer ${String.fromCharCode(65 + layerNumber)}`);
    if (name === null) return;
    configData.layers.push({
        id: `layer-${Date.now()}`,
        name: name.trim() || `Layer ${String.fromCharCode(65 + layerNumber)}`,
        buttons: configData.hardware.buttons.map((button, index) => ({ button_id: button.id, enabled: true, action: 0, mode: 0, hold_ms: 1000, hold_bidirectional: false, param1: 0, label: `Tasto ${index + 1}` }))
    });
    activeLayer = configData.layers.length - 1;
    renderButtons();
}

function removeLayer(index) {
    if (configData.layers.length <= 1 || index < 0 || index >= configData.layers.length) return;
    const layer = configData.layers[index];
    if (!confirm(`Eliminare il layer "${layer.name}"? L'operazione rimuove le sue assegnazioni dei tasti.`)) return;

    // Drop the deleted layer's bit and shift higher layer indexes down in all
    // per-button short and long cycle masks.
    configData.layers.forEach(item => item.buttons.forEach(button => {
        for (const field of ['layer_short_mask', 'layer_long_mask']) {
            const mask = Number(button[field] || 0);
            const lower = mask & ((1 << index) - 1);
            const upper = (mask >> (index + 1)) << index;
            button[field] = lower | upper;
        }
    }));

    configData.layers.splice(index, 1);
    // Removing the first layer means the new first two layers are no longer
    // the original defaults, so make both eligible for deletion as well.
    if (activeLayer === index) activeLayer = Math.min(index, configData.layers.length - 1);
    else if (activeLayer > index) activeLayer--;
    renderButtons();
}

// ═══ Device Status Update ══════════════════════════════════════════
function updateDeviceStatus(data) {
    const previousMode = deviceState.mode;
    deviceState.mode = data.mode === 'usb_midi' ? 'usb_midi' : 'pocket_master';
    deviceState.connected = data.connected;
    deviceState.preset    = data.preset;
    deviceState.layer     = data.layer;
    if (Array.isArray(data.modules)) {
        deviceState.modules = data.modules.slice(0, 9);
    }

    pmStatus.textContent = data.connected ? '✅ Connesso (USB Host)' : '❌ Disconnesso';
    pmStatus.className = `badge ${data.connected ? 'badge-green' : 'badge-red'}`;

    const presetNum = data.preset + 1;
    if (data.preset < 50) {
        pmPreset.textContent = `P${String(presetNum).padStart(2,'0')}`;
    } else {
        pmPreset.textContent = `F${String(data.preset - 49).padStart(2,'0')}`;
    }
    const layerName = configData.layers[data.layer]?.name || `Layer ${String.fromCharCode(65 + data.layer)}`;
    pmLayer.textContent = `${String.fromCharCode(65 + data.layer)} (${layerName})`;

    // Sync preset selector
    presetSelect.value = data.preset;

    // Update module buttons
    updateModulesGrid();

    const modeBanner = document.getElementById('modeBanner');
    if (deviceState.mode === 'usb_midi') {
        document.body.classList.add('midi-mode');
        modeBanner.hidden = false;
        modeBanner.textContent = 'Modalità USB MIDI nativa attiva. La configurazione è sospesa e il MIDI continua su FUSB. Usa la combinazione sulla pedaliera per tornare a Pocket Master.';
        statusText.textContent = 'USB MIDI nativo attivo';
        connectBtn.disabled = true;
    } else {
        document.body.classList.remove('midi-mode');
        modeBanner.hidden = true;
        connectBtn.disabled = false;
        if (!port && previousMode === 'usb_midi') {
            statusText.textContent = 'Pocket Master — riconnetti WebSerial';
            connectBtn.textContent = 'Connetti Seriale';
        } else if (port && previousMode === 'usb_midi') {
            sendJson({ cmd: 'req_state' });
        }
    }
}

// ═══ WebSerial Communication ════════════════════════════════════════
async function connectSerial() {
    if (!('serial' in navigator)) {
        alert('WebSerial non è supportato su questo browser. Usa Google Chrome o Microsoft Edge.');
        return;
    }
    if (port) {
        // Disconnect
        try {
            if (reader) { await reader.cancel(); reader = null; }
            if (writer) { await writer.close(); writer = null; }
            await port.close();
            port = null;
        } catch (e) { /* ignore */ }
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'Disconnesso (WebSerial)';
        connectBtn.textContent = 'Connetti Seriale';
        log('Connessione WebSerial chiusa.', 'system');
        return;
    }

    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });

        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connesso (ESP32-P4)';
        connectBtn.textContent = 'Disconnetti';
        log('Connessione WebSerial stabilita.', 'system');

        const textDecoder = new TextDecoderStream();
        readPipePromise = port.readable.pipeTo(textDecoder.writable);
        readPipePromise.catch(() => {});
        reader = textDecoder.readable.getReader();

        const textEncoder = new TextEncoderStream();
        writePipePromise = textEncoder.readable.pipeTo(port.writable);
        writePipePromise.catch(() => {});
        writer = textEncoder.writable.getWriter();

        readSerialLoop();
        await sendJson({ cmd: "get_status" });
        await sendJson({ cmd: "req_state" });

    } catch (err) {
        log(`Errore di connessione seriale: ${err}`, 'error');
        port = null;
    }
}

async function readSerialLoop() {
    let lineBuffer = '';
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            lineBuffer += value;
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop();
            for (const line of lines) {
                if (!line.trim()) continue;
                log(`RX: ${line.trim()}`, 'rx');
                handleReceivedLine(line.trim());
            }
        }
    } catch (err) {
        log(`Errore lettura seriale: ${err}`, 'error');
    }
}

function applyLoadedConfig(loadedData) {
    if (!loadedData || typeof loadedData !== 'object') {
        log('Errore: dati configurazione non validi', 'error');
        return;
    }
    configData = loadedData;
    normalizeConfig();
    renderButtons();
    renderExprPedals();
    renderExpressionKillswitch();
    renderMidiIn();
    populateOledInputsFromConfig();
    renderOledSimulator();
    if (readConfigBtn) {
        readConfigBtn.disabled = false;
        readConfigBtn.textContent = '📥 Leggi da ESP32-P4';
    }
    if (readConfigHeaderBtn) {
        readConfigHeaderBtn.disabled = false;
        readConfigHeaderBtn.textContent = '📥 Leggi Config';
    }
    log('✅ Configurazione caricata con successo da ESP32-P4 e sincronizzata nell\'editor!', 'system');
}

function handleReceivedLine(lineStr) {
    try {
        const msg = JSON.parse(lineStr);

        if ((msg.type === 'ota_ack' || msg.type === 'error') && firmwareAckWaiter &&
            String(msg.cmd || '').startsWith('ota_')) {
            const waiter = firmwareAckWaiter;
            firmwareAckWaiter = null;
            if (msg.type === 'error') waiter.reject(new Error(msg.reason || 'OTA failed'));
            else waiter.resolve(msg);
            return;
        }

        if (msg.type === 'config_chunk' && typeof msg.data === 'string') {
            const index = Number(msg.index);
            const total = Number(msg.total);
            if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total) return;
            if (!configChunkTransfer || configChunkTransfer.total !== total || index === 0) {
                configChunkTransfer = { total, chunks: new Array(total) };
            }
            configChunkTransfer.chunks[index] = msg.data;
            if (configChunkTransfer.chunks.filter(chunk => typeof chunk === 'string').length === total) {
                try {
                    const parsed = JSON.parse(configChunkTransfer.chunks.join(''));
                    configChunkTransfer = null;
                    applyLoadedConfig(parsed);
                } catch (error) {
                    configChunkTransfer = null;
                    log(`Configurazione ricevuta ma non valida: ${error.message}`, 'error');
                }
            }

        } else if (msg.type === 'status' && msg.data) {
            updateDeviceStatus(msg.data);
            if (typeof msg.data.preset === 'number') oledSimState.testPreset = msg.data.preset;
            if (typeof msg.data.layer === 'number') oledSimState.testLayer = msg.data.layer;
            if (typeof msg.data.connected === 'boolean') oledSimState.testUsb = msg.data.connected;
            syncOledTestControlsFromState();
            renderOledSimulator();

        } else if (msg.type === 'config' && msg.data) {
            applyLoadedConfig(msg.data);

        } else if (msg.type === 'ack') {
            log(`✅ ACK: ${msg.cmd}`, 'system');

        } else if (msg.type === 'error') {
            log(`❌ Errore [${msg.cmd}]: ${msg.reason}`, 'error');
        }
    } catch (e) {
        // Raw serial line (printf from firmware), already shown in log
    }
}

// ═══ Live MIDI Control Actions ══════════════════════════════════════

function sendToggleModule(moduleId, newState) {
    sendJson({ cmd: "toggle_module", module: moduleId, state: newState });
    // Optimistic update
    deviceState.modules[moduleId] = newState;
    updateModulesGrid();
}

function sendSelectPreset(presetIdx) {
    sendJson({ cmd: "select_preset", preset: presetIdx });
    deviceState.preset = presetIdx;
    presetSelect.value = presetIdx;
    const num = presetIdx + 1;
    pmPreset.textContent = presetIdx < 50
        ? `P${String(num).padStart(2,'0')}`
        : `F${String(presetIdx - 49).padStart(2,'0')}`;
}

function sendCC() {
    const ch  = parseInt(document.getElementById('ccChannel').value) - 1; // 1-based UI, 0-based protocol
    const num = parseInt(document.getElementById('ccNumber').value);
    const val = parseInt(ccValue.value);
    if (isNaN(ch) || isNaN(num) || isNaN(val)) { log('Valori CC non validi!', 'error'); return; }
    sendJson({ cmd: "send_cc", channel: ch, cc: num, value: val });
}

function sendRawSysex() {
    const hex = sysexInput.value.trim().toUpperCase();
    if (!hex) { log('SysEx vuoto!', 'error'); return; }
    if (!hex.startsWith('F0') || !hex.replace(/\s/g,'').endsWith('F7')) {
        log('SysEx non valido: deve iniziare con F0 e terminare con F7', 'error');
        return;
    }
    sendJson({ cmd: "send_sysex", hex: hex });
}

// ═══ SysEx byte counter ════════════════════════════════════════════
function updateSysexByteCount() {
    const hex = sysexInput.value.trim();
    if (!hex) { sysexByteCount.textContent = '0 bytes'; return; }
    const bytes = hex.split(/\s+/).filter(b => b.length > 0);
    sysexByteCount.textContent = `${bytes.length} byte${bytes.length !== 1 ? 's' : ''}`;
}

// ═══ Event Listeners ════════════════════════════════════════════════
connectBtn.addEventListener('click', connectSerial);

document.getElementById('firmwareFileInput').addEventListener('change', (event) => {
    document.getElementById('firmwareUploadBtn').disabled = !event.target.files?.length;
});
document.getElementById('firmwareUploadBtn').addEventListener('click', uploadFirmware);

async function sendOtaCommand(command, timeoutMs = 15000) {
    if (firmwareAckWaiter) throw new Error('È già in corso una richiesta firmware.');
    const response = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            if (firmwareAckWaiter) firmwareAckWaiter = null;
            reject(new Error(`Timeout durante ${command.cmd}`));
        }, timeoutMs);
        firmwareAckWaiter = {
            resolve: (value) => { clearTimeout(timeout); resolve(value); },
            reject: (error) => { clearTimeout(timeout); reject(error); }
        };
    });
    if (!await sendJson(command)) {
        firmwareAckWaiter?.reject(new Error('Porta CDC non disponibile.'));
        throw new Error('Porta CDC non disponibile.');
    }
    return response;
}

async function uploadFirmware() {
    const input = document.getElementById('firmwareFileInput');
    const button = document.getElementById('firmwareUploadBtn');
    const status = document.getElementById('firmwareUploadStatus');
    const file = input.files?.[0];
    if (!file || !writer || deviceState.mode === 'usb_midi') {
        log('Collega la pedaliera via USB e torna in modalità Pocket Master.', 'error');
        return;
    }
    if (!confirm(`Installare ${file.name} (${file.size} byte) e riavviare la pedaliera?`)) return;

    button.disabled = true;
    input.disabled = true;
    status.textContent = 'Avvio aggiornamento…';
    let started = false;
    try {
        await sendOtaCommand({ cmd: 'ota_start', size: file.size });
        started = true;
        const image = new Uint8Array(await file.arrayBuffer());
        const chunkSize = 300;
        for (let offset = 0; offset < image.length; offset += chunkSize) {
            const chunk = image.subarray(offset, Math.min(offset + chunkSize, image.length));
            let binary = '';
            for (let i = 0; i < chunk.length; i++) binary += String.fromCharCode(chunk[i]);
            await sendOtaCommand({ cmd: 'ota_chunk', data: btoa(binary) });
            status.textContent = `Trasferimento ${Math.min(offset + chunk.length, image.length)} / ${image.length} byte`;
        }
        await sendOtaCommand({ cmd: 'ota_finish' });
        status.textContent = 'Firmware installato. La pedaliera si sta riavviando…';
    } catch (error) {
        status.textContent = `Aggiornamento non riuscito: ${error.message}`;
        log(status.textContent, 'error');
        if (started && writer) await sendJson({ cmd: 'ota_abort' });
        button.disabled = false;
        input.disabled = false;
    }
}

layerTabs.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-delete-layer]');
    if (remove) {
        removeLayer(parseInt(remove.dataset.deleteLayer, 10));
        return;
    }
    const tab = event.target.closest('[data-layer]');
    if (!tab) return;
    activeLayer = parseInt(tab.dataset.layer);
    renderButtons();
});
document.getElementById('addButtonBtn').addEventListener('click', addButton);
document.getElementById('addLayerBtn').addEventListener('click', addLayer);
document.getElementById('addExprBtn').addEventListener('click', addExprPedal);

async function requestConfigFromDevice() {
    if (!writer) {
        alert('Non connesso via WebSerial! Fai clic prima su "Connetti Seriale" per collegarti all\'ESP32-P4.');
        log('Impossibile leggere la configurazione: porta seriale non connessa.', 'error');
        return;
    }
    log('📥 Richiesta configurazione memorizzata su ESP32-P4...', 'system');
    sendJson({ cmd: "get_config" });
    if (readConfigBtn) {
        readConfigBtn.disabled = true;
        readConfigBtn.textContent = '⏳ Lettura...';
    }
    if (readConfigHeaderBtn) {
        readConfigHeaderBtn.disabled = true;
        readConfigHeaderBtn.textContent = '⏳ Lettura...';
    }
    setTimeout(() => {
        if (readConfigBtn) {
            readConfigBtn.disabled = false;
            readConfigBtn.textContent = '📥 Leggi da ESP32-P4';
        }
        if (readConfigHeaderBtn) {
            readConfigHeaderBtn.disabled = false;
            readConfigHeaderBtn.textContent = '📥 Leggi Config';
        }
    }, 1200);
}

if (readConfigBtn) readConfigBtn.addEventListener('click', requestConfigFromDevice);
if (readConfigHeaderBtn) readConfigHeaderBtn.addEventListener('click', requestConfigFromDevice);

saveBtn.addEventListener('click', () => {
    const usbPins = [24, 25];
    const assignedPins = [
        ...configData.hardware.buttons.flatMap(button => [button.gpio, button.led_gpio]),
        ...configData.hardware.layer_led_gpios,
        configData.midi_in?.rx_gpio
    ].map(pin => pin === '' || pin == null ? null : Number(pin));
    const conflictingPin = assignedPins.find(pin => usbPins.includes(pin));
    if (conflictingPin !== undefined) {
        alert(`GPIO ${conflictingPin} è riservato alla porta USB FUSB. Scegli un altro GPIO prima di salvare.`);
        return;
    }
    sendJson({ cmd: "set_config", data: configData });
});

exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pedalboard_config.json'; a.click();
    URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = (event) => {
        try {
            configData = JSON.parse(event.target.result);
            normalizeConfig();
            renderButtons();
            renderExprPedals();
            renderExpressionKillswitch();
            renderMidiIn();
            populateOledInputsFromConfig();
            renderOledSimulator();
            log('Configurazione importata da file JSON locale.', 'system');
        } catch (err) { alert('File JSON non valido!'); }
    };
    fr.readAsText(file);
});

document.getElementById('clearLogBtn').addEventListener('click', () => consoleBox.innerHTML = '');

// Preset navigation
document.getElementById('presetDownBtn').addEventListener('click', () => {
    const cur = parseInt(presetSelect.value) || 0;
    if (cur > 0) sendSelectPreset(cur - 1);
});
document.getElementById('presetUpBtn').addEventListener('click', () => {
    const cur = parseInt(presetSelect.value) || 0;
    if (cur < 99) sendSelectPreset(cur + 1);
});
document.getElementById('sendPresetBtn').addEventListener('click', () => {
    sendSelectPreset(parseInt(presetSelect.value));
});

// CC
document.getElementById('sendCCBtn').addEventListener('click', sendCC);
ccSlider.addEventListener('input', () => { ccValue.value = ccSlider.value; });
ccValue.addEventListener('input', () => { ccSlider.value = ccValue.value; });

// CC preset chips
document.querySelectorAll('.chip-btn[data-cc]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('ccNumber').value = btn.dataset.cc;
        ccValue.value = btn.dataset.val;
        ccSlider.value = btn.dataset.val;
        sendCC();
    });
});

// SysEx
document.getElementById('sendSysexBtn').addEventListener('click', sendRawSysex);
sysexInput.addEventListener('input', updateSysexByteCount);

// SysEx preset chips
document.querySelectorAll('.sysex-chip').forEach(btn => {
    btn.addEventListener('click', () => {
        sysexInput.value = btn.dataset.sysex;
        updateSysexByteCount();
    });
});

// Re-sync state button
document.getElementById('reqStateBtn').addEventListener('click', () => {
    sendJson({ cmd: "req_state" });
    log('Richiesta sincronizzazione stato al Pocket Master...', 'system');
});

// Load defaults
document.getElementById('loadDefaultsBtn').addEventListener('click', () => {
    if (confirm('Ripristinare la configurazione di default? Le modifiche non salvate andranno perse.')) {
        initDefaultConfig();
        renderButtons();
        renderExprPedals();
        renderExpressionKillswitch();
        renderMidiIn();
        populateOledInputsFromConfig();
        renderOledSimulator();
        log('Configurazione di default ripristinata.', 'system');
    }
});

// ═══ MIDI IN Configuration ═════════════════════════════════════════
const midiInEnabled   = document.getElementById('midiInEnabled');
const midiInMode      = document.getElementById('midiInMode');
const midiInChannelGrid = document.getElementById('midiInChannelGrid');
const midiInRemapGrid   = document.getElementById('midiInRemapGrid');
const midiInFilterSection = document.getElementById('midiInFilterSection');

function renderMidiIn() {
    normalizeConfig();
    const mi = configData.midi_in;

    midiInEnabled.checked = mi.enabled;
    midiInMode.value = mi.passthrough ? 'passthrough' : 'filtered';
    midiInFilterSection.style.display = mi.passthrough ? 'none' : 'block';

    renderMidiInChannels();
    renderMidiInRemap();
}

function renderMidiInChannels() {
    const mi = configData.midi_in;
    midiInChannelGrid.innerHTML = '';
    for (let ch = 0; ch < 16; ch++) {
        const isOn = (mi.channel_mask & (1 << ch)) !== 0;
        const chip = document.createElement('label');
        chip.className = `channel-chip ${isOn ? 'active' : ''}`;
        chip.innerHTML = `
            <input type="checkbox" ${isOn ? 'checked' : ''} data-ch="${ch}">
            <span>CH ${ch + 1}</span>
        `;
        chip.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                configData.midi_in.channel_mask |= (1 << ch);
            } else {
                configData.midi_in.channel_mask &= ~(1 << ch);
            }
            renderMidiInChannels();
            renderMidiInRemap();
        });
        midiInChannelGrid.appendChild(chip);
    }
}

function renderMidiInRemap() {
    const mi = configData.midi_in;
    midiInRemapGrid.innerHTML = '';

    for (let ch = 0; ch < 16; ch++) {
        /* In passthrough mode show all; in filtered mode show only enabled */
        if (!mi.passthrough && !(mi.channel_mask & (1 << ch))) continue;

        const card = document.createElement('div');
        card.className = 'remap-card';

        let optionsHTML = '';
        for (let dst = 0; dst < 16; dst++) {
            optionsHTML += `<option value="${dst}" ${mi.channel_remap[ch] === dst ? 'selected' : ''}>CH ${dst + 1}</option>`;
        }

        card.innerHTML = `
            <span class="remap-label">CH ${ch + 1}</span>
            <span class="remap-arrow">→</span>
            <select data-src="${ch}">${optionsHTML}</select>
        `;
        card.querySelector('select').addEventListener('change', (e) => {
            configData.midi_in.channel_remap[ch] = parseInt(e.target.value);
        });
        midiInRemapGrid.appendChild(card);
    }
}

midiInEnabled.addEventListener('change', () => {
    configData.midi_in.enabled = midiInEnabled.checked;
});

midiInMode.addEventListener('change', () => {
    const passthrough = midiInMode.value === 'passthrough';
    configData.midi_in.passthrough = passthrough;
    midiInFilterSection.style.display = passthrough ? 'none' : 'block';
    renderMidiInRemap();
});

// ═══ OLED Simulator & Screen Layout Engine ═════════════════════════
const oledBuffer = new Uint8Array(128 * 64);

let oledSimState = {
    testExpr1: 65,
    testExpr2: 30,
    testBpm: 120,
    testPreset: 0,
    testLayer: 0,
    testUsb: true,
    theme: 'cyan',
    selectedElem: null,
    lastTapTime: 0,
    toastActive: false,
    toastTimer: null,
    toastLine1: '',
    toastLine2: ''
};

function oledClear() {
    oledBuffer.fill(0);
}

function oledSetPixel(x, y, on) {
    if (x >= 0 && x < 128 && y >= 0 && y < 64) {
        oledBuffer[y * 128 + x] = on ? 1 : 0;
    }
}

function oledDrawHLine(x, y, w, on) {
    for (let i = 0; i < w; i++) oledSetPixel(x + i, y, on);
}

function oledDrawRect(x, y, w, h, filled, on) {
    if (filled) {
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) oledSetPixel(x + c, y + r, on);
        }
    } else {
        for (let c = 0; c < w; c++) {
            oledSetPixel(x + c, y, on);
            oledSetPixel(x + c, y + h - 1, on);
        }
        for (let r = 0; r < h; r++) {
            oledSetPixel(x, y + r, on);
            oledSetPixel(x + w - 1, y + r, on);
        }
    }
}

function oledDrawChar(x, y, char, scale = 1, invert = false) {
    const code = char.charCodeAt(0);
    const glyph = (code >= 32 && code <= 126) ? FONT5X7[code - 32] : FONT5X7[0];
    for (let col = 0; col < 5; col++) {
        const line = glyph[col];
        for (let row = 0; row < 7; row++) {
            let pixel = (line & (1 << row)) !== 0;
            if (invert) pixel = !pixel;
            if (scale === 1) {
                oledSetPixel(x + col, y + row, pixel);
            } else {
                for (let sy = 0; sy < scale; sy++) {
                    for (let sx = 0; sx < scale; sx++) {
                        oledSetPixel(x + col * scale + sx, y + row * scale + sy, pixel);
                    }
                }
            }
        }
    }
    for (let row = 0; row < 7 * scale; row++) {
        for (let sx = 0; sx < scale; sx++) {
            oledSetPixel(x + 5 * scale + sx, y + row, invert);
        }
    }
}

function oledDrawString(x, y, str, scale = 1, invert = false) {
    let curX = x;
    for (let i = 0; i < str.length; i++) {
        oledDrawChar(curX, y, str[i], scale, invert);
        curX += 6 * scale;
    }
}

function oledDrawCircle(xc, yc, r, on) {
    let x = 0, y = r, d = 3 - 2 * r;
    while (y >= x) {
        oledSetPixel(xc + x, yc + y, on);
        oledSetPixel(xc - x, yc + y, on);
        oledSetPixel(xc + x, yc - y, on);
        oledSetPixel(xc - x, yc - y, on);
        oledSetPixel(xc + y, yc + x, on);
        oledSetPixel(xc - y, yc + x, on);
        oledSetPixel(xc + y, yc - x, on);
        oledSetPixel(xc - y, yc - x, on);
        if (d <= 0) {
            d = d + 4 * x + 6;
        } else {
            d = d + 4 * (x - y) + 10;
            y--;
        }
        x++;
    }
}

function oledDrawExprDial(xc, yc, r, val) {
    oledDrawCircle(xc, yc, r, true);
    if (val === 0) {
        oledSetPixel(xc, yc, true);
        return;
    }
    const maxAngle = (val / 100) * 2 * Math.PI;
    const rInner = r - 1;
    for (let dy = -rInner; dy <= rInner; dy++) {
        for (let dx = -rInner; dx <= rInner; dx++) {
            if (dx * dx + dy * dy <= rInner * rInner) {
                let a = Math.atan2(dx, -dy);
                if (a < 0) a += 2 * Math.PI;
                if (a <= maxAngle) {
                    oledSetPixel(xc + dx, yc + dy, true);
                }
            }
        }
    }
}

function oledDrawExprBar(x, y, w, h, val) {
    if (w < 6 || h < 4) return;
    oledDrawRect(x, y, w, h, false, true);
    const innerW = w - 4;
    const innerH = h - 4;
    const fillW = Math.floor((innerW * val) / 100);
    if (fillW > 0) {
        oledDrawRect(x + 2, y + 2, fillW, innerH, true, true);
    }
}

function oledDrawExprVBar(x, y, w, h, val) {
    if (w < 4 || h < 6) return;
    oledDrawRect(x, y, w, h, false, true);
    const innerW = w - 4;
    const innerH = h - 4;
    const fillH = Math.floor((innerH * val) / 100);
    if (fillH > 0) {
        oledDrawRect(x + 2, y + h - 2 - fillH, innerW, fillH, true, true);
    }
}

function oledRenderExprElement(cfg, label, val) {
    if (!cfg || !cfg.enabled) return;
    const valStr = `${val}%`;
    const style = Number(cfg.style);

    if (style === 1) { // 1 = Rotella / Circular Dial
        const r = cfg.width > 0 ? Math.floor(cfg.width / 2) : 6;
        const clampedR = Math.max(4, Math.min(20, r));
        const xc = cfg.x + clampedR;
        const yc = cfg.y + clampedR;
        oledDrawExprDial(xc, yc, clampedR, val);

        const textX = cfg.x + (2 * clampedR) + 4;
        if (cfg.show_label && cfg.show_val) {
            oledDrawString(textX, cfg.y + clampedR - 3, label, 1, false);
            oledDrawString(textX + 14, cfg.y + clampedR - 3, valStr, 1, false);
        } else if (cfg.show_label) {
            oledDrawString(textX, cfg.y + clampedR - 3, label, 1, false);
        } else if (cfg.show_val) {
            oledDrawString(textX, cfg.y + clampedR - 3, valStr, 1, false);
        }
    } else if (style === 2) { // 2 = Vertical Bar
        const w = cfg.width > 0 ? cfg.width : 8;
        const h = cfg.height > 0 ? cfg.height : 22;
        let curY = cfg.y;
        if (cfg.show_label) {
            oledDrawString(cfg.x, curY, label, 1, false);
            curY += 9;
        }
        oledDrawExprVBar(cfg.x, curY, w, h, val);
        if (cfg.show_val) {
            oledDrawString(cfg.x + w + 2, curY + Math.floor(h / 2) - 3, valStr, 1, false);
        }
    } else { // 0 = Horizontal Bar
        const w = cfg.width > 0 ? cfg.width : 34;
        const h = cfg.height > 0 ? cfg.height : 8;
        let curX = cfg.x;
        if (cfg.show_label) {
            oledDrawString(curX, cfg.y + Math.floor(h / 2) - 3, label, 1, false);
            curX += 14;
        }
        oledDrawExprBar(curX, cfg.y, w, h, val);
        if (cfg.show_val) {
            oledDrawString(curX + w + 3, cfg.y + Math.floor(h / 2) - 3, valStr, 1, false);
        }
    }
}

function oledDrawStringCentered(y, str, scale = 1, invert = false) {
    const totalW = str.length * 6 * scale;
    const x = Math.max(0, Math.floor((128 - totalW) / 2));
    oledDrawString(x, y, str, scale, invert);
}

function oledRenderToast(line1, line2) {
    oledDrawRect(4, 6, 120, 52, false, true);
    oledDrawRect(6, 8, 116, 48, false, true);

    if (line1 && line1.length > 0) {
        if (line1.length <= 10) {
            oledDrawStringCentered(14, line1, 2, false);
        } else {
            oledDrawStringCentered(18, line1, 1, false);
        }
    }

    if (line2 && line2.length > 0) {
        oledDrawHLine(16, 38, 96, true);
        oledDrawStringCentered(44, line2, 1, false);
    }
}

function triggerSimulatedToast(line1 = "DRV ON", line2 = "Module Drive") {
    if (oledSimState.toastTimer) {
        clearTimeout(oledSimState.toastTimer);
        oledSimState.toastTimer = null;
    }
    oledSimState.toastActive = true;
    oledSimState.toastLine1 = line1;
    oledSimState.toastLine2 = line2;
    renderOledSimulator();

    const dur = (configData.display && configData.display.toast_duration_ms > 0)
        ? configData.display.toast_duration_ms
        : (DEFAULT_DISPLAY_CONFIG.toast_duration_ms || 500);

    oledSimState.toastTimer = setTimeout(() => {
        oledSimState.toastActive = false;
        oledSimState.toastTimer = null;
        renderOledSimulator();
    }, dur);
}

function renderOledSimulator() {
    const canvas = document.getElementById('oledCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    oledClear();

    if (oledSimState.toastActive) {
        oledRenderToast(oledSimState.toastLine1, oledSimState.toastLine2);
    } else {
        const disp = configData.display || DEFAULT_DISPLAY_CONFIG;

        // 1. Strings
        const presetIdx = oledSimState.testPreset;
        const patchStr = (presetIdx < 50 ? 'P' : 'F') + String((presetIdx % 50) + 1).padStart(2, '0');
        const layerStr = `LAYER ${String.fromCharCode(65 + oledSimState.testLayer)}`;
        const bpmStr = `${oledSimState.testBpm} BPM`;

        // 2. Elements
        if (disp.patch?.enabled) {
            oledDrawString(disp.patch.x, disp.patch.y, patchStr, disp.patch.scale || 1, false);
        }
        if (disp.layer?.enabled) {
            oledDrawString(disp.layer.x, disp.layer.y, layerStr, disp.layer.scale || 1, false);
        }
        if (disp.usb?.enabled) {
            oledDrawString(disp.usb.x, disp.usb.y, "USB", disp.usb.scale || 1, true);
        }
        if (disp.bpm?.enabled) {
            oledDrawString(disp.bpm.x, disp.bpm.y, bpmStr, disp.bpm.scale || 1, false);
        }
        if (disp.show_dividers && disp.divider_y >= 0 && disp.divider_y < 64) {
            oledDrawHLine(2, disp.divider_y, 124, true);
        }

        oledRenderExprElement(disp.expr1, "E1", oledSimState.testExpr1);
        oledRenderExprElement(disp.expr2, "E2", oledSimState.testExpr2);
    }

    // 3. Render into canvas ImageData
    const imgData = ctx.createImageData(128, 64);
    const data = imgData.data;

    let onColor = [0, 243, 255]; // Cyan default
    let offColor = [5, 9, 15];
    if (oledSimState.theme === 'white') {
        onColor = [224, 247, 250];
        offColor = [5, 9, 15];
    } else if (oledSimState.theme === 'amber') {
        onColor = [255, 179, 0];
        offColor = [14, 9, 3];
    }

    for (let i = 0; i < 128 * 64; i++) {
        const on = oledBuffer[i] === 1;
        const offset = i * 4;
        if (on) {
            data[offset] = onColor[0];
            data[offset + 1] = onColor[1];
            data[offset + 2] = onColor[2];
            data[offset + 3] = 255;
        } else {
            data[offset] = offColor[0];
            data[offset + 1] = offColor[1];
            data[offset + 2] = offColor[2];
            data[offset + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);

    // 4. Subtle selection highlight
    if (oledSimState.selectedElem) {
        const box = getElementBoundingBox(oledSimState.selectedElem);
        if (box) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(box.x - 1, box.y - 1, box.w + 2, box.h + 2);
            ctx.setLineDash([]);
        }
    }
}

function getElementBoundingBox(key) {
    const disp = configData.display || DEFAULT_DISPLAY_CONFIG;
    if (!disp[key]) return null;
    const elem = disp[key];
    if (elem.enabled === false) return null;

    if (key === 'patch') {
        const s = elem.scale || 1;
        return { x: elem.x, y: elem.y, w: 3 * 6 * s, h: 8 * s };
    }
    if (key === 'bpm') {
        const s = elem.scale || 1;
        const text = `${oledSimState.testBpm} BPM`;
        return { x: elem.x, y: elem.y, w: text.length * 6 * s, h: 8 * s };
    }
    if (key === 'layer') {
        const s = elem.scale || 1;
        return { x: elem.x, y: elem.y, w: 7 * 6 * s, h: 8 * s };
    }
    if (key === 'usb') {
        const s = elem.scale || 1;
        return { x: elem.x, y: elem.y, w: 3 * 6 * s, h: 8 * s };
    }
    if (key === 'expr1' || key === 'expr2') {
        const style = Number(elem.style);
        if (style === 1) { // dial
            const r = elem.width > 0 ? Math.floor(elem.width / 2) : 6;
            const textExtra = (elem.show_label ? 14 : 0) + (elem.show_val ? 24 : 0);
            return { x: elem.x, y: elem.y, w: 2 * r + textExtra, h: 2 * r };
        } else if (style === 2) { // vertical bar
            const w = elem.width > 0 ? elem.width : 8;
            const h = elem.height > 0 ? elem.height : 22;
            const labelExtra = elem.show_label ? 9 : 0;
            const valExtra = elem.show_val ? 20 : 0;
            return { x: elem.x, y: elem.y, w: w + valExtra, h: h + labelExtra };
        } else { // horizontal bar
            const w = elem.width > 0 ? elem.width : 34;
            const h = elem.height > 0 ? elem.height : 8;
            const labelExtra = elem.show_label ? 14 : 0;
            const valExtra = elem.show_val ? 24 : 0;
            return { x: elem.x, y: elem.y, w: w + labelExtra + valExtra, h: Math.max(h, 8) };
        }
    }
    return null;
}

function highlightOledElemCard(key) {
    document.querySelectorAll('.oled-elem-card').forEach(card => {
        if (key && card.dataset.elem === key) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

function populateOledInputsFromConfig() {
    const disp = configData.display || DEFAULT_DISPLAY_CONFIG;

    // Patch
    const pEn = document.getElementById('dispPatchEn');
    const pX = document.getElementById('dispPatchX');
    const pY = document.getElementById('dispPatchY');
    const pSc = document.getElementById('dispPatchScale');
    if (pEn) pEn.checked = disp.patch.enabled !== false;
    if (pX) pX.value = disp.patch.x ?? 6;
    if (pY) pY.value = disp.patch.y ?? 4;
    if (pSc) pSc.value = disp.patch.scale ?? 2;

    // BPM
    const bEn = document.getElementById('dispBpmEn');
    const bX = document.getElementById('dispBpmX');
    const bY = document.getElementById('dispBpmY');
    const bSc = document.getElementById('dispBpmScale');
    if (bEn) bEn.checked = disp.bpm.enabled !== false;
    if (bX) bX.value = disp.bpm.x ?? 6;
    if (bY) bY.value = disp.bpm.y ?? 24;
    if (bSc) bSc.value = disp.bpm.scale ?? 2;

    // Layer
    const lEn = document.getElementById('dispLayerEn');
    const lX = document.getElementById('dispLayerX');
    const lY = document.getElementById('dispLayerY');
    const lSc = document.getElementById('dispLayerScale');
    if (lEn) lEn.checked = disp.layer.enabled !== false;
    if (lX) lX.value = disp.layer.x ?? 54;
    if (lY) lY.value = disp.layer.y ?? 4;
    if (lSc) lSc.value = disp.layer.scale ?? 1;

    // USB
    const uEn = document.getElementById('dispUsbEn');
    const uX = document.getElementById('dispUsbX');
    const uY = document.getElementById('dispUsbY');
    const uSc = document.getElementById('dispUsbScale');
    if (uEn) uEn.checked = disp.usb.enabled !== false;
    if (uX) uX.value = disp.usb.x ?? 104;
    if (uY) uY.value = disp.usb.y ?? 4;
    if (uSc) uSc.value = disp.usb.scale ?? 1;

    // Div
    const dEn = document.getElementById('dispDivEn');
    const dY = document.getElementById('dispDivY');
    if (dEn) dEn.checked = disp.show_dividers !== false;
    if (dY) dY.value = disp.divider_y ?? 43;

    // Expr 1
    const e1En = document.getElementById('dispExpr1En');
    const e1St = document.getElementById('dispExpr1Style');
    const e1X = document.getElementById('dispExpr1X');
    const e1Y = document.getElementById('dispExpr1Y');
    const e1W = document.getElementById('dispExpr1W');
    const e1H = document.getElementById('dispExpr1H');
    const e1Lbl = document.getElementById('dispExpr1Label');
    const e1Val = document.getElementById('dispExpr1Val');
    if (e1En) e1En.checked = disp.expr1.enabled !== false;
    if (e1St) e1St.value = disp.expr1.style ?? 1;
    if (e1X) e1X.value = disp.expr1.x ?? 6;
    if (e1Y) e1Y.value = disp.expr1.y ?? 47;
    if (e1W) e1W.value = disp.expr1.width ?? 12;
    if (e1H) e1H.value = disp.expr1.height ?? 12;
    if (e1Lbl) e1Lbl.checked = disp.expr1.show_label !== false;
    if (e1Val) e1Val.checked = disp.expr1.show_val !== false;

    // Expr 2
    const e2En = document.getElementById('dispExpr2En');
    const e2St = document.getElementById('dispExpr2Style');
    const e2X = document.getElementById('dispExpr2X');
    const e2Y = document.getElementById('dispExpr2Y');
    const e2W = document.getElementById('dispExpr2W');
    const e2H = document.getElementById('dispExpr2H');
    const e2Lbl = document.getElementById('dispExpr2Label');
    const e2Val = document.getElementById('dispExpr2Val');
    if (e2En) e2En.checked = disp.expr2.enabled !== false;
    if (e2St) e2St.value = disp.expr2.style ?? 1;
    if (e2X) e2X.value = disp.expr2.x ?? 70;
    if (e2Y) e2Y.value = disp.expr2.y ?? 47;
    if (e2W) e2W.value = disp.expr2.width ?? 12;
    if (e2H) e2H.value = disp.expr2.height ?? 12;
    if (e2Lbl) e2Lbl.checked = disp.expr2.show_label !== false;
    if (e2Val) e2Val.checked = disp.expr2.show_val !== false;

    // Toast Duration
    const tDur = document.getElementById('dispToastDuration');
    if (tDur) tDur.value = disp.toast_duration_ms ?? 500;
}

function setupOledInputsListeners() {
    function bind(id, prop, isBool = false, isInt = true) {
        const el = document.getElementById(id);
        if (!el) return;
        const handler = () => {
            const parts = prop.split('.');
            let target = configData.display;
            for (let i = 0; i < parts.length - 1; i++) {
                target = target[parts[i]];
            }
            const last = parts[parts.length - 1];
            if (isBool) {
                target[last] = el.checked;
            } else if (isInt) {
                target[last] = parseInt(el.value, 10) || 0;
            } else {
                target[last] = el.value;
            }
            renderOledSimulator();
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    }

    bind('dispPatchEn', 'patch.enabled', true);
    bind('dispPatchX', 'patch.x');
    bind('dispPatchY', 'patch.y');
    bind('dispPatchScale', 'patch.scale');

    bind('dispBpmEn', 'bpm.enabled', true);
    bind('dispBpmX', 'bpm.x');
    bind('dispBpmY', 'bpm.y');
    bind('dispBpmScale', 'bpm.scale');

    bind('dispLayerEn', 'layer.enabled', true);
    bind('dispLayerX', 'layer.x');
    bind('dispLayerY', 'layer.y');
    bind('dispLayerScale', 'layer.scale');

    bind('dispUsbEn', 'usb.enabled', true);
    bind('dispUsbX', 'usb.x');
    bind('dispUsbY', 'usb.y');
    bind('dispUsbScale', 'usb.scale');

    bind('dispDivEn', 'show_dividers', true);
    bind('dispDivY', 'divider_y');

    bind('dispExpr1En', 'expr1.enabled', true);
    bind('dispExpr1Style', 'expr1.style');
    bind('dispExpr1X', 'expr1.x');
    bind('dispExpr1Y', 'expr1.y');
    bind('dispExpr1W', 'expr1.width');
    bind('dispExpr1H', 'expr1.height');
    bind('dispExpr1Label', 'expr1.show_label', true);
    bind('dispExpr1Val', 'expr1.show_val', true);

    bind('dispExpr2En', 'expr2.enabled', true);
    bind('dispExpr2Style', 'expr2.style');
    bind('dispExpr2X', 'expr2.x');
    bind('dispExpr2Y', 'expr2.y');
    bind('dispExpr2W', 'expr2.width');
    bind('dispExpr2H', 'expr2.height');
    bind('dispExpr2Label', 'expr2.show_label', true);
    bind('dispExpr2Val', 'expr2.show_val', true);

    bind('dispToastDuration', 'toast_duration_ms');

    const testToastBtn = document.getElementById('btnTestToast');
    if (testToastBtn) {
        testToastBtn.addEventListener('click', () => {
            triggerSimulatedToast("DRV ON", "Module Drive");
        });
    }

    // Element card selection
    document.querySelectorAll('.oled-elem-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            const elem = card.dataset.elem;
            oledSimState.selectedElem = (oledSimState.selectedElem === elem) ? null : elem;
            highlightOledElemCard(oledSimState.selectedElem);
            renderOledSimulator();
        });
    });

    // Preset Layouts dropdown
    const presetSelect = document.getElementById('oledPresetLayoutSelect');
    if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                applyOledPresetLayout(e.target.value);
                presetSelect.value = '';
            }
        });
    }

    const resetBtn = document.getElementById('oledResetLayoutBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            applyOledPresetLayout('rotelle');
        });
    }
}

function applyOledPresetLayout(key) {
    const currentToastDur = configData.display?.toast_duration_ms || DEFAULT_DISPLAY_CONFIG.toast_duration_ms;
    if (key === 'rotelle') {
        configData.display = JSON.parse(JSON.stringify(DEFAULT_DISPLAY_CONFIG));
    } else if (key === 'barre') {
        configData.display = {
            patch: { x: 6, y: 4, scale: 2, enabled: true },
            layer: { x: 54, y: 4, scale: 1, enabled: true },
            usb:   { x: 104, y: 4, scale: 1, enabled: true },
            bpm:   { x: 6, y: 24, scale: 2, enabled: true },
            show_dividers: true,
            divider_y: 43,
            expr1: { x: 4, y: 47, width: 36, height: 8, style: 0, show_label: true, show_val: true, enabled: true },
            expr2: { x: 66, y: 47, width: 36, height: 8, style: 0, show_label: true, show_val: true, enabled: true }
        };
    } else if (key === 'verticali') {
        configData.display = {
            patch: { x: 24, y: 6, scale: 2, enabled: true },
            layer: { x: 66, y: 6, scale: 1, enabled: true },
            usb:   { x: 92, y: 6, scale: 1, enabled: true },
            bpm:   { x: 24, y: 30, scale: 2, enabled: true },
            show_dividers: false,
            divider_y: 43,
            expr1: { x: 4, y: 6, width: 8, height: 48, style: 2, show_label: true, show_val: false, enabled: true },
            expr2: { x: 116, y: 6, width: 8, height: 48, style: 2, show_label: true, show_val: false, enabled: true }
        };
    } else if (key === 'bpm_focus') {
        configData.display = {
            bpm:   { x: 14, y: 4, scale: 3, enabled: true },
            show_dividers: true,
            divider_y: 30,
            patch: { x: 8, y: 36, scale: 2, enabled: true },
            layer: { x: 54, y: 36, scale: 1, enabled: true },
            usb:   { x: 104, y: 36, scale: 1, enabled: true },
            expr1: { x: 6, y: 52, width: 34, height: 8, style: 0, show_label: true, show_val: true, enabled: true },
            expr2: { x: 68, y: 52, width: 34, height: 8, style: 0, show_label: true, show_val: true, enabled: true }
        };
    }
    configData.display.toast_duration_ms = currentToastDur;
    populateOledInputsFromConfig();
    renderOledSimulator();
    log(`📐 Applicato layout schermo: ${key}`, 'system');
}

function setupOledCanvasInteractions() {
    const canvas = document.getElementById('oledCanvas');
    if (!canvas) return;

    let isDragging = false;
    let dragKey = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let origElemX = 0;
    let origElemY = 0;

    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = 128 / rect.width;
        const scaleY = 64 / rect.height;
        const x = Math.floor((clientX - rect.left) * scaleX);
        const y = Math.floor((clientY - rect.top) * scaleY);
        return {
            x: Math.max(0, Math.min(127, x)),
            y: Math.max(0, Math.min(63, y))
        };
    }

    function onDown(e) {
        const { x, y } = getCoords(e);
        const keys = ['patch', 'bpm', 'layer', 'usb', 'expr1', 'expr2'];
        let hit = null;
        for (const k of keys) {
            const b = getElementBoundingBox(k);
            if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                hit = k;
                break;
            }
        }
        if (hit) {
            isDragging = true;
            dragKey = hit;
            oledSimState.selectedElem = hit;
            dragStartX = x;
            dragStartY = y;
            origElemX = configData.display[hit].x;
            origElemY = configData.display[hit].y;
            highlightOledElemCard(hit);
            renderOledSimulator();
        } else {
            oledSimState.selectedElem = null;
            highlightOledElemCard(null);
            renderOledSimulator();
        }
    }

    function onMove(e) {
        const { x, y } = getCoords(e);
        const coordsSpan = document.getElementById('oledCursorCoords');
        if (coordsSpan) {
            coordsSpan.textContent = `Posizione: X: ${x} , Y: ${y} ${oledSimState.selectedElem ? `[${oledSimState.selectedElem.toUpperCase()}]` : ''}`;
        }
        if (isDragging && dragKey) {
            const dx = x - dragStartX;
            const dy = y - dragStartY;
            configData.display[dragKey].x = Math.max(0, Math.min(127, origElemX + dx));
            configData.display[dragKey].y = Math.max(0, Math.min(63, origElemY + dy));
            populateOledInputsFromConfig();
            renderOledSimulator();
        }
    }

    function onUp() {
        if (isDragging) {
            isDragging = false;
            dragKey = null;
        }
    }

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e); }, { passive: false });
    window.addEventListener('touchmove', (e) => { onMove(e); }, { passive: false });
    window.addEventListener('touchend', onUp);
}

function setupOledTestControls() {
    const tE1 = document.getElementById('testExpr1');
    const tE1Val = document.getElementById('testExpr1Val');
    if (tE1) {
        tE1.addEventListener('input', () => {
            oledSimState.testExpr1 = parseInt(tE1.value, 10);
            if (tE1Val) tE1Val.textContent = `${tE1.value}%`;
            renderOledSimulator();
        });
    }

    const tE2 = document.getElementById('testExpr2');
    const tE2Val = document.getElementById('testExpr2Val');
    if (tE2) {
        tE2.addEventListener('input', () => {
            oledSimState.testExpr2 = parseInt(tE2.value, 10);
            if (tE2Val) tE2Val.textContent = `${tE2.value}%`;
            renderOledSimulator();
        });
    }

    const tBpm = document.getElementById('testBpm');
    if (tBpm) {
        tBpm.addEventListener('input', () => {
            oledSimState.testBpm = parseInt(tBpm.value, 10) || 120;
            renderOledSimulator();
        });
    }

    const tTap = document.getElementById('testTapBtn');
    if (tTap) {
        tTap.addEventListener('click', () => {
            const now = performance.now();
            if (oledSimState.lastTapTime > 0) {
                const diff = now - oledSimState.lastTapTime;
                if (diff >= 200 && diff <= 2000) {
                    const bpm = Math.round(60000 / diff);
                    oledSimState.testBpm = Math.max(40, Math.min(250, bpm));
                    if (tBpm) tBpm.value = oledSimState.testBpm;
                    renderOledSimulator();
                }
            }
            oledSimState.lastTapTime = now;
        });
    }

    const tPreset = document.getElementById('testPreset');
    if (tPreset) {
        tPreset.addEventListener('change', () => {
            oledSimState.testPreset = parseInt(tPreset.value, 10);
            renderOledSimulator();
        });
    }

    const tLayer = document.getElementById('testLayer');
    if (tLayer) {
        tLayer.addEventListener('change', () => {
            oledSimState.testLayer = parseInt(tLayer.value, 10);
            renderOledSimulator();
        });
    }

    const tUsb = document.getElementById('testUsb');
    if (tUsb) {
        tUsb.addEventListener('change', () => {
            oledSimState.testUsb = tUsb.checked;
            renderOledSimulator();
        });
    }

    document.querySelectorAll('input[name="oledTheme"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                oledSimState.theme = e.target.value;
                renderOledSimulator();
            }
        });
    });
}

function syncOledTestControlsFromState() {
    const tPreset = document.getElementById('testPreset');
    if (tPreset) tPreset.value = oledSimState.testPreset;

    const tLayer = document.getElementById('testLayer');
    if (tLayer) tLayer.value = oledSimState.testLayer;

    const tUsb = document.getElementById('testUsb');
    if (tUsb) tUsb.checked = oledSimState.testUsb;
}

function initOledSimulator() {
    populateOledInputsFromConfig();
    setupOledInputsListeners();
    setupOledCanvasInteractions();
    setupOledTestControls();
    renderOledSimulator();
}

// ═══ Initial Render ════════════════════════════════════════════════
renderModulesGrid();
renderButtons();
renderExprPedals();
renderExpressionKillswitch();
renderMidiIn();
initOledSimulator();
