"""
Minimal Chatterbox local usage: generate expressive TTS and play instantly (no disk write).

Requirements:
pip install chatterbox-tts torch sounddevice simpleaudio numpy
# soundfile may be required on some systems:
pip install soundfile

Change the USER SETTINGS section below to customize text, sample prompt path, and controls.
"""

import sys
import numpy as np
import torch

# ---------- USER SETTINGS (change these) ----------
TEXT = "Hello — I hear you. Take a deep breath. I'm here with you."   # <-- change text
SAMPLE_PROMPT_PATH = "Sample_Voice.mpeg"  # <-- change to .wav or .mpeg, or set to None
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"  # or "cpu"
EXAGGERATION = 0.5    # optional: higher => more expressive (model-specific)
TEMPERATURE = 0.8     # optional sampling temperature
CFGW = 0.5            # optional: classifier-free guidance weight (if supported)
SEED = None           # optional: set int for deterministic output
VAD_TRIM = False      # optional: whether to enable VAD trimming (model-specific)
# --------------------------------------------------

# Minimal import; adjust if your package exposes a different path
from chatterbox_tts import ChatterboxTTS

# Load model (will use cached weights if already downloaded)
print("Loading Chatterbox model on", DEVICE, "...")  #remove this once if it prints correctly
model = ChatterboxTTS.from_pretrained(device=DEVICE)
model.eval()
if DEVICE.startswith("cuda"):
    # try half precision for speed (skip silently on failure)
    try:
        model.half()
    except Exception:
        pass

# Small wrapper that tries the common signatures (keeps code minimal & robust)
def generate_audio(model, text, sample_path=None, exaggeration=0.5, temperature=0.8,
                   cfgw=None, seed=None, vad_trim=False):
    """
    Minimal attempts to call model.generate with common param names.
    Returns either:
      - (torch.Tensor wav, sample_rate) or
      - torch.Tensor wav  (we handle both).
    """
    # Normalize None -> omitted
    kwargs_list = []

    # Common variant 1: audio_prompt_path + exaggeration + temperature
    kwargs_list.append({
        "audio_prompt_path": sample_path,
        "exaggeration": exaggeration,
        "temperature": temperature,
        "seed": seed,
        "vad_trim": vad_trim,
    })
    # Common variant 2: audio_prompt + cfgw
    kwargs_list.append({
        "audio_prompt": sample_path,
        "cfgw": cfgw if cfgw is not None else exaggeration,
        "temperature": temperature,
        "seed": seed
    })
    # Variant 3: prompt_audio + temperature + cfgw
    kwargs_list.append({
        "prompt_audio": sample_path,
        "temperature": temperature,
        "cfgw": cfgw if cfgw is not None else exaggeration,
        "seed": seed
    })

    last_err = None
    for kw in kwargs_list:
        # remove None values to avoid unexpected keyword errors
        kw_clean = {k: v for k, v in kw.items() if v is not None}
        try:
            return model.generate(text, **kw_clean)
        except TypeError as e:
            last_err = e
            continue
        except FileNotFoundError:
            raise  # if sample file is not found, surface that error immediately
        except Exception as e:
            # surface other exceptions (e.g., runtime issues)
            raise

    raise RuntimeError("Couldn't call model.generate with the attempted signatures. Last error: " + str(last_err))

# Call generation
try:
    generated = generate_audio(
        model,
        TEXT,
        sample_path=SAMPLE_PROMPT_PATH if SAMPLE_PROMPT_PATH else None,
        exaggeration=EXAGGERATION,
        temperature=TEMPERATURE,
        cfgw=CFGW,
        seed=SEED,
        vad_trim=VAD_TRIM
    )
except Exception as e:
    print("Generation failed:", e)
    sys.exit(1)

# Normalize model output -> (wav_np, sr)
def normalize_output(generated):
    # common return shapes: (wav_tensor, sr) or wav_tensor alone
    sr = getattr(model, "sr", None) or getattr(model, "sample_rate", None) or 24000
    if isinstance(generated, (list, tuple)):
        wav = generated[0]
        if len(generated) >= 2 and isinstance(generated[1], (int, float)):
            sr = int(generated[1])
    else:
        wav = generated

    if isinstance(wav, torch.Tensor):
        wav_np = wav.detach().cpu().numpy()
    elif isinstance(wav, np.ndarray):
        wav_np = wav
    else:
        raise RuntimeError(f"Unknown generated audio type: {type(wav)}")

    # Ensure shape is (samples, channels)
    if wav_np.ndim == 1:
        wav_np = wav_np.astype(np.float32)
    elif wav_np.ndim == 2:
        # many libs return (channels, samples)
        if wav_np.shape[0] <= 2 and wav_np.shape[0] != wav_np.shape[1]:
            wav_np = wav_np.T.astype(np.float32)
        else:
            wav_np = wav_np.astype(np.float32)
    else:
        raise RuntimeError(f"Unsupported audio shape: {wav_np.shape}")

    return wav_np, int(sr)

wav_np, sr = normalize_output(generated)
print("Generated audio shape:", wav_np.shape, "sr:", sr)

# Play in-memory: sounddevice preferred, simpleaudio fallback
played = False
try:
    import sounddevice as sd
    print("Playing with sounddevice...")
    sd.play(wav_np, sr)
    sd.wait()
    played = True
except Exception as e:
    print("sounddevice not available or failed:", e)

if not played:
    try:
        import simpleaudio as sa
        print("Playing with simpleaudio (fallback)...")
        # convert to int16 PCM
        if wav_np.ndim == 1:
            pcm = (wav_np * 32767.0).astype(np.int16)
            raw = pcm.tobytes()
            channels = 1
        else:
            pcm = (wav_np * 32767.0).astype(np.int16)
            raw = pcm.flatten().tobytes()
            channels = wav_np.shape[1]
        wave_obj = sa.WaveObject(raw, num_channels=channels, bytes_per_sample=2, sample_rate=sr)
        play_obj = wave_obj.play()
        play_obj.wait_done()
        played = True
    except Exception as e:
        print("simpleaudio playback failed:", e)

if not played:
    print("No playback available. You can save wav_np to disk manually if you want to debug.")
