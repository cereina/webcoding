import { validateDocxArchive } from './docx-safety.ts';

export interface DocxConversionResult {
  value: string;
  messages: string[];
}

interface WorkerResponse {
  ok: boolean;
  value?: string;
  messages?: string[];
  error?: string;
}

export async function convertDocxSafely(file: File, timeoutMs = 30000): Promise<DocxConversionResult> {
  const buffer = await file.arrayBuffer();
  const safety = validateDocxArchive(buffer);
  if (!safety.ok) throw new Error(safety.message);

  const worker = new Worker(new URL('./docx-worker.ts', import.meta.url), { type: 'module', name: 'maple-docx-converter' });
  return await new Promise<DocxConversionResult>((resolve, reject) => {
    const finish = () => worker.terminate();
    const timer = window.setTimeout(() => {
      finish();
      reject(new Error('Word conversion took too long and was stopped safely. Try a smaller document.'));
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      window.clearTimeout(timer);
      finish();
      const response = event.data;
      if (!response?.ok || typeof response.value !== 'string') {
        reject(new Error(response?.error || 'The Word document could not be converted.'));
        return;
      }
      resolve({ value: response.value, messages: Array.isArray(response.messages) ? response.messages : [] });
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      finish();
      reject(new Error('The Word document could not be converted safely.'));
    };

    worker.postMessage({ buffer }, [buffer]);
  });
}
