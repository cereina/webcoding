import mammoth from 'mammoth/mammoth.browser.js';

interface ConvertRequest { buffer: ArrayBuffer }
interface ConvertResponse {
  ok: boolean;
  value?: string;
  messages?: string[];
  error?: string;
}

const worker = self as unknown as Worker;
worker.onmessage = async (event: MessageEvent<ConvertRequest>) => {
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: event.data.buffer });
    const response: ConvertResponse = {
      ok: true,
      value: result.value,
      messages: result.messages.map(message => message.message),
    };
    worker.postMessage(response);
  } catch {
    const response: ConvertResponse = { ok: false, error: 'The Word document could not be converted.' };
    worker.postMessage(response);
  }
};
