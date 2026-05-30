import { useState } from "react";
import { extractFacts } from "../api";
import type { Facts, DocInput } from "../types";

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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const docs = await Promise.all(Array.from(files).map(toDocInput));
      const result = await extractFacts(domain, docs);
      onExtracted(result.facts);
      setMsg(`Pre-filled from ${docs.length} document${docs.length > 1 ? "s" : ""} (${result.provider}). Check the answers below.`);
    } catch (e) {
      setMsg("Couldn't read those documents — please fill the form in manually. " + String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="uploader">
      <button type="button" className="uploader-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} Have the paperwork? Upload it to fill this in automatically
      </button>
      {open && (
        <div className="uploader-body">
          <p className="field-help">
            Add your tenancy agreement, a bank statement showing the deposit, and any deposit-scheme search
            screenshots. We read them and pre-fill the answers for you to check — nothing is sent anywhere.
          </p>
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
          {busy && <div className="loading">Reading your documents…</div>}
          {msg && <p className="uploader-msg">{msg}</p>}
        </div>
      )}
    </div>
  );
}
