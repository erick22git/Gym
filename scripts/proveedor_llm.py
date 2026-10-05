"""Capa de proveedor de modelo del servicio local.

Habla el protocolo de OpenAI (/v1/chat/completions, streaming SSE) contra cualquier servidor compatible
(por defecto el Ollama local empaquetado). Cambiar de modelo o de servidor es cambiar `base_url`/`modelo`;
el resto del servicio no sabe de Ollama. Sin internet: solo habla con la URL local que le pasa la app.

Los "perfiles" (basico / medio / alto) viven en modelos_perfiles.json junto a este archivo.
"""
import json
import time
import urllib.request
from pathlib import Path


def cargar_perfiles(base_dir):
    try:
        return json.loads((Path(base_dir) / "modelos_perfiles.json").read_text(encoding="utf-8"))
    except Exception:
        return {"perfiles": {"medio": {"modelo": "qwen2.5:3b", "num_ctx": 4096, "max_tokens": 700}},
                "perfil_por_defecto": "medio", "umbrales_tokens_por_segundo": {"medio": 0}}


class ProveedorOpenAI:
    def __init__(self, base_url, api_key="local"):
        self.base_url = base_url.rstrip("/")          # raiz del servidor, sin /v1
        self.api_key = api_key                        # los servidores locales lo ignoran

    def _peticion(self, ruta, cuerpo=None, timeout=600):
        datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
        return urllib.request.Request(
            self.base_url + ruta, data=datos, method="POST" if cuerpo is not None else "GET",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"})

    def _cuerpo_chat(self, mensajes, modelo, temperature, max_tokens, num_ctx, stream, formato_json):
        cuerpo = {"model": modelo, "messages": mensajes, "temperature": temperature, "stream": stream,
                  # Respuestas interactivas: sin "thinking" (si el modelo lo tiene, lo apaga).
                  "reasoning_effort": "none"}
        if max_tokens:
            cuerpo["max_tokens"] = int(max_tokens)
        if num_ctx:
            cuerpo["options"] = {"num_ctx": int(num_ctx)}   # extension de Ollama; otros servidores la ignoran
        if stream:
            cuerpo["stream_options"] = {"include_usage": True}
        if formato_json:
            cuerpo["response_format"] = {"type": "json_object"}
        return cuerpo

    def chat(self, mensajes, modelo, temperature=0.3, max_tokens=None, num_ctx=None, formato_json=False):
        """Respuesta completa (sin streaming) como texto."""
        req = self._peticion("/v1/chat/completions",
                             self._cuerpo_chat(mensajes, modelo, temperature, max_tokens, num_ctx, False, formato_json))
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.loads(r.read().decode("utf-8"))["choices"][0]["message"]["content"] or ""

    def chat_stream(self, mensajes, modelo, temperature=0.3, max_tokens=None, num_ctx=None):
        """Generador de eventos: {"token": str} por cada trozo y al final {"fin": True, "tokens", "ms_primer_token",
        "ms_total"}. Si quien consume deja de iterar (el usuario pulsó Detener) se cierra la conexion con el
        modelo, y el servidor deja de generar."""
        req = self._peticion("/v1/chat/completions",
                             self._cuerpo_chat(mensajes, modelo, temperature, max_tokens, num_ctx, True, False))
        t0 = time.time()
        primero = None
        n = 0
        usados = None
        resp = urllib.request.urlopen(req, timeout=600)
        try:
            for linea in resp:
                linea = linea.decode("utf-8", "replace").strip()
                if not linea.startswith("data:"):
                    continue
                carga = linea[5:].strip()
                if carga == "[DONE]":
                    break
                try:
                    ev = json.loads(carga)
                except json.JSONDecodeError:
                    continue
                if ev.get("usage"):
                    usados = ev["usage"].get("completion_tokens")
                for ch in ev.get("choices") or []:
                    trozo = (ch.get("delta") or {}).get("content") or ""
                    if trozo:
                        if primero is None:
                            primero = time.time()
                        n += 1
                        yield {"token": trozo}
        finally:
            resp.close()                                # corta la generacion en el servidor
        ahora = time.time()
        yield {"fin": True, "tokens": usados or n,
               "ms_primer_token": round(((primero or ahora) - t0) * 1000),
               "ms_total": round((ahora - t0) * 1000)}

    def listar_modelos(self):
        """Modelos instalados en el servidor local (formato OpenAI /v1/models)."""
        with urllib.request.urlopen(self._peticion("/v1/models"), timeout=5) as r:
            return [m["id"] for m in json.loads(r.read().decode("utf-8")).get("data", [])]
