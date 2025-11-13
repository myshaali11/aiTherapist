# minimal_local_tts.py
from TTS.api import TTS
from pathlib import Path

# Choose model — expressive and fast
# You can try: "tts_models/en/vctk/vits" (multi-speaker, expressive)
model_name = "tts_models/en/vctk/vits"


# Initialize TTS model (set gpu=True if you have one)
tts = TTS(model_name=model_name, progress_bar=False, gpu=False)

# Input text
text_input = """Now let's make my mum's favourite. So three mars bars into the pan.
Then we add the tuna and just stir for a bit, just let the chocolate and fish infuse.
Now smell that. Oh boy this is going to be incredible."""

# Output file
out_path = Path("output.wav")

# Generate expressive speech
tts.tts_to_file(
    text=text_input,
    file_path=out_path
)

print("✅ Audio saved to:", out_path)
