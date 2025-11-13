# minimal_download.py
""" from gradio_client import Client, handle_file
from pathlib import Path
import shutil

# force client to download outputs into ./downloads
client = Client("ResembleAI/Chatterbox", download_files="./downloads")

#You need to replace the text_input and audio_prompt_path_input with your own values.Here I have used my own voice.
result = client.predict(
    text_input="Now let's make my mum's favourite. So three mars bars into the pan. Then we add the tuna and just stir for a bit, just let the chocolate and fish infuse. Now smell that. Oh boy this is going to be incredible.",
    audio_prompt_path_input=handle_file("Sample_Voice.mpeg"),
    exaggeration_input=0.5,
    temperature_input=0.8,
    seed_num_input=0,
    cfgw_input=0.5,
    vad_trim_input=False,
    api_name="/generate_tts_audio"
)

# result may now be a local path (string) or bytes; handle both
out_path = Path("./output.mpeg")

if isinstance(result, (bytes, bytearray)):
    out_path.write_bytes(result)
elif isinstance(result, str) and Path(result).exists():
    # the client already downloaded it to ./downloads; copy/rename to your final place
    shutil.copy(result, out_path)
else:
    raise RuntimeError(f"Unhandled return: {result}")

print("Saved to:", out_path) """


from bark import generate_audio, preload_models
from scipy.io.wavfile import write as write_wav

preload_models()
audio_array = generate_audio("Hello, this is Bark speaking locally!")
write_wav("bark_output.wav", 22050, audio_array)
