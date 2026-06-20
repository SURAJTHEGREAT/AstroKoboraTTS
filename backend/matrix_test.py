import os
import sys
import time
import json
import multiprocessing
import ctranslate2
import transformers
from tabulate import tabulate
import nltk
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction

# Ensure NLTK resources are available
for resource in ['punkt', 'punkt_tab']:
    try:
        nltk.data.find(f'tokenizers/{resource}')
    except LookupError:
        nltk.download(resource, quiet=True)

def get_translation_model_path():
    data_dir = os.environ.get("DATA_DIR")
    if not data_dir:
        cwd_data = os.path.join(os.getcwd(), "data")
        parent_data = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
        if os.path.exists(cwd_data):
            data_dir = os.path.abspath(cwd_data)
        elif os.path.exists(parent_data):
            data_dir = os.path.abspath(parent_data)
        else:
            data_dir = os.path.abspath(cwd_data)
    else:
        data_dir = os.path.abspath(data_dir)

    # Try models_cache first as it might be where it is in Docker
    cache_path = "/app/models_cache/nllb-model"
    if os.path.exists(cache_path):
        return cache_path

    return os.path.join(data_dir, "translation_models", "nllb-200-600M-ct2-int8")

def translate(text, src_lang, tgt_lang, translator, tokenizer):
    tokenizer.src_lang = src_lang
    source = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))

    results = translator.translate_batch(
        [source],
        target_prefix=[[tgt_lang]],
        beam_size=4,
        max_decoding_length=256,
        repetition_penalty=1.2
    )

    output_tokens = results[0].hypotheses[0]
    output_ids = tokenizer.convert_tokens_to_ids(output_tokens)
    translated_text = tokenizer.decode(output_ids, skip_special_tokens=True)
    return translated_text

def calculate_accuracy(original, round_trip):
    # Tokenize for BLEU
    orig_tokens = nltk.word_tokenize(original.lower())
    round_tokens = nltk.word_tokenize(round_trip.lower())

    # BLEU score with smoothing
    chencherry = SmoothingFunction()
    score = sentence_bleu([orig_tokens], round_tokens, smoothing_function=chencherry.method1)
    return score * 100

def main():
    input_text = os.environ.get("INPUT_TEXT")
    if len(sys.argv) > 1:
        input_text = " ".join(sys.argv[1:])

    if not input_text:
        input_text = "Hello, how are you today? I hope you are having a wonderful time."
        print(f"No input text provided. Using default: '{input_text}'\n")

    model_path = get_translation_model_path()
    if not os.path.exists(model_path):
        print(f"Error: Translation model not found at {model_path}")
        sys.exit(1)

    print(f"Loading models from {model_path}...")
    tokenizer = transformers.AutoTokenizer.from_pretrained(model_path)
    cpu_count = multiprocessing.cpu_count()
    translator = ctranslate2.Translator(model_path, device="cpu", intra_threads=cpu_count)

    # NLLB Language Prefix Mapping from main.py for reference
    all_supported = {
        "fra_Latn": "French",
        "spa_Latn": "Spanish",
        "ita_Latn": "Italian",
        "deu_Latn": "German",
        "jpn_Jpan": "Japanese",
        "hin_Deva": "Hindi",
        "por_Latn": "Portuguese",
        "zho_Hans": "Chinese",
    }

    target_lang_env = os.environ.get("TARGET_LANGS")
    if target_lang_env:
        codes = [c.strip() for c in target_lang_env.split(",")]
        target_languages = [(c, all_supported.get(c, c)) for c in codes]
    else:
        target_languages = list(all_supported.items())

    results = []

    print(f"Running matrix test for: '{input_text}'\n")

    for lang_code, lang_name in target_languages:
        # Forward translation
        start_time = time.time()
        translated = translate(input_text, "eng_Latn", lang_code, translator, tokenizer)
        latency_ms = (time.time() - start_time) * 1000

        # Reverse translation
        round_trip = translate(translated, lang_code, "eng_Latn", translator, tokenizer)

        # Accuracy
        accuracy = calculate_accuracy(input_text, round_trip)

        results.append({
            "Language": lang_name,
            "Code": lang_code,
            "Latency (ms)": round(latency_ms, 2),
            "Accuracy (%)": round(accuracy, 2),
            "Translated": translated,
            "Round Trip": round_trip
        })

    # Prepare table results (with truncation)
    table_results = []
    for r in results:
        tr = r.copy()
        if len(tr["Translated"]) > 50:
            tr["Translated"] = tr["Translated"][:50] + "..."
        if len(tr["Round Trip"]) > 50:
            tr["Round Trip"] = tr["Round Trip"][:50] + "..."
        table_results.append(tr)

    print(tabulate(table_results, headers="keys", tablefmt="grid"))

    if os.environ.get("OUTPUT_FORMAT") == "json":
        print("\nJSON_BEGIN")
        print(json.dumps(results, indent=2))
        print("JSON_END")

if __name__ == "__main__":
    main()
