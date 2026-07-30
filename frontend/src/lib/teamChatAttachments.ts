/** Encode image attachments inside TeamMessage.body (no backend API change). */

export const IMG_MARKER_RE =
  /\[\[NG_IMG:([^|\]]+)\|(data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+)\]\]/g;

export type ParsedChatBody = {
  text: string;
  images: { name: string; src: string }[];
};

export function parseMessageBody(body: string): ParsedChatBody {
  const images: { name: string; src: string }[] = [];
  const text = body
    .replace(IMG_MARKER_RE, (_full, name: string, src: string) => {
      images.push({ name: String(name).trim(), src: String(src).replace(/\s+/g, "") });
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, images };
}

export function encodeImageAttachment(name: string, dataUrl: string): string {
  const safe = name.replace(/[\[\]|<>]/g, "_").slice(0, 80);
  return `[[NG_IMG:${safe}|${dataUrl}]]`;
}

export function plainTextForCopy(body: string): string {
  const { text, images } = parseMessageBody(body);
  const names = images.map((i) => `[Image: ${i.name}]`).join(" ");
  return [text, names].filter(Boolean).join(" ").trim();
}

const MAX_BYTES = 450_000; // ~450KB after encode — keeps SQLite rows usable

export async function fileToCompressedDataUrl(file: File): Promise<{ name: string; dataUrl: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are supported (PNG, JPG, WEBP, GIF).");
  }
  if (file.size > 4_000_000) {
    throw new Error("Image is too large. Max 4 MB before compression.");
  }

  const dataUrl = await readAsDataUrl(file);
  if (dataUrl.length <= MAX_BYTES) {
    return { name: file.name, dataUrl };
  }

  const compressed = await compressDataUrl(dataUrl, file.type);
  if (compressed.length > MAX_BYTES) {
    throw new Error("Image is still too large after compression. Try a smaller photo.");
  }
  const name = file.name.replace(/\.\w+$/, "") + ".jpg";
  return { name, dataUrl: compressed };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function compressDataUrl(dataUrl: string, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 1280;
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        const scale = maxSide / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not compress image."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      // Prefer JPEG for size unless original is PNG with transparency needs — use jpeg for chat
      const out =
        mime === "image/png" || mime === "image/webp"
          ? canvas.toDataURL("image/jpeg", 0.72)
          : canvas.toDataURL("image/jpeg", 0.78);
      resolve(out);
    };
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = dataUrl;
  });
}

export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Clinical",
    emojis: ["🩺", "💊", "🏥", "🫀", "🫁", "🧬", "💉", "🩹", "🌡️", "📋", "⚠️", "✅", "❌", "🚨", "🔔"],
  },
  {
    label: "Faces",
    emojis: ["😀", "🙂", "😊", "😌", "🤔", "😮", "😅", "😢", "😴", "😷", "🤒", "🤗", "👍", "👎", "🙏"],
  },
  {
    label: "Gestures",
    emojis: ["👋", "👌", "✌️", "🤞", "💪", "✍️", "👀", "💬", "📝", "📌", "⭐", "🔥", "💡", "⏰", "📅"],
  },
];
