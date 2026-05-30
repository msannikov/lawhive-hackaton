import { useState, type ReactNode } from "react";
import type { IntakeSchema, IntakeField, Facts } from "../types";
import { unflatten, flatten } from "../lib/paths";
import DocUploadAccelerator from "./DocUploadAccelerator";

interface Props {
  schema: IntakeSchema;
  domain: string;
  onSubmit: (facts: Facts) => void;
}

type Values = Record<string, unknown>;

export default function IntakeForm({ schema, domain, onSubmit }: Props) {
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<string[]>([]);

  const set = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }));

  // Prefill from a VLM extraction: flatten the nested facts into dotted keys.
  const prefill = (facts: Facts) => setValues((v) => ({ ...v, ...flatten(facts as Record<string, unknown>) }));

  function submit() {
    const missing = schema.fields
      .filter((f) => f.required && (values[f.name] === undefined || values[f.name] === ""))
      .map((f) => f.label);
    if (missing.length) {
      setErrors(missing);
      return;
    }
    setErrors([]);
    onSubmit(unflatten(values));
  }

  // Group fields, preserving first-seen order.
  const groups: { name: string; fields: IntakeField[] }[] = [];
  for (const f of schema.fields) {
    const g = f.group ?? "";
    let bucket = groups.find((x) => x.name === g);
    if (!bucket) {
      bucket = { name: g, fields: [] };
      groups.push(bucket);
    }
    bucket.fields.push(f);
  }

  return (
    <section className="intake">
      <h2 className="section-title">{schema.title}</h2>
      {schema.intro && <p className="section-sub">{schema.intro}</p>}

      <DocUploadAccelerator domain={domain} onExtracted={prefill} />

      {groups.map((g) => (
        <fieldset key={g.name || "_"} className="intake-group">
          {g.name && <legend>{g.name}</legend>}
          <div className="fields">
            {g.fields.map((f) => (
              <Field key={f.name} field={f} value={values[f.name]} onChange={(val) => set(f.name, val)} />
            ))}
          </div>
        </fieldset>
      ))}

      {errors.length > 0 && <div className="error">Please fill in: {errors.join(", ")}.</div>}

      <button type="button" className="primary-btn" onClick={submit}>
        See my options →
      </button>
    </section>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: IntakeField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = "f-" + field.name.replace(/\W/g, "-");

  let control: ReactNode;
  switch (field.type) {
    case "boolean":
      control = (
        <div className="bool">
          <button type="button" className={"bool-opt" + (value === true ? " on" : "")} onClick={() => onChange(true)}>
            Yes
          </button>
          <button type="button" className={"bool-opt" + (value === false ? " on" : "")} onClick={() => onChange(false)}>
            No
          </button>
        </div>
      );
      break;
    case "select":
      control = (
        <select id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            Choose…
          </option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "date":
      control = <input id={id} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
    case "money":
      control = (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={field.type === "money" ? "0.01" : "1"}
          placeholder={field.placeholder}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
      break;
    case "textarea":
      control = (
        <textarea id={id} value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      );
      break;
    default:
      control = (
        <input id={id} type="text" placeholder={field.placeholder} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      );
  }

  return (
    <div className={"field field-" + field.type}>
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="req">*</span>}
      </label>
      {control}
      {field.help && <span className="field-help">{field.help}</span>}
    </div>
  );
}
