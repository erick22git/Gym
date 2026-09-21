// AudioWorklet de captura: entrega al hilo principal cada bloque de audio (Float32, mono)
// tal como llega del micrófono. Lo usa useDictado. Se sirve como archivo propio de la app
// (script-src 'self'), sin blobs ni eval.
class CapturaPcm extends AudioWorkletProcessor {
  process(entradas) {
    const canal = entradas[0] && entradas[0][0]
    if (canal) this.port.postMessage(canal.slice(0))
    return true
  }
}
registerProcessor('captura-pcm', CapturaPcm)
