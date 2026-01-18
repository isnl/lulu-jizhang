import { extractText } from 'unpdf';

export const parsePdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    // unpdf should handle the parsing
    const { text } = await extractText(arrayBuffer);
    return Array.isArray(text) ? text.join('\n') : text;
};
