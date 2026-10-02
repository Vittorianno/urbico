/**
 * fetch com timeout. Nenhuma chamada externa do backend tinha timeout: uma
 * fonte lenta (Ollama num celular, SPTrans, Nominatim) deixava a requisição
 * do app pendurada indefinidamente. Em caso de estouro, fetch rejeita com
 * `TimeoutError`, que os chamadores já tratam como falha da integração.
 */
export function fetchWithTimeout(input: string | URL, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
}
