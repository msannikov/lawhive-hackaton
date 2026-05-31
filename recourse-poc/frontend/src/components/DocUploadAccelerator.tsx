import { useState } from "react";
import { extractFacts } from "../api";
import type { Facts, DocInput } from "../types";
import { negCopy } from "../lib/negCopy";

const MEDIA: Record<string, DocInput["mediaType"]> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function toDocInput(file: File): Promise<DocInput> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mediaType = MEDIA[ext];
    if (!mediaType) return reject(new Error(`Unsupported file: ${file.name}`));
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] ?? "";
      resolve({ name: file.name, kind: mediaType === "application/pdf" ? "pdf" : "image", mediaType, base64 });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface Props {
  domain: string;
  onExtracted: (facts: Facts) => void;
}

export default function DocUploadAccelerator({ domain, onExtracted }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const copy = negCopy(domain);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    setCount(files.length);
    try {
      const docs = await Promise.all(Array.from(files).map(toDocInput));
      const result = await extractFacts(domain, docs);
      onExtracted(result.facts);
      setMsg(`✓ Read ${docs.length} document${docs.length > 1 ? "s" : ""} and filled in your answers below — have a quick check.`);
    } catch (e) {
      setMsg("Couldn't read those documents — please fill the form in manually. " + String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="uploader" htmlFor="doc-upload">
      <div className="uploader-icon">📎</div>
      <div className="uploader-text">
        <div className="uploader-title">Skip the typing — upload your paperwork</div>
        <div className="uploader-sub">
          Drop {copy.uploadHint}. Law Gun reads them and fills this in for you.
        </div>
        {busy && <div className="uploader-msg busy">Reading your {count} document{count > 1 ? "s" : ""}…</div>}
        {msg && <div className="uploader-msg">{msg}</div>}
      </div>
      <input
        id="doc-upload"
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg"
        disabled={busy}
        onChange={(e) => onFiles(e.target.files)}
        style={{ display: "none" }}
      />
      <span className="uploader-cta">Choose files</span>
    </label>
  );
}
